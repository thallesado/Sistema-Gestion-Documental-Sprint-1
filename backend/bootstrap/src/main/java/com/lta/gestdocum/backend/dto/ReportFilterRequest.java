package com.lta.gestdocum.backend.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

public record ReportFilterRequest(
        OffsetDateTime dateFrom,
        OffsetDateTime dateTo,
        String status,
        String type,
        String area,
        String owner,
        String action,
        String module,
        String result,
        String search
) {
    public ReportFilterRequest {
        if (dateFrom == null || dateTo == null) {
            throw new IllegalArgumentException("El rango de fechas (dateFrom y dateTo) es obligatorio para generar el reporte");
        }
        if (dateFrom.isAfter(dateTo)) {
            throw new IllegalArgumentException("La fecha inicial (dateFrom) no puede ser posterior a la fecha final (dateTo)");
        }
        status = clean(status);
        type = clean(type);
        area = clean(area);
        owner = clean(owner);
        action = clean(action);
        module = clean(module);
        result = clean(result);
        search = clean(search);
    }

    public static ReportFilterRequest of(
            String dateFromStr,
            String dateToStr,
            String status,
            String type,
            String area,
            String owner,
            String action,
            String module,
            String result,
            String search
    ) {
        if (dateFromStr == null || dateFromStr.isBlank() || dateToStr == null || dateToStr.isBlank()) {
            throw new IllegalArgumentException("El rango de fechas (dateFrom y dateTo) es obligatorio para generar el reporte");
        }
        OffsetDateTime from = parseDateTime(dateFromStr, false);
        OffsetDateTime to = parseDateTime(dateToStr, true);
        return new ReportFilterRequest(from, to, status, type, area, owner, action, module, result, search);
    }

    public static OffsetDateTime parseDateTime(String text, boolean endOfDay) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String trimmed = text.trim();
        try {
            if (trimmed.length() == 10) { // yyyy-MM-dd
                LocalDate date = LocalDate.parse(trimmed);
                return endOfDay
                        ? date.atTime(23, 59, 59, 999999999).atOffset(ZoneOffset.UTC)
                        : date.atStartOfDay().atOffset(ZoneOffset.UTC);
            }
            return OffsetDateTime.parse(trimmed);
        } catch (Exception e) {
            throw new IllegalArgumentException("Formato de fecha inválido: '" + text + "'. Use yyyy-MM-dd o formato ISO-8601.");
        }
    }

    private static String clean(String val) {
        if (val == null || val.isBlank()) {
            return null;
        }
        return val.trim();
    }
}
