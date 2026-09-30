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
  phone: string | null;
  biography: string | null;
  hasAvatar: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
}

export interface ProfileUpdateRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  biography: string;
}

export interface NotificationPreferencesRequest {
  emailNotifications: boolean;
  pushNotifications: boolean;
}

export interface LoginRequest {
  tenantId: string | null;
  usernameOrEmail: string;
  password: string;
}

export interface PublicTenant {
  id: string;
  name: string;
}
