import { Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AssistantApiService } from '../../../core/api/assistant-api.service';
import { AssistantContextService } from '../../../core/assistant/assistant-context.service';
import { AssistantSuggestion, suggestionFor } from '../../../core/assistant/assistant-suggestions';
import { PermissionService } from '../../../core/auth/permission.service';

interface ChatMessage {
  from: 'user' | 'assistant';
  text: string;
}

const MAX_MESSAGE_LENGTH = 1000;

/**
 * Contextual assistant bubble (task H2). Sends each question with the current route, recent navigation,
 * last failed request and the user's permissions, and offers help on its own when a request fails.
 */
@Component({
  selector: 'app-assistant-widget',
  imports: [FormsModule],
  template: `
    @if (suggestion() && !isOpen()) {
      <div class="assistant-hint" role="status">
        <p>{{ suggestion()!.message }}</p>
        <div class="assistant-hint-actions">
          <button type="button" class="primary" (click)="askAbout(suggestion()!)">Ayúdame</button>
          <button type="button" (click)="dismissSuggestion()">Ahora no</button>
        </div>
      </div>
    }

    @if (isOpen()) {
      <section class="assistant-panel" role="dialog" aria-label="Asistente">
        <header>
          <h2>Asistente</h2>
          <button type="button" (click)="isOpen.set(false)" aria-label="Cerrar el asistente">✕</button>
        </header>
        <div class="assistant-messages" #messageList>
          @if (messages().length === 0) {
            <p class="assistant-empty">Pregúntame cómo hacer algo en NexoDocs, por ejemplo "¿cómo indexo un documento?".</p>
          }
          @for (message of messages(); track $index) {
            <p class="assistant-message" [class.from-user]="message.from === 'user'">{{ message.text }}</p>
          }
          @if (sending()) {
            <p class="assistant-message">Escribiendo…</p>
          }
        </div>
        <form (ngSubmit)="send()">
          <input name="draft" [(ngModel)]="draft" [maxlength]="maxLength" placeholder="Escribe tu pregunta" autocomplete="off" aria-label="Pregunta para el asistente" />
          <button type="submit" class="primary" [disabled]="sending() || !draft.trim()">Enviar</button>
        </form>
      </section>
    }

    <button type="button" class="assistant-bubble" (click)="toggle()" [attr.aria-expanded]="isOpen()" aria-label="Abrir el asistente">?</button>
  `,
  styles: [`
    .assistant-bubble { background: #087f7b; border: 0; border-radius: 50%; bottom: 20px; box-shadow: 0 6px 18px rgba(10, 50, 48, 0.25); color: #fff; cursor: pointer; font-size: 22px; font-weight: 700; height: 52px; position: fixed; right: 20px; width: 52px; z-index: 950; }
    .assistant-panel, .assistant-hint { background: #fff; border: 1px solid #dcebe8; border-radius: 12px; bottom: 84px; box-shadow: 0 8px 24px rgba(10, 50, 48, 0.18); position: fixed; right: 20px; width: min(360px, calc(100vw - 32px)); z-index: 950; }
    .assistant-panel { display: flex; flex-direction: column; max-height: min(520px, calc(100vh - 120px)); }
    .assistant-panel header { align-items: center; border-bottom: 1px solid #dcebe8; display: flex; justify-content: space-between; padding: 10px 14px; }
    .assistant-panel h2 { font-size: 15px; margin: 0; }
    .assistant-panel header button { background: transparent; border: 0; cursor: pointer; font-size: 16px; padding: 4px 8px; }
    .assistant-messages { display: flex; flex: 1; flex-direction: column; gap: 8px; overflow-y: auto; padding: 12px 14px; }
    .assistant-empty { color: #557774; font-size: 13px; margin: 0; }
    .assistant-message { align-self: flex-start; background: #eef6f5; border-radius: 10px; font-size: 13px; margin: 0; max-width: 85%; padding: 8px 10px; white-space: pre-wrap; }
    .assistant-message.from-user { align-self: flex-end; background: #087f7b; color: #fff; }
    .assistant-panel form { border-top: 1px solid #dcebe8; display: flex; gap: 8px; padding: 10px 14px; }
    .assistant-panel input { border: 1px solid #c9dedb; border-radius: 8px; flex: 1; font-size: 13px; min-width: 0; padding: 8px; }
    .assistant-hint { padding: 12px 14px; }
    .assistant-hint p { font-size: 13px; margin: 0 0 10px; }
    .assistant-hint-actions { display: flex; gap: 8px; justify-content: flex-end; }
    button.primary { background: #087f7b; color: #fff; }
    .assistant-hint button, .assistant-panel form button { border: 1px solid #087f7b; border-radius: 8px; cursor: pointer; font-size: 13px; padding: 6px 12px; }
    .assistant-hint button:not(.primary) { background: #fff; color: #087f7b; }
    button:disabled { cursor: default; opacity: 0.6; }
  `],
})
export class AssistantWidget {
  private readonly api = inject(AssistantApiService);
  private readonly context = inject(AssistantContextService);
  private readonly permissions = inject(PermissionService);
  private readonly messageList = viewChild<ElementRef<HTMLElement>>('messageList');

  readonly maxLength = MAX_MESSAGE_LENGTH;
  readonly isOpen = signal(false);
  readonly sending = signal(false);
  readonly messages = signal<ChatMessage[]>([]);
  readonly suggestion = signal<AssistantSuggestion | null>(null);
  draft = '';

  constructor() {
    effect(() => this.suggestion.set(suggestionFor(this.context.lastError())));
    effect(() => {
      this.messages();
      const list = this.messageList()?.nativeElement;
      if (list) queueMicrotask(() => (list.scrollTop = list.scrollHeight));
    });
  }

  toggle(): void {
    this.isOpen.update((open) => !open);
  }

  dismissSuggestion(): void {
    this.suggestion.set(null);
  }

  askAbout(suggestion: AssistantSuggestion): void {
    this.suggestion.set(null);
    this.isOpen.set(true);
    this.ask(suggestion.question);
  }

  send(): void {
    const text = this.draft.trim();
    if (!text || this.sending()) return;
    this.draft = '';
    this.ask(text);
  }

  private ask(text: string): void {
    this.messages.update((messages) => [...messages, { from: 'user', text }]);
    this.sending.set(true);
    const context = { ...this.context.snapshot(), permissions: [...this.permissions.permissions()] };
    this.api.chat(text.slice(0, MAX_MESSAGE_LENGTH), context).subscribe({
      next: (response) => this.reply(response.reply || 'No tengo una respuesta para eso. Prueba con el centro de ayuda.'),
      error: (error: unknown) => this.reply(errorReply(error)),
    });
  }

  private reply(text: string): void {
    this.messages.update((messages) => [...messages, { from: 'assistant', text }]);
    this.sending.set(false);
  }
}

function errorReply(error: unknown): string {
  const status = error instanceof HttpErrorResponse ? error.status : -1;
  if (status === 429) return 'Hiciste muchas preguntas seguidas. Espera un minuto y vuelve a intentarlo.';
  if (status === 503) return 'El asistente no está disponible en este momento. Usa el centro de ayuda.';
  return 'No pude responder ahora. Intenta nuevamente en unos segundos.';
}
