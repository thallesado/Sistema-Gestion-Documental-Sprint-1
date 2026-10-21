import assert from 'node:assert/strict';
import test from 'node:test';

import {
  captureFrameToFile,
  classifyCameraError,
  cameraFailureMessage,
  fitWithin,
  isCameraSupported,
  openCameraStream,
  stopStream,
} from '../src/app/core/utils/camera-capture.ts';
import { describeOcrError } from '../src/app/core/utils/ocr-error-message.ts';

const fakeCanvas = (blob = new Blob(['jpeg-bytes'], { type: 'image/jpeg' })) => {
  const calls = { draw: [], toBlob: [] };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage: (...args) => calls.draw.push(args) }),
    toBlob: (cb, type, quality) => {
      calls.toBlob.push([type, quality]);
      cb(blob);
    },
  };
  return { canvas, calls };
};

test('isCameraSupported is false without mediaDevices (insecure http context) and true with getUserMedia', () => {
  assert.equal(isCameraSupported(undefined), false);
  assert.equal(isCameraSupported({}), false);
  assert.equal(isCameraSupported({ mediaDevices: {} }), false);
  assert.equal(isCameraSupported({ mediaDevices: { getUserMedia: async () => ({}) } }), true);
});

test('openCameraStream rejects as unsupported so the page can fall back to the file picker', async () => {
  await assert.rejects(() => openCameraStream({}, 'environment'), (error) => {
    assert.equal(classifyCameraError(error), 'unknown');
    assert.match(error.message, /Camera API unavailable/);
    return true;
  });
});

test('openCameraStream asks for the requested facing mode without audio', async () => {
  let received;
  const stream = { id: 'stream' };
  const nav = { mediaDevices: { getUserMedia: async (constraints) => ((received = constraints), stream) } };
  assert.equal(await openCameraStream(nav, 'user'), stream);
  assert.equal(received.audio, false);
  assert.deepEqual(received.video.facingMode, { ideal: 'user' });
});

test('classifyCameraError maps browser error names to user-facing failures', () => {
  assert.equal(classifyCameraError({ name: 'NotAllowedError' }), 'denied');
  assert.equal(classifyCameraError({ name: 'NotFoundError' }), 'not-found');
  assert.equal(classifyCameraError({ name: 'NotReadableError' }), 'in-use');
  assert.equal(classifyCameraError(new Error('boom')), 'unknown');
  assert.equal(classifyCameraError(null), 'unknown');
  assert.match(cameraFailureMessage('denied'), /Permiso de cámara denegado/);
  assert.match(cameraFailureMessage('unsupported'), /selector de archivos/);
});

test('stopStream stops every track and tolerates a missing stream', () => {
  const stopped = [];
  stopStream({ getTracks: () => [{ stop: () => stopped.push('a') }, { stop: () => stopped.push('b') }] });
  assert.deepEqual(stopped, ['a', 'b']);
  assert.doesNotThrow(() => stopStream(null));
  assert.doesNotThrow(() => stopStream(undefined));
});

test('fitWithin downsizes the longest side and never upscales', () => {
  assert.deepEqual(fitWithin(4000, 3000, 1920), { width: 1920, height: 1440 });
  assert.deepEqual(fitWithin(3000, 4000, 1920), { width: 1440, height: 1920 });
  assert.deepEqual(fitWithin(800, 600, 1920), { width: 800, height: 600 });
});

test('captureFrameToFile returns a scaled JPEG File named after the capture time', async () => {
  const { canvas, calls } = fakeCanvas();
  const video = { videoWidth: 4000, videoHeight: 3000 };
  const file = await captureFrameToFile(video, () => canvas, () => 1234);
  assert.equal(file.name, 'captura-camara-1234.jpg');
  assert.equal(file.type, 'image/jpeg');
  assert.ok(file.size > 0);
  assert.equal(canvas.width, 1920);
  assert.equal(canvas.height, 1440);
  assert.deepEqual(calls.draw[0].slice(1), [0, 0, 1920, 1440]);
  assert.deepEqual(calls.toBlob[0], ['image/jpeg', 0.9]);
});

test('captureFrameToFile refuses to capture before the video has dimensions', async () => {
  const { canvas, calls } = fakeCanvas();
  await assert.rejects(() => captureFrameToFile({ videoWidth: 0, videoHeight: 0 }, () => canvas), /aún no está lista/);
  assert.equal(calls.draw.length, 0);
});

test('captureFrameToFile fails clearly when the canvas cannot produce an image', async () => {
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage() {} }), toBlob: (cb) => cb(null) };
  await assert.rejects(() => captureFrameToFile({ videoWidth: 100, videoHeight: 100 }, () => canvas), /No se pudo generar la imagen/);
});

test('describeOcrError gives an actionable message per HTTP failure', () => {
  assert.match(describeOcrError({ status: 0 }), /No se pudo conectar/);
  assert.match(describeOcrError({ status: 413 }), /demasiado grande/);
  assert.match(describeOcrError({ status: 401 }), /sesión expiró/);
  assert.match(describeOcrError({ status: 403 }), /No tienes permiso/);
  assert.match(describeOcrError({ status: 504 }), /tardó demasiado/);
  assert.equal(describeOcrError({ status: 400, error: { message: 'Formato no soportado' } }), 'Formato no soportado');
  assert.equal(describeOcrError({ status: 500, error: '<html>' }), 'Error al procesar el documento con IA multimodal');
  assert.equal(describeOcrError(null), 'Error al procesar el documento con IA multimodal');
});
