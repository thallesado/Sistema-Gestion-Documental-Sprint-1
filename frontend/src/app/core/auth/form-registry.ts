/**
 * Catálogo de formularios con privilegios por componente (B2). Debe coincidir con
 * `ComponentFormCatalog.java`; `tests/component-permissions.test.mjs` compara ambas listas.
 *
 * Clave completa de un componente: `<formulario>.<componente>`, por ejemplo `documento.nuevo.codigo`.
 */
export type ComponentState = 'VISIBLE_EDITABLE' | 'VISIBLE_READONLY' | 'HIDDEN';

export const COMPONENT_STATES: ReadonlyArray<{ value: ComponentState; label: string }> = [
  { value: 'VISIBLE_EDITABLE', label: 'Visible y editable' },
  { value: 'VISIBLE_READONLY', label: 'Solo lectura' },
  { value: 'HIDDEN', label: 'No visible' },
];

/** Sin configuración, todo componente es visible y editable. */
export const DEFAULT_COMPONENT_STATE: ComponentState = 'VISIBLE_EDITABLE';

export interface FormComponentDefinition { key: string; label: string }
export interface FormDefinition { key: string; label: string; components: readonly FormComponentDefinition[] }

export const FORM_REGISTRY: readonly FormDefinition[] = [
  {
    key: 'usuario',
    label: 'Usuarios',
    components: [
      { key: 'nombre', label: 'Nombre' },
      { key: 'apellido', label: 'Apellido' },
      { key: 'usuario', label: 'Nombre de usuario' },
      { key: 'correo', label: 'Correo' },
      { key: 'contrasena', label: 'Contraseña' },
      { key: 'estado', label: 'Estado' },
      { key: 'grupos', label: 'Grupos del usuario' },
    ],
  },
  {
    key: 'documento.nuevo',
    label: 'Documentos',
    components: [
      { key: 'nombre', label: 'Nombre del documento' },
      { key: 'codigo', label: 'Código institucional' },
      { key: 'departamento', label: 'Servicio / Departamento' },
      { key: 'especialidad', label: 'Especialidad' },
      { key: 'proceso', label: 'Proceso institucional' },
      { key: 'paciente', label: 'Paciente asociado' },
      { key: 'expediente', label: 'Expediente vinculado' },
      { key: 'emision', label: 'Fecha de emisión' },
      { key: 'vencimiento', label: 'Fecha de vencimiento' },
      { key: 'responsable', label: 'Responsable asignado' },
      { key: 'descripcion', label: 'Descripción / Resumen' },
    ],
  },
  {
    key: 'nota_medica',
    label: 'Notas médicas',
    components: [
      { key: 'tipo', label: 'Tipo de nota' },
      { key: 'estado', label: 'Estado (borrador / vigente)' },
      { key: 'contenido', label: 'Contenido clínico (SOAP)' },
    ],
  },
];

/** Separa `documento.nuevo.codigo` en formulario (`documento.nuevo`) y componente (`codigo`). */
export function splitFieldKey(fieldKey: string): { form: string; component: string } {
  const dot = fieldKey.lastIndexOf('.');
  if (dot <= 0 || dot === fieldKey.length - 1) throw new Error(`Clave de componente inválida: ${fieldKey}`);
  return { form: fieldKey.slice(0, dot), component: fieldKey.slice(dot + 1) };
}

/** Estado de un componente con el valor predeterminado si el servidor no lo informa. */
export function componentState(states: Readonly<Record<string, ComponentState>> | undefined, component: string): ComponentState {
  return states?.[component] ?? DEFAULT_COMPONENT_STATE;
}
