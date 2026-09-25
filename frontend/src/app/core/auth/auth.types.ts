export interface AuthResponse {
  token: string;
  tokenType: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthUser {
  id: string;
  tenantId: string | null;
  tenantName: string | null;
  platformAdmin: boolean;
  roleNames: string[];
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
}

export interface LoginRequest {
  tenantId: string | null;
  usernameOrEmail: string;
  password: string;
}
