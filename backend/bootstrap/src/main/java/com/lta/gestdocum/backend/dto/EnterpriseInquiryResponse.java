package com.lta.gestdocum.backend.dto;

import java.util.UUID;

public record EnterpriseInquiryResponse(UUID inquiryId, boolean accepted, String message) { }
