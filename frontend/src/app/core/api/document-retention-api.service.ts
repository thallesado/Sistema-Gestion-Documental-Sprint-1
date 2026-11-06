import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
export interface RetentionPolicy { id:string; name:string; retention_months:number|null; disposition_action:string; is_active:boolean; type_count:number; }
export interface RetentionType { id:string; name:string; code:string; retention_policy_id:string|null; }
export interface RetentionDocument { id:string; name:string|null; code:string|null; status:string; archive_level:string; type_name:string; policy_name:string; retention_months:number; disposition_action:string; period_start:string; eligible_on:string; workflow_active:boolean; }
export interface DocumentTransfer { id:string; document_id:string; name:string|null; code:string|null; from_level:string; to_level:string; status:string; reason:string; eligible_on:string; requested_at:string; approved_at:string|null; executed_at:string|null; requested_by:string; approved_by:string|null; executed_by:string|null; }
@Injectable({providedIn:'root'})
export class DocumentRetentionApi {
  private http=inject(HttpClient); private base='/api/v1';
  policies(){return this.http.get<RetentionPolicy[]>(this.base+'/retention-policies');}
  types(){return this.http.get<RetentionType[]>(this.base+'/retention-policies/types');}
  due(days:number){return this.http.get<RetentionDocument[]>(this.base+'/retention-policies/due',{params:{days}});}
  save(id:string|null,body:{name:string;retentionMonths:number|null;action:string;active:boolean;indefinite:boolean}){return id?this.http.put(this.base+'/retention-policies/'+id,body):this.http.post(this.base+'/retention-policies',body);}
  remove(id:string){return this.http.delete(this.base+'/retention-policies/'+id);}
  assign(id:string,policyId:string|null){return this.http.put(this.base+'/retention-policies/types/'+id,{policyId});}
  candidates(){return this.http.get<RetentionDocument[]>(this.base+'/document-transfers/candidates');}
  transfers(){return this.http.get<DocumentTransfer[]>(this.base+'/document-transfers');}
  request(documentId:string,toLevel:string,reason:string){return this.http.post(this.base+'/document-transfers',{documentId,toLevel,reason});}
  advance(id:string,action:'approve'|'execute'){return this.http.post(this.base+'/document-transfers/'+id+'/'+action,{});}
}
