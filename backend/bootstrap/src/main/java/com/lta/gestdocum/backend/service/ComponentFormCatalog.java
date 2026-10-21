package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.exception.NotFoundException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Allowlist de formularios y componentes configurables por grupo. Debe coincidir con
 * {@code frontend/src/app/core/auth/form-registry.ts}; una prueba del frontend compara ambas listas.
 */
public final class ComponentFormCatalog {

    public static final String USER_FORM = "usuario";
    public static final String DOCUMENT_FORM = "documento.nuevo";
    public static final String MEDICAL_NOTE_FORM = "nota_medica";

    public record Component(String key, String label) { }

    public record Form(String key, String label, List<Component> components) {
        public boolean has(String componentKey) {
            return components.stream().anyMatch(component -> component.key().equals(componentKey));
        }
    }

    private static final Map<String, Form> FORMS = new LinkedHashMap<>();

    static {
        register(new Form(USER_FORM, "Usuarios", List.of(
                new Component("nombre", "Nombre"),
                new Component("apellido", "Apellido"),
                new Component("usuario", "Nombre de usuario"),
                new Component("correo", "Correo"),
                new Component("contrasena", "Contraseña"),
                new Component("estado", "Estado"),
                new Component("grupos", "Grupos del usuario"))));
        register(new Form(DOCUMENT_FORM, "Documentos", List.of(
                new Component("nombre", "Nombre del documento"),
                new Component("codigo", "Código institucional"),
                new Component("departamento", "Servicio / Departamento"),
                new Component("especialidad", "Especialidad"),
                new Component("proceso", "Proceso institucional"),
                new Component("paciente", "Paciente asociado"),
                new Component("expediente", "Expediente vinculado"),
                new Component("emision", "Fecha de emisión"),
                new Component("vencimiento", "Fecha de vencimiento"),
                new Component("responsable", "Responsable asignado"),
                new Component("descripcion", "Descripción / Resumen"))));
        register(new Form(MEDICAL_NOTE_FORM, "Notas médicas", List.of(
                new Component("tipo", "Tipo de nota"),
                new Component("estado", "Estado (borrador / vigente)"),
                new Component("contenido", "Contenido clínico (SOAP)"))));
    }

    private ComponentFormCatalog() {
    }

    private static void register(Form form) {
        FORMS.put(form.key(), form);
    }

    public static List<Form> forms() {
        return List.copyOf(FORMS.values());
    }

    public static Form require(String formKey) {
        Form form = formKey == null ? null : FORMS.get(formKey);
        if (form == null) {
            throw new NotFoundException("Formulario no configurable: " + formKey);
        }
        return form;
    }
}
