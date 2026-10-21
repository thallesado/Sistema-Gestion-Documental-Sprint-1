package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Commercial contact request associated with the authenticated tenant. */
public record EnterpriseInquiryRequest(
        @NotBlank @Size(max = 160) String contactName,
        @NotBlank @Email @Size(max = 254) String email,
        @Size(max = 60) String phone,
        @Min(1) @Max(100000) Integer estimatedUsers,
        boolean dicom,
        boolean bulkOcr,
        boolean interoperability,
        @Size(max = 4000) String message) { }
