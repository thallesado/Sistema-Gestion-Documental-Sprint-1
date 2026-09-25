package com.lta.gestdocum.backend.modulos.documentos.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class TagRequest {

    @Size(max = 80)
    private String name;

    @Size(max = 20)
    private String color;
}
