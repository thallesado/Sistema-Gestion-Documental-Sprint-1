export interface AuthResponse {
  token: string;
  tokenType: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthUser {
  id: string;
  tenantId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
}

export interface LoginRequest {
  tenantId: string;
  usernameOrEmail: string;
  password: string;
}
