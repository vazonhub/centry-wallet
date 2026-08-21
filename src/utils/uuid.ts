/**
 * RFC-4122 v4 UUID generator. IDs are minted in TS so the schema is merge-ready
 * across devices without autoincrement collisions (docs/DATA_MODEL.md).
 *
 * Uses `crypto.getRandomValues` when available (Hermes/新 arch expose it), and
 * falls back to `Math.random` otherwise — sufficient for local, single-device
 * Build 0. Revisit with a CSPRNG if sync lands in v1.1.
 */
function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const g = globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } };
  if (g.crypto?.getRandomValues) {
    g.crypto.getRandomValues(bytes);
    return bytes;
  }
  for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}

const HEX: string[] = Array.from({ length: 256 }, (_, i) => (i + 0x100).toString(16).slice(1));

export function uuid(): string {
  const b = randomBytes(16);
  // Per RFC 4122 §4.4: set version (4) and variant (10xx) bits.
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  return (
    HEX[b[0] ?? 0]! +
    HEX[b[1] ?? 0]! +
    HEX[b[2] ?? 0]! +
    HEX[b[3] ?? 0]! +
    '-' +
    HEX[b[4] ?? 0]! +
    HEX[b[5] ?? 0]! +
    '-' +
    HEX[b[6] ?? 0]! +
    HEX[b[7] ?? 0]! +
    '-' +
    HEX[b[8] ?? 0]! +
    HEX[b[9] ?? 0]! +
    '-' +
    HEX[b[10] ?? 0]! +
    HEX[b[11] ?? 0]! +
    HEX[b[12] ?? 0]! +
    HEX[b[13] ?? 0]! +
    HEX[b[14] ?? 0]! +
    HEX[b[15] ?? 0]!
  );
}
