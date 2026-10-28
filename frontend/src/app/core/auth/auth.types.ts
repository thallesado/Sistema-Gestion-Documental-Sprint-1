export interface AuthResponse {
  token: string;
  tokenType: string;
  refreshToken: string;
  expiresIn: number;
  permissions?: string[];
  /** true si la contraseña es temporal y debe cambiarse antes de usar el sistema. */
  mustChangePassword?: boolean;
}

export interface AuthUser {
  id: string;
  tenantId: string | null;
  tenantName: string | null;
  tenantLogoUrl: string | null;
  platformAdmin: boolean;
  /** Contraseña temporal: el backend bloquea el resto de la API hasta que se cambie. */
  mustChangePassword: boolean;
  roleNames: string[];
  /** Permisos efectivos del usuario (códigos `modulo:accion`) devueltos por /auth/me. */
  permissions: string[];
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
  /** Personalización definida por un administrador (user:customize); solo para usuarios de tenant. */
  customization?: UserCustomization | null;
}

export interface UserCustomization {
  jobTitle: string | null;
  language: 'es' | 'en' | 'fr' | 'zh' | null;
  landingPage: string | null;
  maxUploadMb: number | null;
  storageQuotaMb: number | null;
  /** Vacío = todos los tipos documentales. */
  allowedDocumentTypeIds: string[];
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
