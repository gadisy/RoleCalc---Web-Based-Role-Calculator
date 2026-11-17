import type { AuthRepository, CalculationRepository } from './contracts';
import type {
  AuthSessionResult,
  CalculationRecord,
  ComputeCalculationPayload,
  LoginPayload,
  RegisterPayload,
  UserProfile,
} from '../types/rolecalc';

const SESSION_TOKEN_KEY = 'rolecalc_session_token';

function getStoredToken(): string | null {
  try {
    return window.sessionStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

function setStoredToken(token: string | null): void {
  try {
    if (token) {
      window.sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // Abaikan jika sessionStorage tidak tersedia
  }
}

export class ApiRequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    const message =
      (data && typeof data.error === 'string' && data.error) ||
      'Terjadi kesalahan saat menghubungi server.';
    const code = data && typeof data.code === 'string' ? data.code : undefined;
    throw new ApiRequestError(message, response.status, code);
  }

  return data as T;
}

export async function getAuthStatus(): Promise<{ hasUsers: boolean }> {
  return requestJson<{ hasUsers: boolean }>('/api/auth/status', {
    method: 'GET',
  });
}

class ApiAuthRepository implements AuthRepository {
  async getCurrentUser(): Promise<UserProfile | null> {
    try {
      const data = await requestJson<{ user: UserProfile }>('/api/auth/me', {
        method: 'GET',
      });
      return data.user;
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        setStoredToken(null);
        return null;
      }
      throw error;
    }
  }

  async login(payload: LoginPayload): Promise<UserProfile> {
    const data = await requestJson<AuthSessionResult>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setStoredToken(data.token);
    return data.user;
  }

  async register(payload: RegisterPayload): Promise<UserProfile> {
    const data = await requestJson<AuthSessionResult>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setStoredToken(data.token);
    return data.user;
  }

  async logout(): Promise<void> {
    try {
      await requestJson<{ ok: boolean }>('/api/auth/logout', {
        method: 'POST',
      });
    } finally {
      setStoredToken(null);
    }
  }
}

class ApiCalculationRepository implements CalculationRepository {
  async listHistory(): Promise<CalculationRecord[]> {
    const data = await requestJson<{ calculations: CalculationRecord[] }>('/api/calculations', {
      method: 'GET',
    });
    return data.calculations;
  }

  async computeAndSave(payload: ComputeCalculationPayload): Promise<CalculationRecord> {
    const data = await requestJson<{ calculation: CalculationRecord }>('/api/calculations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.calculation;
  }

  async clearHistory(): Promise<void> {
    await requestJson<{ ok: boolean }>('/api/calculations', {
      method: 'DELETE',
    });
  }
}

export const authRepository: AuthRepository = new ApiAuthRepository();
export const calculationRepository: CalculationRepository = new ApiCalculationRepository();
