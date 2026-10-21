import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';

@Injectable({providedIn:'root'})
export class BackupMaintenanceService {
 private readonly http=inject(HttpClient); private readonly auth=inject(AuthService);
 readonly restoring=signal(false);
 constructor(){const timer=window.setInterval(()=>this.refresh(),5000);inject(DestroyRef).onDestroy(()=>clearInterval(timer));}
 refresh():void{if(!this.auth.isAuthenticated()){this.restoring.set(false);return;}this.http.get<{restoring:boolean}>('/api/v1/backups/maintenance').subscribe({next:r=>this.restoring.set(r.restoring),error:()=>{/* Preserve last confirmed status on connection failure. */}});}
}
