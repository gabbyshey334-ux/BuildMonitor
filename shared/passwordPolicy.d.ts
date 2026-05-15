export declare const PASSWORD_MIN_LENGTH: 8;

export interface PasswordChecks {
  length: boolean;
  lowercase: boolean;
  uppercase: boolean;
  digit: boolean;
  symbol: boolean;
}

export function getPasswordChecks(password: string): PasswordChecks;
export function isPasswordValid(password: string): boolean;
export function validatePassword(password: string): {
  valid: boolean;
  message?: string;
  checks: PasswordChecks;
};
export function getPasswordStrength(password: string): {
  score: number;
  labelKey: string;
  color: string;
};
