package com.lta.gestdocum.backend.dto;

import jakarta.validation.constraints.Size;

public record OcrRejectRequest(@Size(max = 500) String reason) {
}
