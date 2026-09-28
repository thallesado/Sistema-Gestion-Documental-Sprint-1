package com.lta.gestdocum.backend.dto;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;
import java.util.UUID;

@Value
@Builder
public class TagResponse {
    UUID id;
    String name;
    String color;
    OffsetDateTime createdAt;
}
