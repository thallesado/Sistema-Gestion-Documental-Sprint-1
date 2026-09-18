package com.lta.gestdocum.backend.security;

import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final AccessTokenRevocationChecker accessTokenRevocationChecker;

    public JwtAuthenticationFilter(JwtService jwtService,
                                   AccessTokenRevocationChecker accessTokenRevocationChecker) {
        this.jwtService = jwtService;
        this.accessTokenRevocationChecker = accessTokenRevocationChecker;
    }

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) throws ServletException {
        String path = request.getRequestURI();
        return path.equals("/api/v1/auth/login") ||
               path.startsWith("/swagger-ui") || 
               path.startsWith("/v3/api-docs");
    }

    @Override
    protected void doFilterInternal(
           @NonNull HttpServletRequest request,
           @NonNull HttpServletResponse response,
           @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        
        final String authHeader = request.getHeader("Authorization");
        final String jwt;
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        jwt = authHeader.substring(7);
        try {
            AuthenticatedUser user = jwtService.extractAuthenticatedUser(jwt);
            if (SecurityContextHolder.getContext().getAuthentication() == null) {
                UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                        user,
                        null,
                        user.authorities().stream().map(SimpleGrantedAuthority::new).toList()
                );
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
                if (accessTokenRevocationChecker.isRevoked(user, jwt)) {
                    SecurityContextHolder.clearContext();
                }
            }
        } catch (JwtException | IllegalArgumentException ignored) {
            // Un JWT inválido queda sin autenticación y Security devuelve 401.
        }
        filterChain.doFilter(request, response);
    }
}