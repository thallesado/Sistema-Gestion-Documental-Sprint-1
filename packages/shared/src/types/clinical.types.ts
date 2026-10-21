export interface Patient {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  birthDate?: string;
  gender?: string;
  bloodType?: string;
  phone?: string;
  email?: string;
  address?: string;
  insuranceProvider?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MedicalNote {
  id: string;
  tenantId: string;
  clinicalHistoryId: string;
  authorId: string;
  authorName?: string;
  noteType: 'EVOLUTION' | 'CONSULTATION' | 'PROCEDURE' | 'EMERGENCY' | 'DISCHARGE';
  title?: string;
  content: string;
  signedAt: string;
  isSigned: boolean;
}

export interface ClinicalHistory {
  id: string;
  tenantId: string;
  patientId: string;
  historyNumber: string;
  bloodType?: string;
  baseDiagnoses: string[];
  allergies: string[];
  activeMedications: string[];
  openedAt: string;
}

export interface ClinicalSummary {
  patientId: string;
  patientName: string;
  document: string;
  allergies: Array<{ allergen: string; severity?: string }>;
  baseDiagnoses: Array<{ code?: string; description: string }>;
  recentNotes: Array<{ id: string; type: string; content: string; date?: string }>;
}
