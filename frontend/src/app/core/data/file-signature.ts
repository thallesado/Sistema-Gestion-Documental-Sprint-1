const SIGNATURES: Record<string, number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'image/jpeg': [0xff, 0xd8, 0xff],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [0x50, 0x4b, 0x03, 0x04],
};

/** Longest signature above; enough leading bytes to verify any supported type. */
export const FILE_SIGNATURE_BYTES = 8;

/**
 * True when the leading bytes match the signature of the declared type. The server enforces the same rule; checking
 * here avoids creating a document whose file the server is going to reject.
 */
export function matchesFileSignature(mime: string, head: Uint8Array): boolean {
  const signature = SIGNATURES[mime];
  return !!signature && head.length >= signature.length && signature.every((byte, index) => head[index] === byte);
}
