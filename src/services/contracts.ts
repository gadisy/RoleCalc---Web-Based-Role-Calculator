import type {
  CalculationRecord,
  ComputeCalculationPayload,
  LoginPayload,
  RegisterPayload,
  UserProfile,
} from '../types/rolecalc';

/**
 * Kontrak autentikasi untuk memisahkan UI dari provider backend.
 * Dapat diimplementasikan menggunakan API Server saat ini atau Firebase Authentication.
 */
export interface AuthRepository {
  getCurrentUser(): Promise<UserProfile | null>;
  login(payload: LoginPayload): Promise<UserProfile>;
  register(payload: RegisterPayload): Promise<UserProfile>;
  logout(): Promise<void>;
}

/**
 * Kontrak penyimpanan kalkulasi yang selaras dengan struktur dokumen Cloud Firestore
 * pada koleksi `calculations/{calcId}`.
 */
export interface CalculationRepository {
  listHistory(): Promise<CalculationRecord[]>;
  computeAndSave(payload: ComputeCalculationPayload): Promise<CalculationRecord>;
  clearHistory(): Promise<void>;
}
