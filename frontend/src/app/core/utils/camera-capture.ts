// Pure helpers for the OCR webcam viewer. They take their browser dependencies
// as arguments so the capture flow can be tested without a DOM or a camera.

export type CameraFacing = 'environment' | 'user';
export type CameraFailure = 'unsupported' | 'denied' | 'not-found' | 'in-use' | 'unknown';

export interface CameraNavigator {
  mediaDevices?: { getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream> };
}

export interface CameraVideoSource {
  videoWidth: number;
  videoHeight: number;
}

export interface CameraCanvas {
  width: number;
  height: number;
  getContext(type: '2d'): { drawImage(source: unknown, x: number, y: number, w: number, h: number): void } | null;
  toBlob(callback: (blob: Blob | null) => void, type: string, quality: number): void;
}

export const CAPTURE_MAX_SIDE = 1920;
export const CAPTURE_JPEG_QUALITY = 0.9;

/** getUserMedia only exists in secure contexts (HTTPS or localhost). */
export function isCameraSupported(nav?: CameraNavigator): boolean {
  return typeof nav?.mediaDevices?.getUserMedia === 'function';
}

export function classifyCameraError(error: unknown): CameraFailure {
  const name = (error as { name?: string } | null)?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') return 'not-found';
  if (name === 'NotReadableError' || name === 'AbortError' || name === 'TrackStartError') return 'in-use';
  return 'unknown';
}

export function cameraFailureMessage(failure: CameraFailure): string {
  switch (failure) {
    case 'unsupported':
      return 'Este navegador no permite abrir la cámara en esta conexión. Usa el selector de archivos.';
    case 'denied':
      return 'Permiso de cámara denegado. Habilítalo en el navegador o usa el selector de archivos.';
    case 'not-found':
      return 'No se encontró ninguna cámara disponible. Usa el selector de archivos.';
    case 'in-use':
      return 'La cámara está siendo usada por otra aplicación. Ciérrala o usa el selector de archivos.';
    default:
      return 'No se pudo abrir la cámara. Usa el selector de archivos.';
  }
}

export async function openCameraStream(nav: CameraNavigator | undefined, facing: CameraFacing): Promise<MediaStream> {
  if (!isCameraSupported(nav)) throw Object.assign(new Error('Camera API unavailable'), { name: 'UnsupportedError' });
  return nav!.mediaDevices!.getUserMedia!({
    video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false,
  });
}

export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop());
}

/** Scales (width, height) down so the longest side is at most `maxSide`; never upscales. */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };
  const ratio = maxSide / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

/** Draws the current video frame on a canvas and returns it as a JPEG File. */
export async function captureFrameToFile(
  video: CameraVideoSource,
  createCanvas: () => CameraCanvas,
  now: () => number = Date.now,
): Promise<File> {
  if (!video.videoWidth || !video.videoHeight) throw new Error('La cámara aún no está lista');
  const { width, height } = fitWithin(video.videoWidth, video.videoHeight, CAPTURE_MAX_SIDE);
  const canvas = createCanvas();
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo preparar la captura');
  context.drawImage(video, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', CAPTURE_JPEG_QUALITY));
  if (!blob) throw new Error('No se pudo generar la imagen capturada');
  return new File([blob], `captura-camara-${now()}.jpg`, { type: 'image/jpeg' });
}
