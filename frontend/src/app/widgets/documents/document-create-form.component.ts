import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiDocumentType, DocumentCreatePayload } from '../../core/api/document-api.service';
import { UserSelectorComponent } from '../../shared';

@Component({
  selector: 'app-document-create-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, UserSelectorComponent],
  template: `
    <form class="panel create-form" (ngSubmit)="submit.emit()" style="margin-bottom: 22px;">
      <h2>{{ isUploadRoute() ? 'Subir archivo' : 'Nuevo documento' }}</h2>
      <p class="form-note">Los metadatos se crean en el tenant autenticado. El responsable se envía como identificador, nunca como texto libre.</p>
      @if (createError()) { <div class="notice error" role="alert">{{ createError() }}</div> }
      <div class="form-grid">
        <label>Nombre<input name="documentName" [(ngModel)]="form().name" required maxlength="255" /></label>
        <label>Código<input name="documentCode" [(ngModel)]="form().code" required maxlength="60" /></label>
        <label>Tipo documental
          <select name="documentTypeId" [(ngModel)]="form().documentTypeId" required>
            <option value="">Selecciona un tipo</option>
            @for (type of types(); track type.id) { <option [value]="type.id">{{ type.name }} · {{ type.code }}</option> }
          </select>
        </label>
        <label>Expediente (opcional)<input name="expedientId" [(ngModel)]="form().expedientId" placeholder="UUID del expediente" /></label>
        <label>Fecha de emisión<input type="date" name="issueDate" [(ngModel)]="form().issueDate" /></label>
        <label>Fecha de vencimiento<input type="date" name="expiryDate" [(ngModel)]="form().expiryDate" /></label>
        <app-user-selector label="Responsable (opcional)" [(value)]="form().responsibleUserId" />
        <label class="full-width">Descripción<textarea name="description" rows="4" [(ngModel)]="form().description" maxlength="10000"></textarea></label>
        @if (isUploadRoute()) {
          <label class="full-width">Archivo inicial
            <input type="file" name="initialFile" accept=".pdf,.png,.jpg,.jpeg,.docx" (change)="fileChange.emit($event)" />
            <small class="form-note">El archivo se almacena como una nueva versión después de crear los metadatos.</small>
          </label>
        }
      </div>
      <div class="form-actions">
        <a routerLink="/documents" class="secondary-action">Cancelar</a>
        <button class="primary-action" type="submit" [disabled]="creating() || !form().name.trim() || !form().code.trim() || !form().documentTypeId || (isUploadRoute() && !hasFile())">
          {{ creating() ? 'Guardando…' : (isUploadRoute() ? 'Crear y subir' : 'Crear documento') }}
        </button>
      </div>
    </form>
  `
})
export class DocumentCreateFormComponent {
  readonly form = input.required<DocumentCreatePayload>();
  readonly types = input<ApiDocumentType[]>([]);
  readonly isUploadRoute = input<boolean>(false);
  readonly creating = input<boolean>(false);
  readonly createError = input<string | null>(null);
  readonly hasFile = input<boolean>(false);

  readonly submit = output<void>();
  readonly fileChange = output<Event>();
}
