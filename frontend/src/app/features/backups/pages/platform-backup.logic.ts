import { friendlyApiMessage } from '../../../core/http/tenant-session';

export type PlatformBackupViewState = 'idle' | 'unavailable' | 'busy' | 'running' | 'completed' | 'failed' | 'error';

const TERMINAL = new Set(['COMPLETED', 'SUCCESS', 'SUCCEEDED', 'DONE', 'FAILED', 'ERROR', 'CANCELLED']);
const SUCCESS = new Set(['COMPLETED', 'SUCCESS', 'SUCCEEDED', 'DONE']);

export function isTerminalStatus(status: string | null | undefined): boolean {
  return TERMINAL.has(String(status ?? '').toUpperCase());
}

export function viewStateForStatus(status: string | null | undefined): PlatformBackupViewState {
  const value = String(status ?? '').toUpperCase();
  if (!value) return 'running';
  if (SUCCESS.has(value)) return 'completed';
  if (TERMINAL.has(value)) return 'failed';
  return 'running';
}

/** Maps the failure of POST /platform/backups/full to a view state and a safe message. */
export function describeStartFailure(status: number, serverMessage: unknown): { state: PlatformBackupViewState; message: string } {
  if (status === 503) {
    return {
      state: 'unavailable',
      message: typeof serverMessage === 'string' && serverMessage.trim()
        ? friendlyApiMessage(serverMessage)
        : 'El operador de respaldos completos no está configurado',
    };
  }
  if (status === 409) {
    return { state: 'busy', message: 'Ya hay un respaldo completo en curso. Espera a que termine para iniciar otro.' };
  }
  if (status === 403) {
    return { state: 'error', message: 'Tu usuario no tiene permiso para respaldar la plataforma.' };
  }
  return { state: 'error', message: friendlyApiMessage(serverMessage) };
}
