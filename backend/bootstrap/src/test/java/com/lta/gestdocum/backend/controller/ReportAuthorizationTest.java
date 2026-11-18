package com.lta.gestdocum.backend.controller;

import org.junit.jupiter.api.Test;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.security.access.expression.SecurityExpressionRoot;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.AuthenticationTrustResolverImpl;
import org.springframework.security.authentication.TestingAuthenticationToken;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Evalúa las reglas @PreAuthorize reales de los endpoints de reportes. report:read se retira del JWT cuando el
 * plan no incluye analítica avanzada, así que ningún permiso del módulo tenant puede abrir reportes por otra vía.
 */
class ReportAuthorizationTest {

    private static final List<Class<?>> CONTROLLERS =
            List.of(ReportController.class, AnalyticsController.class, ReportEmbedController.class);

    private static boolean allowed(String expression, String... authorities) {
        var auth = new TestingAuthenticationToken("user", "n/a", authorities);
        var root = new SecurityExpressionRoot(auth) { };
        root.setTrustResolver(new AuthenticationTrustResolverImpl());
        return Boolean.TRUE.equals(new SpelExpressionParser().parseExpression(expression)
                .getValue(new StandardEvaluationContext(root), Boolean.class));
    }

    private static List<Method> securedEndpoints() {
        return CONTROLLERS.stream()
                .flatMap(type -> Arrays.stream(type.getDeclaredMethods()))
                .filter(method -> method.isAnnotationPresent(PreAuthorize.class))
                .toList();
    }

    @Test
    void sinReportReadNingunEndpointDeReportesQuedaAbierto() {
        List<Method> endpoints = securedEndpoints();
        assertFalse(endpoints.isEmpty());
        for (Method method : endpoints) {
            String rule = method.getAnnotation(PreAuthorize.class).value();
            for (String authority : List.of("tenant:manage", "tenant:update", "platform:tenant:manage", "document:read")) {
                assertFalse(allowed(rule, authority),
                        method.getDeclaringClass().getSimpleName() + "." + method.getName() + " se abre con " + authority);
            }
        }
    }

    @Test
    void conReportReadSeAbrenTodos() {
        for (Method method : securedEndpoints()) {
            assertTrue(allowed(method.getAnnotation(PreAuthorize.class).value(), "report:read"),
                    method.getDeclaringClass().getSimpleName() + "." + method.getName());
        }
    }
}
