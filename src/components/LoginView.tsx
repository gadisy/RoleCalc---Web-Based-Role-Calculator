import React, { useEffect, useState } from 'react';
import { AlertCircle, Calculator, Eye, EyeOff, Info, Loader2, Lock, Mail, User } from 'lucide-react';
import { ApiRequestError, authRepository, getAuthStatus } from '../services/apiRepository';
import { ROLE_DEFINITIONS, type UserProfile, type UserRole } from '../types/rolecalc';

interface LoginViewProps {
  onAuthenticated: (user: UserProfile) => void;
}

type AuthMode = 'login' | 'register';

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginView({ onAuthenticated }: LoginViewProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('USER_A');
  const [showPassword, setShowPassword] = useState(false);

  const [hasRegisteredUsers, setHasRegisteredUsers] = useState<boolean | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitErrorCode, setSubmitErrorCode] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    getAuthStatus()
      .then((res) => {
        if (active) {
          setHasRegisteredUsers(res.hasUsers);
        }
      })
      .catch(() => {
        // Abaikan jika gagal memuat status awal
      });
    return () => {
      active = false;
    };
  }, []);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setFieldErrors({});
    setSubmitError(null);
    setSubmitErrorCode(undefined);
  };

  const validateForm = (): boolean => {
    const errors: FieldErrors = {};
    const trimmedEmail = email.trim();

    if (mode === 'register') {
      const trimmedName = name.trim();
      if (!trimmedName) {
        errors.name = 'Nama lengkap wajib diisi.';
      } else if (trimmedName.length < 2) {
        errors.name = 'Nama lengkap minimal 2 karakter.';
      }
    }

    if (!trimmedEmail) {
      errors.email = 'Alamat email wajib diisi.';
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      errors.email = 'Format email tidak valid (contoh: nama@domain.com).';
    }

    if (!password) {
      errors.password = 'Password wajib diisi.';
    } else if (mode === 'register' && password.length < 6) {
      errors.password = 'Password minimal 6 karakter.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setSubmitErrorCode(undefined);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const user =
        mode === 'login'
          ? await authRepository.login({
              email: email.trim(),
              password,
            })
          : await authRepository.register({
              name: name.trim(),
              email: email.trim(),
              password,
              role,
            });
      onAuthenticated(user);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Autentikasi gagal. Periksa kembali data Anda.';
      setSubmitError(message);
      if (error instanceof ApiRequestError) {
        setSubmitErrorCode(error.code);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <span className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <Calculator className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-900">RoleCalc</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap shrink-0">
            <span>Kalkulator Berbasis Peran</span>
            <span aria-hidden="true">·</span>
            <span>Autentikasi Terproteksi</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10 lg:py-16">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          <section className="lg:col-span-6 flex flex-col justify-between py-2">
            <div>
              <p className="text-xs font-semibold tracking-wide text-blue-600 mb-3">
                Akses Peran &amp; Perhitungan Presisi
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight [text-wrap:balance]">
                Satu kalkulator sederhana dengan angka dasar sesuai peran Anda.
              </h1>
              <p className="mt-4 text-base text-slate-600 leading-relaxed max-w-xl">
                Masuk dengan akun terdaftar untuk mengakses dashboard kalkulator. Setiap akun
                terikat pada peran pengguna yang menentukan angka dasar perhitungan secara otomatis.
              </p>

              <div className="mt-8 border border-slate-200 bg-white rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Matriks Angka Dasar Peran
                  </h2>
                </div>
                <div className="divide-y divide-slate-200">
                  {(['USER_A', 'USER_B'] as const).map((roleKey) => {
                    const def = ROLE_DEFINITIONS[roleKey];
                    const samplePlus =
                      roleKey === 'USER_A' ? '5 + 3 = 8' : '7 + 5 = 12';
                    const sampleMinus =
                      roleKey === 'USER_A' ? '5 - 3 = 2' : '7 - 5 = 2';
                    return (
                      <div
                        key={def.role}
                        className="px-5 py-4 flex items-center justify-between gap-4"
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {def.label}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Contoh: <span className="font-mono tabular-nums">{samplePlus}</span>
                            <span className="mx-1.5" aria-hidden="true">
                              ·
                            </span>
                            <span className="font-mono tabular-nums">{sampleMinus}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs text-slate-500">Angka Dasar</div>
                          <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
                            {def.baseNumber}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-200 text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Validasi digit tunggal 0–9</span>
              <span aria-hidden="true">·</span>
              <span>Hashing password scrypt di server</span>
              <span aria-hidden="true">·</span>
              <span>Struktur siap Firebase Auth &amp; Firestore</span>
            </div>
          </section>

          <section className="lg:col-span-6 flex items-center">
            <div className="w-full bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm">
              <div
                className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg mb-6"
                role="tablist"
                aria-label="Mode autentikasi"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'login'}
                  onClick={() => switchMode('login')}
                  className={`py-2 px-4 text-sm font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    mode === 'login'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Masuk
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'register'}
                  onClick={() => switchMode('register')}
                  className={`py-2 px-4 text-sm font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    mode === 'register'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Daftar Akun
                </button>
              </div>

              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900">
                  {mode === 'login' ? 'Masuk ke Akun Anda' : 'Buat Akun RoleCalc Baru'}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {mode === 'login'
                    ? 'Masukkan email dan password untuk membuka dashboard kalkulator.'
                    : 'Daftarkan akun dengan peran User A (angka dasar 5) atau User B (angka dasar 7).'}
                </p>
              </div>

              {mode === 'login' && hasRegisteredUsers === false && !submitError && (
                <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50/70 px-3.5 py-3 text-xs sm:text-sm text-slate-700">
                  <Info className="w-4 h-4 mt-0.5 text-blue-600 shrink-0" aria-hidden="true" />
                  <div>
                    <span>
                      Belum ada akun yang terdaftar. Silakan buat akun User A atau User B terlebih dahulu.
                    </span>
                    <button
                      type="button"
                      onClick={() => switchMode('register')}
                      className="ml-1.5 font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      Daftar Akun →
                    </button>
                  </div>
                </div>
              )}

              {submitError && (
                <div
                  role="alert"
                  className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="space-y-1.5">
                    <p>{submitError}</p>
                    {(submitErrorCode === 'NO_ACCOUNTS' || submitErrorCode === 'USER_NOT_FOUND') && (
                      <button
                        type="button"
                        onClick={() => switchMode('register')}
                        className="text-xs font-semibold text-red-800 underline hover:text-red-900"
                      >
                        Daftar akun baru sekarang →
                      </button>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {mode === 'register' && (
                  <div>
                    <label
                      htmlFor="register-name"
                      className="block text-sm font-medium text-slate-700 mb-1.5"
                    >
                      Nama Lengkap
                    </label>
                    <div className="relative">
                      <User
                        className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id="register-name"
                        type="text"
                        autoComplete="name"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (fieldErrors.name) {
                            setFieldErrors((prev) => ({ ...prev, name: undefined }));
                          }
                        }}
                        placeholder="Contoh: Andi Pratama"
                        disabled={isSubmitting}
                        className={`w-full h-11 pl-10 pr-3.5 rounded-lg border text-sm bg-white text-slate-900 placeholder:text-slate-400 transition-colors ${
                          fieldErrors.name
                            ? 'border-red-400 focus:border-red-500'
                            : 'border-slate-300 focus:border-blue-600'
                        }`}
                      />
                    </div>
                    {fieldErrors.name && (
                      <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{fieldErrors.name}</span>
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="auth-email"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Email
                  </label>
                  <div className="relative">
                    <Mail
                      className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="auth-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (fieldErrors.email) {
                          setFieldErrors((prev) => ({ ...prev, email: undefined }));
                        }
                      }}
                      placeholder="nama@perusahaan.com"
                      disabled={isSubmitting}
                      className={`w-full h-11 pl-10 pr-3.5 rounded-lg border text-sm bg-white text-slate-900 placeholder:text-slate-400 transition-colors ${
                        fieldErrors.email
                          ? 'border-red-400 focus:border-red-500'
                          : 'border-slate-300 focus:border-blue-600'
                      }`}
                    />
                  </div>
                  {fieldErrors.email && (
                    <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{fieldErrors.email}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="auth-password"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock
                      className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (fieldErrors.password) {
                          setFieldErrors((prev) => ({ ...prev, password: undefined }));
                        }
                      }}
                      placeholder={
                        mode === 'login' ? 'Masukkan password Anda' : 'Minimal 6 karakter'
                      }
                      disabled={isSubmitting}
                      className={`w-full h-11 pl-10 pr-11 rounded-lg border text-sm bg-white text-slate-900 placeholder:text-slate-400 transition-colors ${
                        fieldErrors.password
                          ? 'border-red-400 focus:border-red-500'
                          : 'border-slate-300 focus:border-blue-600'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{fieldErrors.password}</span>
                    </p>
                  )}
                </div>

                {mode === 'register' && (
                  <div>
                    <span className="block text-sm font-medium text-slate-700 mb-1.5">
                      Pilih Role Pengguna
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      {(['USER_A', 'USER_B'] as const).map((roleOption) => {
                        const def = ROLE_DEFINITIONS[roleOption];
                        const isSelected = role === roleOption;
                        return (
                          <button
                            key={roleOption}
                            type="button"
                            onClick={() => setRole(roleOption)}
                            disabled={isSubmitting}
                            className={`p-3 rounded-lg border text-left transition-colors ${
                              isSelected
                                ? 'border-blue-600 bg-blue-50/70 text-slate-900'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold whitespace-nowrap">
                                {def.label}
                              </span>
                              <span className="font-mono text-sm font-bold tabular-nums text-blue-600">
                                {def.baseNumber}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              Angka dasar {def.baseNumber}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-11 mt-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span>
                        {mode === 'login' ? 'Memverifikasi akun...' : 'Membuat akun...'}
                      </span>
                    </>
                  ) : (
                    <span>{mode === 'login' ? 'Masuk' : 'Buat Akun & Masuk'}</span>
                  )}
                </button>
              </form>

              <p className="mt-5 text-xs text-slate-500 text-center">
                {mode === 'login' ? (
                  <>
                    Belum punya akun?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('register')}
                      className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      Daftar akun baru
                    </button>
                  </>
                ) : (
                  <>
                    Sudah memiliki akun?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      Masuk di sini
                    </button>
                  </>
                )}
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
