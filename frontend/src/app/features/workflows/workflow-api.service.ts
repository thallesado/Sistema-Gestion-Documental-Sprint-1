import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface WorkflowPage<T = unknown> { content: T[]; totalElements: number; totalPages: number; number: number; size: number; first: boolean; last: boolean; }
export interface WorkflowStep { id: string; workflow_id: string; template_step_id: string | null; name: string; description: string | null; step_type: string; order_index: number; status: string; result: string | null; started_at: string | null; completed_at: string | null; due_at: string | null; }
export interface WorkflowNode { key: string; name: string; type: string; assignmentType: string | null; assignmentReference: string | null; dueDays: number | null; rules: Record<string, unknown>; }
export interface WorkflowTransition { id?: string; from_stage_id?: string; to_stage_id?: string; name?: string; condition?: Record<string, unknown>; }
export interface WorkflowEdge { from: string; to: string; outcome: string; label: string; }
export type WorkflowTemplateNode = WorkflowNode;
export interface WorkflowTemplate { id?: string; familyId?: string; version?: number; name: string; description: string; category: string; originType: string; active: boolean; publicationStatus?: 'DRAFT'|'ACTIVE'|'INACTIVE'; nodes: WorkflowTemplateNode[]; edges: WorkflowEdge[]; documentStatusRules: Record<string,string>; }
export interface Workflow { id: string; code: string; title: string; status: string; workflow_template_id: string; template_version: number; created_at: string; updated_at: string; metadata?: Record<string, unknown>; }
export interface WorkflowTask { id: string; workflow_id: string; stage_id: string; title: string; status: string; assigned_user_id?: string | null; due_at?: string | null; checklist_results?: Record<string, boolean>; }
export interface WorkflowApproval { id: string; task_id: string; step_id: string; approver_user_id: string; decision: string; decided_at: string; comment: string | null; }
export interface WorkflowComment { id: string; task_id: string | null; author_id: string; comment_text: string; created_at: string; }
@Injectable({ providedIn: 'root' })
export class WorkflowApi {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/workflows';
  page<T = unknown>(resource: string, filters: Record<string, unknown>): Observable<WorkflowPage<T>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) if (value !== null && value !== undefined && value !== '') params = params.set(key, String(value));
    return this.http.get<WorkflowPage<T>>(this.base + resource, { params });
  }
  get<T = unknown>(resource: string, filters?: Record<string, unknown>): Observable<T> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters ?? {})) if (value !== null && value !== undefined && value !== '') params = params.set(key, String(value));
    return this.http.get<T>(this.base + resource, { params });
  }
  post<T = unknown>(resource: string, payload: unknown): Observable<T> { return this.http.post<T>(this.base + resource, payload); }
  put<T = unknown>(resource: string, payload: unknown): Observable<T> { return this.http.put<T>(this.base + resource, payload); }
  deactivate(id: string): Observable<void> { return this.http.delete<void>(this.base + '/templates/' + id); }
  hierarchy(id: number, rank: number): Observable<void> { return this.http.patch<void>(this.base + '/roles/' + id + '/hierarchy', { rank }); }
  readNotice(id: string): Observable<void> { return this.http.patch<void>(this.base + '/notifications/' + id + '/read', {}); }
}
