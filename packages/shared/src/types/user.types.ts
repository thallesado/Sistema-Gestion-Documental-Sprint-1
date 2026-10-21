export type UserRole =
  | 'Usuario basico'
  | 'Supervisor'
  | 'Administrador de tenant'
  | 'Superadministrador';

export interface User {
  id: string;
  tenantId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  isBlocked: boolean;
  departmentId?: string;
  createdAt: string;
}

export interface Tenant {
  id: string;
  code: string;
  name: string;
  slug: string;
  email: string;
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELED';
  storageLimitBytes?: number;
}
