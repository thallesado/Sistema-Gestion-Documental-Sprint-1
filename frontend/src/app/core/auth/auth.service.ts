import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap, throwError } from 'rxjs';
import { AuthResponse, AuthUser, LoginRequest } from './auth.types';

const API_URL = 'http://localhost:8080/api/v1';
const TOKEN_KEY = 'nexodocs.access_token';
const REFRESH_TOKEN_KEY = 'nexodocs.refresh_token';
const USER_KEY = 'nexodocs.auth_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  readonly user = signal<AuthUser | null>(this.readUser());
  readonly isAuthenticated = signal(Boolean(this.readToken()));

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API_URL}/auth/login`, request).pipe(
      tap((response) => this.storeTokens(response)),
      tap(() => this.loadCurrentUser()),
    );
  }

  refresh(): Observable<AuthResponse> {
    const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      return throwError(() => new Error('No existe un refresh token'));
    }
    return this.http.post<AuthResponse>(`${API_URL}/auth/refresh`, { refreshToken }).pipe(
      tap((response) => this.storeTokens(response)),
    );
  }

  loadCurrentUser(): void {
    this.http.get<AuthUser>(`${API_URL}/auth/me`).subscribe({
      next: (user) => {
        sessionStorage.setItem(USER_KEY, JSON.stringify(user));
        this.user.set(user);
      },
      error: () => this.clearSession(),
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
    this.isAuthenticated.set(false);
  }

  private readToken(): string | null {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  private readUser(): AuthUser | null {
    const stored = sessionStorage.getItem(USER_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as AuthUser;
    } catch {
      sessionStorage.removeItem(USER_KEY);
      return null;
    }
  }
}
