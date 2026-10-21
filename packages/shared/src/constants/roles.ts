export const ROLES = {
  BASIC_USER: 'Usuario basico',
  SUPERVISOR: 'Supervisor',
  TENANT_ADMIN: 'Administrador de tenant',
  SUPER_ADMIN: 'Superadministrador',
} as const;

export const CLINICAL_PERMISSIONS = {
  PATIENT_CREATE: 'patient:create',
  PATIENT_READ: 'patient:read',
  PATIENT_UPDATE: 'patient:update',
  MEDICAL_NOTE_CREATE: 'medical_note:create',
  MEDICAL_NOTE_READ: 'medical_note:read',
} as const;
