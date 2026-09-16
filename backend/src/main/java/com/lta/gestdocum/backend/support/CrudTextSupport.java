package com.lta.gestdocum.backend.support;

public final class CrudTextSupport {

    private CrudTextSupport() {
    }

    public static String optionalFilter(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    public static String required(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " no puede estar vacío");
        }
        return value.trim();
    }
}
