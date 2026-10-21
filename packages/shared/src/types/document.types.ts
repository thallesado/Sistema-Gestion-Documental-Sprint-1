export type DocumentStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CURRENT'
  | 'ARCHIVED'
  | 'VOIDED'
  | 'TRASHED';

export interface Document {
  id: string;
  tenantId: string;
  expedientId?: string;
  documentTypeId: string;
  code: string;
  name: string;
  description?: string;
  status: DocumentStatus;
  currentVersion?: number;
  issueDate?: string;
  expiryDate?: string;
  responsibleUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersion {
  id: string;
  tenantId: string;
  documentId: string;
  versionNumber: number;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  storagePath: string;
  checksumSha256: string;
  changeReason?: string;
  uploadedBy: string;
  createdAt: string;
}

export interface DocumentType {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  category?: string;
  description?: string;
}
