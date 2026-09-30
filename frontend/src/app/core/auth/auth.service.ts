import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, shareReplay, tap, throwError } from 'rxjs';
import { AuthResponse, AuthUser, LoginRequest, NotificationPreferencesRequest, ProfileUpdateRequest, PublicTenant } from './auth.types';

const API_URL = '/api/v1';
const TOKEN_KEY = 'nexodocs.access_token';
const REFRESH_TOKEN_KEY = 'nexodocs.refresh_token';
const USER_KEY = 'nexodocs.auth_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  readonly user = signal<AuthUser | null>(this.readUser());
  readonly avatarUrl = signal<string | null>(null);
  readonly isAuthenticated = signal(Boolean(this.readToken()));
  private refreshInFlight: Observable<AuthResponse> | null = null;

  constructor() {
    if (this.accessToken()) {
      // Conserva la sesión existente mientras se vuelve a validar la identidad
      // y los roles con el servidor. Las mismas claves de sessionStorage se
      // mantienen para no invalidar sesiones creadas por versiones anteriores.
      this.loadCurrentUser();
    } else if (this.user()) {
      this.clearSession();
    }
  }

  /** Organizaciones que pueden iniciar sesión; endpoint público (no requiere token). */
  publicTenants(): Observable<PublicTenant[]> {
    return this.http.get<PublicTenant[]>(`${API_URL}/tenants/public`);
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    const urlExacta = `${API_URL}/auth/login`;
    console.log('URL de login:', urlExacta);
    return this.http.post<AuthResponse>(urlExacta, request).pipe(
      tap((response) => this.storeTokens(response)),
      tap(() => this.loadCurrentUser()),
      catchError((error: HttpErrorResponse) => {
        console.error('Error real del servidor:', error);
        return throwError(() => error);
      }),
    );
  }

  refresh(): Observable<AuthResponse> {
    const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      return throwError(() => new Error('No existe un refresh token'));
    }
    return this.http.post<AuthResponse>(`${API_URL}/auth/refresh`, { refreshToken }).pipe(
      tap((response) => this.storeTokens(response)),
      tap(() => this.loadCurrentUser()),
    );
  }

  refreshOnce(): Observable<AuthResponse> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.refresh().pipe(
        finalize(() => this.refreshInFlight = null),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.refreshInFlight;
  }

  loadCurrentUser(): void {
    if (!this.accessToken()) {
      this.clearSession();
      return;
    }
    this.http.get<AuthUser>(`${API_URL}/auth/me`).subscribe({
      next: (user) => {
        this.setCurrentUser(user);
        this.loadAvatar(user.hasAvatar);
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 401 || error.status === 403) {
          this.clearSession();
        }
      },
    });
  }

  logout(): void {
    const token = this.accessToken();
    const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);
    const finish = () => {
      this.clearSession();
      void this.router.navigateByUrl('/login');
    };
    if (!token) {
      finish();
      return;
    }
    this.http.post<void>(`${API_URL}/auth/logout`, { refreshToken }).subscribe({
      next: finish,
      error: finish,
    });
  }

  accessToken(): string | null {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  establishSession(response: AuthResponse): void {
    this.storeTokens(response);
    this.loadCurrentUser();
  }

  updateProfile(request: ProfileUpdateRequest): Observable<AuthUser> {
    return this.http.put<AuthUser>(`${API_URL}/auth/me`, request).pipe(
      tap((user) => this.setCurrentUser(user)),
    );
  }

  uploadAvatar(file: File): Observable<AuthUser> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<AuthUser>(`${API_URL}/auth/me/avatar`, body).pipe(
      tap((user) => {
        this.setCurrentUser(user);
        this.loadAvatar(true);
      }),
    );
  }

  updateNotificationPreferences(request: NotificationPreferencesRequest): Observable<AuthUser> {
    return this.http.put<AuthUser>(`${API_URL}/auth/me/notifications`, request).pipe(
      tap((user) => this.setCurrentUser(user)),
    );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.put<void>(`${API_URL}/auth/me/password`, { currentPassword, newPassword });
  }

  private storeTokens(response: AuthResponse): void {
    sessionStorage.setItem(TOKEN_KEY, response.token);
    sessionStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
    this.isAuthenticated.set(true);
  }

  private clearSession(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    this.user.set(null);
    this.clearAvatarUrl();
    this.isAuthenticated.set(false);
  }

  private readToken(): string | null {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  private readUser(): AuthUser | null {
    const stored = sessionStorage.getItem(USER_KEY);
    if (!stored) return null;
    try {
      const parsed: unknown = JSON.parse(stored);
      if (!parsed || typeof parsed !== 'object') throw new Error('Usuario de sesión inválido');
      const user = parsed as Partial<AuthUser>;
      if (typeof user.id !== 'string' || typeof user.username !== 'string' || typeof user.email !== 'string') {
        throw new Error('Usuario de sesión incompleto');
      }
      return {
        id: user.id,
        tenantId: typeof user.tenantId === 'string' ? user.tenantId : null,
        tenantName: typeof user.tenantName === 'string' ? user.tenantName : null,
        platformAdmin: user.platformAdmin === true,
        roleNames: Array.isArray(user.roleNames)
          ? user.roleNames.filter((role): role is string => typeof role === 'string')
          : [],
        username: user.username,
        email: user.email,
        firstName: typeof user.firstName === 'string' ? user.firstName : '',
        lastName: typeof user.lastName === 'string' ? user.lastName : '',
        status: typeof user.status === 'string' ? user.status : '',
        phone: typeof user.phone === 'string' ? user.phone : null,
        biography: typeof user.biography === 'string' ? user.biography : null,
        hasAvatar: user.hasAvatar === true,
        emailNotifications: user.emailNotifications !== false,
        pushNotifications: user.pushNotifications !== false,
      };
    } catch {
      sessionStorage.removeItem(USER_KEY);
      return null;
    }
  }

  private setCurrentUser(user: AuthUser): void {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    this.user.set(user);
  }

  private loadAvatar(hasAvatar: boolean): void {
    this.clearAvatarUrl();
    if (!hasAvatar || !this.accessToken()) return;
    this.http.get(`${API_URL}/auth/me/avatar`, { responseType: 'blob' }).subscribe({
      next: (avatar) => this.avatarUrl.set(URL.createObjectURL(avatar)),
      error: () => this.avatarUrl.set(null),
    });
  }

  private clearAvatarUrl(): void {
    const current = this.avatarUrl();
    if (current) URL.revokeObjectURL(current);
    this.avatarUrl.set(null);
  }
}
