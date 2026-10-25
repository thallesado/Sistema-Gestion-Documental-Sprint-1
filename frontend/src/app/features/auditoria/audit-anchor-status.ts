export interface AnchorStatusView {
  label: string;
  tone: 'ok' | 'warn' | 'danger' | 'muted';
}

/** Human label for externalAnchorStatus.status returned by GET /audit/verify (read only). */
export function describeExternalAnchor(status: string | null | undefined): AnchorStatusView {
  switch (status) {
    case 'ANCHORED_MATCH':
      return { label: 'Ancla externa verificada: coincide con el sello publicado fuera de la base de datos', tone: 'ok' };
    case 'ANCHOR_MISMATCH':
      return { label: 'La cadena NO coincide con el sello externo: posible reescritura de la base de datos', tone: 'danger' };
    case 'ANCHOR_SIGNATURE_INVALID':
      return { label: 'El sello externo tiene una firma inválida', tone: 'danger' };
    case 'NO_EXTERNAL_ANCHOR':
      return { label: 'Aún no se publicó ningún sello externo para este tenant', tone: 'warn' };
    case 'UNREACHABLE':
      return { label: 'No se pudo consultar el destino externo; integridad externa sin confirmar', tone: 'warn' };
    case 'UNVERIFIABLE':
      return { label: 'El destino externo es solo de escritura; no se puede comprobar', tone: 'warn' };
    case 'NOT_CONFIGURED':
    default:
      return { label: 'Anclaje externo no configurado: solo se verifica la cadena interna', tone: 'muted' };
  }
}
