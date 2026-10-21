import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AssistantContextSnapshot } from '../assistant/assistant-context';

const API_URL = '/api/v1';

export interface AssistantChatContext extends AssistantContextSnapshot {
  permissions: string[];
}

export interface AssistantChatResponse {
  reply: string;
  model: string;
}

@Injectable({ providedIn: 'root' })
export class AssistantApiService {
  private readonly http = inject(HttpClient);

  chat(message: string, context: AssistantChatContext): Observable<AssistantChatResponse> {
    return this.http.post<AssistantChatResponse>(`${API_URL}/assistant/chat`, { message, context });
  }
}
