package com.lta.gestdocum.backend.dto;

import java.time.LocalDate;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;

public record DocumentSearchFilters(String category, UUID documentTypeId, String department,
        String specialty, String process, String responsible,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo, String sortBy, String archiveState) { }
