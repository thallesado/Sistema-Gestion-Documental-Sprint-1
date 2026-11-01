package com.lta.gestdocum.backend.exception;

import java.util.List;

/**
 * Cambio de plataforma con impacto sobre organizaciones existentes (bajar un límite que ya superan,
 * retirar una funcionalidad que usan). Se responde 409 con code CONFIRMATION_REQUIRED y la lista
 * de afectadas; el cliente repite la solicitud con acceptImpact.
 */
public class ConfirmationRequiredException extends RuntimeException {
    private final long affected;
    private final List<String> examples;

    public ConfirmationRequiredException(String message, long affected, List<String> examples) {
        super(message);
        this.affected = affected;
        this.examples = List.copyOf(examples);
    }

    public long affected() { return affected; }

    public List<String> examples() { return examples; }
}
