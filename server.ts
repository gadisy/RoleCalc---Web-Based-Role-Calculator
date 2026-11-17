import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';

type UserRole = 'USER_A' | 'USER_B';
type MathOperator = '+' | '-';

interface StoredUser {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  baseNumber: number;
  passwordSalt: string;
  passwordHash: string;
  createdAt: string;
}

interface StoredCalculation {
  id: string;
  uid: string;
  role: UserRole;
  baseNumber: number;
  operator: MathOperator;
  operand: number;
  result: number;
  expression: string;
  createdAt: string;
}

interface StoreSchema {
  users: StoredUser[];
  calculations: StoredCalculation[];
}

interface SessionPayload {
  uid: string;
  exp: number;
}

interface AuthenticatedRequest extends Request {
  currentUser?: StoredUser;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(__dirname, '.data');
const STORE_PATH = path.resolve(DATA_DIR, 'rolecalc-store.json');
const SESSION_COOKIE_NAME = 'rolecalc_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16
    ? process.env.SESSION_SECRET.trim()
    : crypto.randomBytes(32).toString('hex');

const ROLE_BASE_NUMBERS: Record<UserRole, { label: string; baseNumber: number }> = {
  USER_A: { label: 'User A', baseNumber: 5 },
  USER_B: { label: 'User B', baseNumber: 7 },
};

function ensureStoreFile(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_PATH)) {
    const initial: StoreSchema = { users: [], calculations: [] };
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf8');
  }
}

function readStore(): StoreSchema {
  ensureStoreFile();
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoreSchema>;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      calculations: Array.isArray(parsed.calculations) ? parsed.calculations : [],
    };
  } catch {
    return { users: [], calculations: [] };
  }
}

function writeStore(store: StoreSchema): void {
  ensureStoreFile();
  const tempPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tempPath, STORE_PATH);
}

function hashPassword(password: string, salt?: string): { salt: string; hash: string } {
  const resolvedSalt = salt || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, resolvedSalt, 64).toString('hex');
  return { salt: resolvedSalt, hash: derivedKey };
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function signSessionToken(uid: string): string {
  const payload: SessionPayload = {
    uid,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) return null;

  const expectedSignature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expectedSignature, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as SessionPayload;
    if (!decoded.uid || typeof decoded.exp !== 'number' || decoded.exp < Date.now()) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(value);
      } catch {
        result[key] = value;
      }
    }
  }
  return result;
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE_NAME] || null;
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  const isHttps =
    req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

function clearSessionCookie(req: Request, res: Response): void {
  const isHttps =
    req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    path: '/',
  });
}

function toPublicUser(user: StoredUser) {
  return {
    uid: user.uid,
    name: user.name,
    email: user.email,
    role: user.role,
    roleLabel: ROLE_BASE_NUMBERS[user.role].label,
    baseNumber: ROLE_BASE_NUMBERS[user.role].baseNumber,
    createdAt: user.createdAt,
  };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Sesi tidak ditemukan. Silakan login terlebih dahulu.' });
    return;
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Sesi telah berakhir atau tidak valid. Silakan login ulang.' });
    return;
  }

  const store = readStore();
  const user = store.users.find((item) => item.uid === payload.uid);
  if (!user) {
    res.status(401).json({ error: 'Akun pengguna tidak ditemukan.' });
    return;
  }

  req.currentUser = user;
  next();
}

async function startServer(): Promise<void> {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'RoleCalc API' });
  });

  app.get('/api/auth/status', (_req, res) => {
    const store = readStore();
    res.json({ hasUsers: store.users.length > 0 });
  });

  app.post('/api/auth/register', (req, res) => {
    const rawName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const rawPassword = typeof req.body?.password === 'string' ? req.body.password : '';
    const rawRole = req.body?.role;

    if (rawName.length < 2 || rawName.length > 80) {
      res.status(400).json({ error: 'Nama lengkap harus terdiri dari 2 sampai 80 karakter.' });
      return;
    }

    if (!isValidEmail(rawEmail) || rawEmail.length > 160) {
      res.status(400).json({ error: 'Format email tidak valid.' });
      return;
    }

    if (rawPassword.length < 6 || rawPassword.length > 128) {
      res.status(400).json({ error: 'Password minimal 6 karakter.' });
      return;
    }

    if (rawRole !== 'USER_A' && rawRole !== 'USER_B') {
      res.status(400).json({ error: 'Role tidak valid. Pilih User A atau User B.' });
      return;
    }

    const validatedRole: UserRole = rawRole;
    const store = readStore();
    const exists = store.users.some((item) => item.email === rawEmail);
    if (exists) {
      res.status(409).json({ error: 'Email ini sudah terdaftar. Silakan masuk menggunakan akun tersebut.' });
      return;
    }

    const { salt, hash } = hashPassword(rawPassword);
    const roleConfig = ROLE_BASE_NUMBERS[validatedRole];
    const newUser: StoredUser = {
      uid: crypto.randomUUID(),
      name: rawName,
      email: rawEmail,
      role: validatedRole,
      baseNumber: roleConfig.baseNumber,
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
    };

    store.users.push(newUser);
    writeStore(store);

    const token = signSessionToken(newUser.uid);
    setSessionCookie(req, res, token);
    res.status(201).json({
      user: toPublicUser(newUser),
      token,
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const rawPassword = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!isValidEmail(rawEmail)) {
      res.status(400).json({ error: 'Masukkan alamat email yang valid.' });
      return;
    }

    if (!rawPassword) {
      res.status(400).json({ error: 'Password wajib diisi.' });
      return;
    }

    const store = readStore();
    if (store.users.length === 0) {
      res.status(401).json({
        code: 'NO_ACCOUNTS',
        error: 'Belum ada akun yang terdaftar. Silakan buka tab "Daftar Akun" untuk membuat akun User A atau User B terlebih dahulu.',
      });
      return;
    }

    const user = store.users.find((item) => item.email === rawEmail);
    if (!user) {
      res.status(401).json({
        code: 'USER_NOT_FOUND',
        error: 'Email belum terdaftar. Silakan buat akun baru melalui tab "Daftar Akun".',
      });
      return;
    }

    if (!verifyPassword(rawPassword, user.passwordSalt, user.passwordHash)) {
      res.status(401).json({
        code: 'INVALID_PASSWORD',
        error: 'Login gagal. Password yang Anda masukkan salah.',
      });
      return;
    }

    const token = signSessionToken(user.uid);
    setSessionCookie(req, res, token);
    res.json({
      user: toPublicUser(user),
      token,
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: toPublicUser(req.currentUser!) });
  });

  app.get('/api/calculations', requireAuth, (req: AuthenticatedRequest, res) => {
    const store = readStore();
    const history = store.calculations
      .filter((item) => item.uid === req.currentUser!.uid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50);

    res.json({ calculations: history });
  });

  app.post('/api/calculations', requireAuth, (req: AuthenticatedRequest, res) => {
    const rawOperand = req.body?.operand;
    const rawOperator = req.body?.operator;

    if (
      typeof rawOperand !== 'number' ||
      !Number.isInteger(rawOperand) ||
      rawOperand < 0 ||
      rawOperand > 9
    ) {
      res.status(400).json({
        error: 'Input angka tidak valid. Hanya diperbolehkan satu digit angka 0 sampai 9.',
      });
      return;
    }

    if (rawOperator !== '+' && rawOperator !== '-') {
      res.status(400).json({
        error: 'Operator tidak valid. Gunakan penjumlahan (+) atau pengurangan (-).',
      });
      return;
    }

    const user = req.currentUser!;
    const baseNumber = ROLE_BASE_NUMBERS[user.role].baseNumber;
    const result = rawOperator === '+' ? baseNumber + rawOperand : baseNumber - rawOperand;
    const record: StoredCalculation = {
      id: crypto.randomUUID(),
      uid: user.uid,
      role: user.role,
      baseNumber,
      operator: rawOperator,
      operand: rawOperand,
      result,
      expression: `${baseNumber} ${rawOperator} ${rawOperand}`,
      createdAt: new Date().toISOString(),
    };

    const store = readStore();
    store.calculations.unshift(record);
    if (store.calculations.length > 500) {
      store.calculations = store.calculations.slice(0, 500);
    }
    writeStore(store);

    res.status(201).json({ calculation: record });
  });

  app.delete('/api/calculations', requireAuth, (req: AuthenticatedRequest, res) => {
    const store = readStore();
    store.calculations = store.calculations.filter((item) => item.uid !== req.currentUser!.uid);
    writeStore(store);
    res.json({ ok: true });
  });

  const distDir = path.resolve(__dirname, 'dist');
  const distIndex = path.resolve(distDir, 'index.html');
  const isDevLifecycle = process.env.npm_lifecycle_event === 'dev' || process.env.NODE_ENV === 'development';
  const useViteDev = isDevLifecycle || !fs.existsSync(distIndex);

  if (useViteDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(distIndex);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RoleCalc server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start RoleCalc server:', err);
  process.exit(1);
});
