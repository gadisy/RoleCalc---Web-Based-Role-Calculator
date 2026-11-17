export type UserRole = 'USER_A' | 'USER_B';

export type MathOperator = '+' | '-';

export interface RoleDefinition {
  role: UserRole;
  label: string;
  baseNumber: number;
  description: string;
}

export const ROLE_DEFINITIONS: Record<UserRole, RoleDefinition> = {
  USER_A: {
    role: 'USER_A',
    label: 'User A',
    baseNumber: 5,
    description: 'Peran standar dengan angka dasar tetap 5 untuk setiap operasi hitung.',
  },
  USER_B: {
    role: 'USER_B',
    label: 'User B',
    baseNumber: 7,
    description: 'Peran lanjutan dengan angka dasar tetap 7 untuk setiap operasi hitung.',
  },
};

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  baseNumber: number;
  createdAt: string;
}

export interface CalculationRecord {
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

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface AuthSessionResult {
  user: UserProfile;
  token: string;
}

export interface ComputeCalculationPayload {
  operand: number;
  operator: MathOperator;
}
