import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthResponse } from '../../core/auth/auth.types';

const API_URL = '/api/v1/auth';

export interface RecoveryMessage {
  message: string;
}

@Injectable({ providedIn: 'root' })
export class PasswordRecoveryService {
  private readonly http = inject(HttpClient);

  requestRecovery(tenantId: string, email: string): Observable<RecoveryMessage> {
    return this.http.post<RecoveryMessage>(`${API_URL}/forgot-password`, { tenantId, email });
  }

  resetPassword(token: string, newPassword: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API_URL}/reset-password`, { token, newPassword });
  }
}
