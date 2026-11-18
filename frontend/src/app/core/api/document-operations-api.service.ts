import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface OperationRow { [key: string]: any; id: string; }
export interface OperationPage { content: OperationRow[]; totalElements: number; jobs?: OperationRow[]; }
export function operationError(e: any): string {
  return e?.status === 0 ? 'No se pudo conectar con el servidor.' :
    e?.error?.message || e?.error?.detail || `La operación no pudo completarse (HTTP ${e?.status || 'desconocido'}).`;
}
@Injectable({providedIn:'root'})
export class DocumentOperationsApi {
  private readonly http=inject(HttpClient);
  get<T>(path:string,query:Record<string,string|number>={}):Observable<T>{let params=new HttpParams();for(const [key,value] of Object.entries(query))params=params.set(key,value);return this.http.get<T>('/api/v1/'+path,{params});}
  post<T=OperationRow>(path:string,body:unknown={}):Observable<T>{return this.http.post<T>('/api/v1/'+path,body);}
  put<T=OperationRow>(path:string,body:unknown):Observable<T>{return this.http.put<T>('/api/v1/'+path,body);}
  patch<T=OperationRow>(path:string,body:unknown):Observable<T>{return this.http.patch<T>('/api/v1/'+path,body);}
  delete(path:string):Observable<void>{return this.http.delete<void>('/api/v1/'+path);}
  blob(path:string,body?:unknown):Observable<Blob>{return body===undefined?this.http.get('/api/v1/'+path,{responseType:'blob'}):this.http.post('/api/v1/'+path,body,{responseType:'blob'});}
}
