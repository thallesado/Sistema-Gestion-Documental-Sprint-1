package com.lta.gestdocum.backend.dto;

import java.util.List;

public record ReportPageResponse<T>(
        List<T> content,
        long totalElements,
        int page,
        int size,
        int totalPages
) {
    public static <T> ReportPageResponse<T> of(List<T> content, long totalElements, int page, int size) {
        int totalPages = size > 0 ? (int) Math.ceil((double) totalElements / size) : 0;
        return new ReportPageResponse<>(content, totalElements, page, size, totalPages);
    }
}
