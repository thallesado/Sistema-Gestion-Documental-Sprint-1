package com.lta.gestdocum.backend.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

/** Validates the flat metadata contract stored by each document type. */
public final class DocumentMetadataValidator {
    private DocumentMetadataValidator() { }

    public static void validate(Map<String, Object> schema, Map<String, Object> supplied) {
        if (schema == null || schema.isEmpty()) return;
        Map<String, Object> values = supplied == null ? Map.of() : supplied;
        Collection<?> required = schema.get("required") instanceof Collection<?> list ? list : List.of();
        Map<?, ?> properties = schema.get("properties") instanceof Map<?, ?> map ? map : Map.of();
        for (Object key : required) {
            Object value = values.get(key.toString());
            if (value == null || value instanceof String text && text.isBlank()) {
                throw new IllegalArgumentException("Falta el metadato obligatorio: " + label(key, properties));
            }
        }
        for (var entry : properties.entrySet()) {
            String key = entry.getKey().toString(); Object value = values.get(key);
            if (value == null || value instanceof String text && text.isBlank()) continue;
            if (!(entry.getValue() instanceof Map<?, ?> rule)) continue;
            String label = label(key, properties);
            String type = Objects.toString(rule.get("type"), "string");
            boolean valid = switch (type) {
                case "string" -> value instanceof String;
                case "number" -> value instanceof Number;
                case "integer" -> value instanceof Number n && new BigDecimal(n.toString()).stripTrailingZeros().scale() <= 0;
                case "boolean" -> value instanceof Boolean;
                case "object" -> value instanceof Map;
                case "array" -> value instanceof Collection;
                default -> throw new IllegalArgumentException("Tipo de metadato no soportado: " + type);
            };
            if (!valid) throw new IllegalArgumentException("Tipo incorrecto en metadato: " + label);
            if (value instanceof String text) {
                if (rule.get("minLength") instanceof Number n && text.trim().length() < n.intValue()
                        || rule.get("maxLength") instanceof Number m && text.length() > m.intValue()) {
                    throw new IllegalArgumentException("Longitud incorrecta en metadato: " + label);
                }
                if ("date".equals(rule.get("format"))) {
                    try { LocalDate.parse(text); }
                    catch (java.time.format.DateTimeParseException error) { throw new IllegalArgumentException("Fecha inválida en metadato: " + label); }
                }
            }
            if (value instanceof Number number) {
                BigDecimal decimal = new BigDecimal(number.toString());
                if (rule.get("minimum") instanceof Number min && decimal.compareTo(new BigDecimal(min.toString())) < 0
                        || rule.get("maximum") instanceof Number max && decimal.compareTo(new BigDecimal(max.toString())) > 0) {
                    throw new IllegalArgumentException("Valor fuera de rango en metadato: " + label);
                }
            }
            if (rule.get("enum") instanceof Collection<?> options && options.stream().noneMatch(option -> Objects.equals(option, value))) {
                throw new IllegalArgumentException("Opción inválida en metadato: " + label);
            }
        }
    }

    private static String label(Object key, Map<?, ?> properties) {
        Object rule = properties.get(key);
        return rule instanceof Map<?, ?> map && map.get("title") instanceof String title ? title : key.toString();
    }
}
