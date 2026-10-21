package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.model.ComponentState;
import com.lta.gestdocum.backend.repository.ComponentPermissionRepository.Row;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;

import static com.lta.gestdocum.backend.model.ComponentState.HIDDEN;
import static com.lta.gestdocum.backend.model.ComponentState.VISIBLE_EDITABLE;
import static com.lta.gestdocum.backend.model.ComponentState.VISIBLE_READONLY;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ComponentFormAccessTest {

    private final ComponentFormCatalog.Form documents = ComponentFormCatalog.require(ComponentFormCatalog.DOCUMENT_FORM);

    @Test
    @DisplayName("Sin fila configurada el componente es VISIBLE_EDITABLE")
    void defaultIsEditable() {
        ComponentFormAccess access = ComponentFormAccess.resolve(documents, List.of(1L), List.of());
        documents.components().forEach(c -> assertEquals(VISIBLE_EDITABLE, access.state(c.key())));
    }

    @Test
    @DisplayName("Con un solo grupo se aplica su estado")
    void singleGroupState() {
        ComponentFormAccess access = ComponentFormAccess.resolve(documents, List.of(1L), List.of(
                new Row(1L, "codigo", HIDDEN), new Row(1L, "nombre", VISIBLE_READONLY)));
        assertEquals(HIDDEN, access.state("codigo"));
        assertEquals(VISIBLE_READONLY, access.state("nombre"));
        assertEquals(VISIBLE_EDITABLE, access.state("descripcion"));
    }

    @Test
    @DisplayName("Con varios grupos gana el estado más permisivo y un grupo sin fila aporta VISIBLE_EDITABLE")
    void mostPermissiveWins() {
        ComponentFormAccess access = ComponentFormAccess.resolve(documents, List.of(1L, 2L, 3L), List.of(
                new Row(1L, "codigo", HIDDEN), new Row(2L, "codigo", VISIBLE_READONLY), new Row(3L, "codigo", HIDDEN),
                new Row(1L, "nombre", HIDDEN), new Row(2L, "nombre", HIDDEN), new Row(3L, "nombre", HIDDEN),
                new Row(1L, "descripcion", HIDDEN)));
        assertEquals(VISIBLE_READONLY, access.state("codigo"));
        assertEquals(HIDDEN, access.state("nombre"));
        assertEquals(VISIBLE_EDITABLE, access.state("descripcion"), "los grupos 2 y 3 no restringen la descripción");
    }

    @Test
    @DisplayName("Ocultos no se devuelven; los no editables se rechazan al informarlos o cambiarlos")
    void serverSideRules() {
        ComponentFormAccess access = ComponentFormAccess.resolve(documents, List.of(1L), List.of(
                new Row(1L, "codigo", HIDDEN), new Row(1L, "nombre", VISIBLE_READONLY)));

        assertNull(access.reveal("codigo", "DOC-1"));
        assertEquals("Contrato", access.reveal("nombre", "Contrato"));

        AccessDeniedException denied = assertThrows(AccessDeniedException.class,
                () -> access.requireEditableIfProvided("nombre", "Otro nombre"));
        assertTrue(denied.getMessage().contains("documento.nuevo.nombre"));
        assertThrows(AccessDeniedException.class, () -> access.requireEditableIfProvided("codigo", "X-1"));
        assertDoesNotThrow(() -> access.requireEditableIfProvided("nombre", "  "));
        assertDoesNotThrow(() -> access.requireEditableIfProvided("descripcion", "libre"));

        assertDoesNotThrow(() -> access.requireUnchanged("nombre", "Contrato", "contrato "));
        assertThrows(AccessDeniedException.class, () -> access.requireUnchanged("nombre", "Contrato", "Cambiado"));
    }

    @Test
    @DisplayName("Sin grupos (cuenta de plataforma) no hay restricciones de componente")
    void unrestrictedWithoutGroups() {
        ComponentFormAccess access = ComponentFormAccess.unrestricted(documents);
        assertTrue(access.editable("codigo"));
        assertEquals(ComponentState.DEFAULT, access.state("nombre"));
    }

    @Test
    @DisplayName("El catálogo rechaza formularios desconocidos")
    void unknownForm() {
        assertThrows(com.lta.gestdocum.backend.exception.NotFoundException.class,
                () -> ComponentFormCatalog.require("formulario_inexistente"));
    }
}
