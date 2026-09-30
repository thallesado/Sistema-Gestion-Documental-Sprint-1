import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { PublicTenant } from '../../../core/auth/auth.types';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.page.html',
  styleUrl: './login.page.css',
})
export class LoginPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly tenants = signal<PublicTenant[]>([]);
  readonly tenantsLoading = signal(true);
  readonly tenantsError = signal('');
  tenantId: string | null = null;

  username = '';
  password = '';

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly showPassword = signal(false);

  ngOnInit(): void {
    this.auth.publicTenants().subscribe({
      next: (list) => {
        this.tenants.set(list);
        this.tenantsLoading.set(false);
      },
      error: (error: { status?: number }) => {
        this.tenantsError.set(
          error?.status === 429
            ? 'Demasiadas solicitudes. Espera un minuto e inténtalo de nuevo.'
            : 'No se pudo cargar la lista de organizaciones.'
        );
        this.tenantsLoading.set(false);
      },
    });
  }

  submitLogin(): void {
    if (!this.username.trim() || !this.password) {
      this.errorMessage.set('Por favor completa todos los campos requeridos.');
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);

    this.auth.login({
      usernameOrEmail: this.username.trim(),
      password: this.password,
      tenantId: this.tenantId,
    }).subscribe({
      next: () => {
        this.loading.set(false);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
        void this.router.navigateByUrl(returnUrl);
      },
      error: (err: { status?: number; error?: { message?: string } }) => {
        this.loading.set(false);
        this.errorMessage.set(
          err?.error?.message
            || (err?.status === 401
              ? 'Las credenciales ingresadas no son válidas.'
              : 'Error al conectar con el servidor. Intenta nuevamente.')
        );
      },
    });
  }
}
