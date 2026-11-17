import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Calculator,
  CornerDownLeft,
  Equal,
  History,
  Loader2,
  LogOut,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { calculationRepository } from '../services/apiRepository';
import { isFirebaseEnvConfigured } from '../services/firebaseConfig';
import type { CalculationRecord, MathOperator, UserProfile } from '../types/rolecalc';

interface CalculatorDashboardProps {
  user: UserProfile;
  onLogout: () => Promise<void>;
}

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

function formatTimestamp(isoString: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

export default function CalculatorDashboard({ user, onLogout }: CalculatorDashboardProps) {
  const [selectedOperator, setSelectedOperator] = useState<MathOperator | null>(null);
  const [digitInput, setDigitInput] = useState<string>('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<CalculationRecord | null>(null);
  const [isComposing, setIsComposing] = useState<boolean>(false);
  const [history, setHistory] = useState<CalculationRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
  const [isComputing, setIsComputing] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  const digitInputRef = useRef<HTMLInputElement | null>(null);
  const firebaseReady = isFirebaseEnvConfigured();

  useEffect(() => {
    let active = true;
    const loadHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const items = await calculationRepository.listHistory();
        if (active) {
          setHistory(items);
          if (items.length > 0) {
            setLastResult(items[0]);
          }
        }
      } catch (error) {
        if (active) {
          setCalcError(
            error instanceof Error
              ? error.message
              : 'Gagal memuat riwayat perhitungan.'
          );
        }
      } finally {
        if (active) {
          setIsLoadingHistory(false);
        }
      }
    };
    void loadHistory();
    return () => {
      active = false;
    };
  }, [user.uid]);

  const handleOperatorSelect = (operator: MathOperator) => {
    setSelectedOperator(operator);
    setIsComposing(true);
    setInputError(null);
    setCalcError(null);
  };

  const handleDigitSelect = (digit: string) => {
    setDigitInput(digit);
    setIsComposing(true);
    setInputError(null);
    setCalcError(null);
  };

  const handleDigitChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    setCalcError(null);

    if (raw === '') {
      setDigitInput('');
      setIsComposing(true);
      setInputError(null);
      return;
    }

    if (/^[0-9]$/.test(raw)) {
      setDigitInput(raw);
      setIsComposing(true);
      setInputError(null);
      return;
    }

    const lastChar = raw.slice(-1);
    if (/^[0-9]$/.test(lastChar) && raw.length > 1) {
      setDigitInput(lastChar);
      setIsComposing(true);
      setInputError('Input hanya menerima satu digit angka 0 sampai 9.');
      return;
    }

    setInputError('Hanya diperbolehkan satu digit angka 0 sampai 9.');
  };

  const handleResetExpression = () => {
    setSelectedOperator(null);
    setDigitInput('');
    setIsComposing(true);
    setInputError(null);
    setCalcError(null);
  };

  const handleCalculate = async () => {
    setCalcError(null);

    if (!selectedOperator) {
      setInputError('Pilih simbol penjumlahan (+) atau pengurangan (-) terlebih dahulu.');
      return;
    }

    if (!/^[0-9]$/.test(digitInput)) {
      setInputError('Pilih atau ketik satu digit angka selanjutnya (0–9).');
      digitInputRef.current?.focus();
      return;
    }

    const operand = Number.parseInt(digitInput, 10);
    setInputError(null);
    setIsComputing(true);

    try {
      const saved = await calculationRepository.computeAndSave({
        operand,
        operator: selectedOperator,
      });
      setLastResult(saved);
      setIsComposing(false);
      setHistory((prev) => [saved, ...prev]);
    } catch (error) {
      setCalcError(
        error instanceof Error
          ? error.message
          : 'Gagal memproses perhitungan.'
      );
    } finally {
      setIsComputing(false);
    }
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === '+') {
      event.preventDefault();
      handleOperatorSelect('+');
      return;
    }
    if (event.key === '-') {
      event.preventDefault();
      handleOperatorSelect('-');
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      void handleCalculate();
    }
  };

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleCalculate();
  };

  const handleClearHistory = async () => {
    if (history.length === 0 || isClearing) return;
    setIsClearing(true);
    setCalcError(null);
    try {
      await calculationRepository.clearHistory();
      setHistory([]);
    } catch (error) {
      setCalcError(
        error instanceof Error
          ? error.message
          : 'Gagal membersihkan riwayat perhitungan.'
      );
    } finally {
      setIsClearing(false);
    }
  };

  const handleLogoutClick = async () => {
    setIsLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const parsedDigit = /^[0-9]$/.test(digitInput) ? Number.parseInt(digitInput, 10) : null;
  const showComputedResult = Boolean(lastResult && !isComposing);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <span className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <Calculator className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-900">RoleCalc</span>
          </div>

          <nav
            aria-label="Navigasi dashboard"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            <a
              href="#kalkulator"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Kalkulator
            </a>
            <a
              href="#riwayat"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Riwayat
            </a>
            <a
              href="#arsitektur-integrasi"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Integrasi
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleLogoutClick}
              disabled={isLoggingOut}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-60 text-sm font-medium text-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              {isLoggingOut ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogOut className="w-4 h-4" aria-hidden="true" />
              )}
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        <section
          aria-label="Informasi Pengguna dan Peran"
          className="bg-white border border-slate-200 rounded-xl overflow-hidden"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200">
            <div className="px-6 py-5">
              <div className="text-xs font-medium text-slate-500">Pengguna Aktif</div>
              <div className="mt-1 text-base font-semibold text-slate-900 truncate">
                {user.name}
              </div>
              <div className="text-sm text-slate-600 truncate">{user.email}</div>
            </div>

            <div className="px-6 py-5">
              <div className="text-xs font-medium text-slate-500">Role Pengguna</div>
              <div className="mt-1 text-base font-semibold text-slate-900">
                {user.roleLabel}
              </div>
              <div className="text-sm text-slate-600">
                Kode peran <span className="font-mono text-slate-800">{user.role}</span>
              </div>
            </div>

            <div className="px-6 py-5 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-slate-500">Angka Dasar Tetap</div>
                <div className="mt-1 text-sm text-slate-600">
                  Nilai awal permanen milik {user.roleLabel}
                </div>
              </div>
              <div className="text-4xl font-bold font-mono tabular-nums text-blue-600 shrink-0">
                {user.baseNumber}
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <section
            id="kalkulator"
            aria-label="Kalkulator Peran"
            className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-8"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 pb-5 border-b border-slate-200">
              <div>
                <h1 className="text-xl font-bold text-slate-900">Dashboard Kalkulator</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Angka awal <span className="font-mono font-semibold text-slate-700">{user.baseNumber}</span> sudah tetap. Pilih simbol <span className="font-mono font-semibold">+</span>/<span className="font-mono font-semibold">-</span>, masukkan angka <span className="font-mono font-semibold">0–9</span>, lalu tekan <span className="font-semibold text-slate-700">Hitung (=)</span>.
                </p>
              </div>
              {(selectedOperator !== null || digitInput !== '') && (
                <button
                  type="button"
                  onClick={handleResetExpression}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            <div className="mt-6 rounded-xl bg-slate-900 text-white p-6">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                <span>
                  {showComputedResult ? 'Hasil Perhitungan' : 'Ekspresi Saat Ini'}
                </span>
                <span className="font-mono tabular-nums">
                  {showComputedResult && lastResult
                    ? formatTimestamp(lastResult.createdAt)
                    : `Dasar ${user.roleLabel}: ${user.baseNumber}`}
                </span>
              </div>

              {showComputedResult && lastResult ? (
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <div className="font-mono text-2xl sm:text-3xl font-medium tabular-nums text-slate-300">
                    {lastResult.baseNumber} {lastResult.operator} {lastResult.operand} =
                  </div>
                  <div
                    data-testid="calculation-result"
                    className="font-mono text-4xl sm:text-5xl font-bold tabular-nums text-white"
                  >
                    {lastResult.result}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <div className="font-mono text-2xl sm:text-3xl font-medium tabular-nums text-white flex items-center gap-2.5">
                    <span>{user.baseNumber}</span>
                    <span className={selectedOperator ? 'text-blue-400' : 'text-slate-500'}>
                      {selectedOperator ?? '?'}
                    </span>
                    <span className={parsedDigit !== null ? 'text-white' : 'text-slate-500'}>
                      {parsedDigit !== null ? parsedDigit : '?'}
                    </span>
                    <span className="text-slate-400">=</span>
                  </div>
                  <div
                    data-testid="calculation-result"
                    className="font-mono text-4xl sm:text-5xl font-bold tabular-nums text-slate-500"
                  >
                    ?
                  </div>
                </div>
              )}
            </div>

            {calcError && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{calcError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="mt-6 space-y-5">
              <div>
                <span className="block text-sm font-medium text-slate-700 mb-2">
                  1. Angka Dasar &amp; Pilih Simbol Operasi
                </span>
                <div className="grid grid-cols-12 gap-3 items-stretch">
                  <div
                    className="col-span-4 sm:col-span-4 h-12 px-3 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-between gap-2"
                    title="Angka dasar tetap sesuai role"
                  >
                    <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                      Tetap
                    </span>
                    <span className="font-mono text-xl font-bold tabular-nums text-slate-900">
                      {user.baseNumber}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOperatorSelect('+')}
                    disabled={isComputing}
                    aria-pressed={selectedOperator === '+'}
                    className={`col-span-4 sm:col-span-4 h-12 px-4 rounded-lg border text-sm font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
                      selectedOperator === '+'
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-900'
                    }`}
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    <span>Tambah</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOperatorSelect('-')}
                    disabled={isComputing}
                    aria-pressed={selectedOperator === '-'}
                    className={`col-span-4 sm:col-span-4 h-12 px-4 rounded-lg border text-sm font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
                      selectedOperator === '-'
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-900'
                    }`}
                  >
                    <Minus className="w-4 h-4" aria-hidden="true" />
                    <span>Kurang</span>
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="single-digit-input"
                  className="block text-sm font-medium text-slate-700 mb-2"
                >
                  2. Input Angka Selanjutnya (0–9)
                </label>

                <input
                  ref={digitInputRef}
                  id="single-digit-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digitInput}
                  onChange={handleDigitChange}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Ketik 1 digit (0–9) atau pilih tombol di bawah"
                  aria-invalid={Boolean(inputError)}
                  className={`w-full h-12 px-4 rounded-lg border font-mono text-lg font-semibold tabular-nums text-center bg-white text-slate-900 placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:text-slate-400 transition-colors ${
                    inputError
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-slate-300 focus:border-blue-600'
                  }`}
                />

                {inputError ? (
                  <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{inputError}</span>
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-slate-500">
                    Hanya menerima satu digit angka 0 sampai 9.
                  </p>
                )}

                <div
                  aria-label="Tombol angka 0 sampai 9"
                  className="mt-3 grid grid-cols-5 gap-2"
                >
                  {DIGITS.map((digit) => {
                    const isActive = digitInput === digit;
                    return (
                      <button
                        key={digit}
                        type="button"
                        onClick={() => handleDigitSelect(digit)}
                        disabled={isComputing}
                        className={`h-11 rounded-lg border font-mono text-base font-semibold tabular-nums transition-colors ${
                          isActive
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900'
                        }`}
                      >
                        {digit}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isComputing}
                  className="w-full h-12 px-5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {isComputing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span>Menghitung hasil...</span>
                    </>
                  ) : (
                    <>
                      <Equal className="w-4 h-4" aria-hidden="true" />
                      <span>Hitung Hasil</span>
                      <span className="hidden sm:inline-flex items-center gap-1 ml-1 text-xs font-normal text-slate-300">
                        <CornerDownLeft className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Enter</span>
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>

          <section
            id="riwayat"
            aria-label="Riwayat Perhitungan"
            className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" aria-hidden="true" />
                <h2 className="text-base font-semibold text-slate-900">Riwayat Perhitungan</h2>
              </div>

              {history.length > 0 && (
                <button
                  type="button"
                  onClick={() => void handleClearHistory()}
                  disabled={isClearing}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-red-600 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                >
                  {isClearing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>Bersihkan</span>
                </button>
              )}
            </div>

            {isLoadingHistory ? (
              <div className="p-6 space-y-3" aria-busy="true">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-11 rounded-lg bg-slate-100 animate-pulse"
                  />
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm font-medium text-slate-700">
                  Belum ada riwayat perhitungan
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Pilih simbol (+) atau (-), pilih angka 0–9, lalu tekan Hitung Hasil untuk melihat dan menyimpan hasil perhitungan.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 max-h-[460px] overflow-y-auto">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <div className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                        {item.expression}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                        {formatTimestamp(item.createdAt)}
                      </div>
                    </div>
                    <div className="font-mono text-lg font-bold tabular-nums text-blue-600 shrink-0">
                      = {item.result}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section
          id="arsitektur-integrasi"
          className="bg-white border border-slate-200 rounded-xl px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Struktur Integrasi Firebase Authentication &amp; Cloud Firestore
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl">
              Layer kontrak autentikasi dan penyimpanan dipisahkan pada modul layanan agar siap
              dihubungkan ke Firebase Authentication dan koleksi Firestore menggunakan konfigurasi
              environment variables tanpa kredensial tertanam.
            </p>
          </div>
          <div className="text-xs text-slate-600 shrink-0 font-mono">
            {firebaseReady
              ? 'Env Firebase: Terkonfigurasi'
              : 'Env Firebase: Belum diisi (Menggunakan Backend Lokal)'}
          </div>
        </section>
      </main>
    </div>
  );
}
