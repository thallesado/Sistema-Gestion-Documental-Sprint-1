export type ExpedientBasics = { code: string; name: string; expedientTypeId: string };

/** Message when step one of the wizard is incomplete; empty when it can move on. */
export function expedientBasicsError(form: ExpedientBasics): string {
  return form.code.trim() && form.name.trim() && form.expedientTypeId
    ? ''
    : 'El código, el nombre y el tipo de expediente son obligatorios.';
}

/** The reason the server gave for a 409, so the user learns what already exists instead of "HTTP 409". */
export function conflictMessage(body: { message?: string } | null | undefined, subject: string): string {
  const reason = body?.message?.trim();
  return reason || `Ya existe un ${subject} con esos datos. Revisa el código.`;
}
