/** Expedients a new document can be linked to: the open ones, by code. Closed or archived ones cannot take new files. */
export function linkableExpedients<T extends { code: string; status: string }>(expedients: T[] | null | undefined): T[] {
  return (expedients ?? [])
    .filter((expedient) => expedient.status === 'ACTIVE')
    .sort((left, right) => left.code.localeCompare(right.code));
}
