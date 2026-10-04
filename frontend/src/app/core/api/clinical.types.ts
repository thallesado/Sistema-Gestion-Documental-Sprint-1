export interface Page<T> {
  content: T[];
  pageable: {
    pageNumber: number;
    pageSize: number;
  };
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface PatientResponse {
  id: string;
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: string;
  phone?: string;
  email?: string;
  status: string;
}

export interface AllergyRequest {
  allergen: string;
  severity: string;
  reaction?: string;
}

export interface MedicationRequest {
  name: string;
  dose?: string;
  frequency?: string;
}

export interface ClinicalHistoryRequest {
  patientId: string;
  bloodType?: string;
  pathologicalAntecedents?: string;
  nonPathologicalAntecedents?: string;
  familyAntecedents?: string;
  allergies?: AllergyRequest[];
  chronicConditions?: string;
  currentMedications?: MedicationRequest[];
  observations?: string;
}

export interface ClinicalHistoryResponse {
  id: string;
  patientId: string;
  code: string;
  patientFirstName: string;
  patientLastName: string;
  patientDocumentNumber: string;
  bloodType?: string;
  pathologicalAntecedents?: string;
  nonPathologicalAntecedents?: string;
  familyAntecedents?: string;
  allergies?: AllergyRequest[];
  chronicConditions?: string;
  currentMedications?: MedicationRequest[];
  observations?: string;
  createdAt: string;
  updatedAt: string;
}

export type MedicalNoteStatus = 'DRAFT' | 'APPROVED' | 'VOIDED';

export interface MedicalNoteResponse {
  id: string;
  clinicalHistoryId: string;
  episodeId?: string;
  authorId: string;
  noteType: string;
  content: string;
  status: MedicalNoteStatus;
  createdAt: string;
}

export interface MedicalNoteRequest {
  clinicalHistoryId: string;
  episodeId?: string;
  noteType: string;
  content: string;
  status?: MedicalNoteStatus;
}

