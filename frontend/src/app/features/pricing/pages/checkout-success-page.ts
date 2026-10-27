import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, switchMap, takeWhile, timer } from 'rxjs';

type SignupStatus = 'PENDING' | 'PROVISIONING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

interface SubscriptionStatus {
  status: SignupStatus;
  tenantName: string;
  tenantId: string | null;
  message: string;
}

const POLL_INTERVAL_MS = 3000;
const POLL_LIMIT = 60; // 3 minutos

/**
 * Retorno desde Stripe Checkout. session_id solo prueba que el cliente volvió; el estado válido es el
 * que escribe el webhook (o la consulta del backend a Stripe), por eso se consulta hasta COMPLETED.
 */
@Component({
  selector: 'app-checkout-success-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="checkout-result">
      <section class="result-card" aria-live="polite">
        @if (error()) {
          <div class="icon warn">!</div>
          <h1>No pudimos consultar tu pago</h1>
          <p>{{ error() }}</p>
          <button type="button" class="primary" (click)="start()">Reintentar</button>
        } @else if (status()?.status === 'COMPLETED') {
          <div class="icon ok">✓</div>
          <h1>¡{{ status()!.tenantName }} está lista!</h1>
          <p>{{ status()!.message }}</p>
          <a class="primary" routerLink="/login" [queryParams]="{ tenant: status()!.tenantId }">Iniciar sesión</a>
        } @else if (status()?.status === 'EXPIRED') {
          <div class="icon warn">!</div>
          <h1>El pago no se completó</h1>
          <p>{{ status()!.message }}</p>
          <a class="primary" routerLink="/planes">Ver planes</a>
        } @else if (timedOut()) {
          <div class="icon warn">…</div>
          <h1>Seguimos esperando la confirmación</h1>
          <p>Stripe aún no confirmó el pago. Si ya pagaste, la organización se creará en cuanto llegue la confirmación.</p>
          <button type="button" class="primary" (click)="start()">Volver a consultar</button>
        } @else {
          <div class="spinner" aria-hidden="true"></div>
          <h1>Confirmando tu pago…</h1>
          <p>{{ status()?.message || 'Esperando la confirmación del pago de Stripe.' }}</p>
        }
      </section>
    </main>
  `,
  styles: [`
    .checkout-result { min-height: 100vh; display: grid; place-items: center; padding: 16px; background: #f5fbf8; color: #173f38; }
    .result-card { width: min(480px, 100%); background: #fff; border-radius: 18px; padding: 40px 28px; text-align: center; box-shadow: 0 20px 55px #0b423222; }
    h1 { font-size: 1.4rem; margin: 0 0 .5rem; color: #0f172a; }
    p { color: #475569; line-height: 1.5; margin: 0 0 1.5rem; }
    .icon { width: 60px; height: 60px; margin: 0 auto 1rem; border-radius: 50%; display: grid; place-items: center; font-size: 2rem; font-weight: 800; }
    .icon.ok { background: #ecfdf5; color: #059669; }
    .icon.warn { background: #fffbeb; color: #b45309; }
    .spinner { width: 44px; height: 44px; margin: 0 auto 1rem; border: 4px solid #d1fae5; border-top-color: #087f7b; border-radius: 50%; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .primary { display: inline-block; background: #087f7b; color: #fff; border: 0; border-radius: 10px; padding: .8rem 1.5rem; font: 700 .95rem inherit; text-decoration: none; cursor: pointer; }
  `],
})
export class CheckoutSuccessPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<SubscriptionStatus | null>(null);
  readonly error = signal('');
  readonly timedOut = signal(false);
  private polling?: Subscription;

  ngOnInit(): void {
    this.start();
  }

  start(): void {
    const sessionId = this.route.snapshot.queryParamMap.get('session_id');
    this.error.set('');
    this.timedOut.set(false);
    if (!sessionId) {
      this.error.set('Falta la referencia de la sesión de pago.');
      return;
    }
    this.polling?.unsubscribe();
    let attempts = 0;
    this.polling = timer(0, POLL_INTERVAL_MS)
      .pipe(
        switchMap(() => this.http.get<SubscriptionStatus>(`/api/v1/public/subscriptions/checkout/${encodeURIComponent(sessionId)}/status`)),
        takeWhile((result) => result.status !== 'COMPLETED' && result.status !== 'EXPIRED' && ++attempts < POLL_LIMIT, true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.status.set(result);
          if (attempts >= POLL_LIMIT && result.status !== 'COMPLETED' && result.status !== 'EXPIRED') this.timedOut.set(true);
        },
        error: (err) => this.error.set(err?.error?.message || 'Inténtalo de nuevo en unos segundos.'),
      });
  }
}
