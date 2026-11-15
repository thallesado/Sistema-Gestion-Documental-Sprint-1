package com.lta.gestdocum.backend.dto;

import java.util.List;
import java.util.Map;

/**
 * @param facets row count per value of the report's main status column, computed over the whole filtered
 *               result set (not just this page); empty when the report has none or the field is hidden
 */
public record ReportPageResponse<T>(
        List<T> content,
        long totalElements,
        int page,
        int size,
        int totalPages,
        Map<String, Long> facets
) {
    public static <T> ReportPageResponse<T> of(List<T> content, long totalElements, int page, int size) {
        return of(content, totalElements, page, size, Map.of());
    }

    public static <T> ReportPageResponse<T> of(List<T> content, long totalElements, int page, int size,
                                               Map<String, Long> facets) {
        int totalPages = size > 0 ? (int) Math.ceil((double) totalElements / size) : 0;
        return new ReportPageResponse<>(content, totalElements, page, size, totalPages,
                facets == null ? Map.of() : facets);
    }
}
