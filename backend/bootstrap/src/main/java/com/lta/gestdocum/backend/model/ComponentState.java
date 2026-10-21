package com.lta.gestdocum.backend.model;

/**
 * Estado de un componente de formulario para un grupo (rol del tenant).
 * El orden de declaración va del más restrictivo al más permisivo.
 */
public enum ComponentState {
    HIDDEN,
    VISIBLE_READONLY,
    VISIBLE_EDITABLE;

    /** Estado cuando no hay ninguna fila configurada. */
    public static final ComponentState DEFAULT = VISIBLE_EDITABLE;

    public boolean isVisible() {
        return this != HIDDEN;
    }

    public boolean isEditable() {
        return this == VISIBLE_EDITABLE;
    }

    /** Regla de varios grupos: gana el estado más permisivo. */
    public static ComponentState mostPermissive(ComponentState a, ComponentState b) {
        return a.ordinal() >= b.ordinal() ? a : b;
    }
}
