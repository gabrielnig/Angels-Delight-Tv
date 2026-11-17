export type Container = 'mp4' | 'mov' | 'matroska' | 'webm';

const EBML = [0x1a, 0x45, 0xdf, 0xa3];

/** Looks at the first bytes only. The extension and declared MIME are never trusted (SECURITY section 8). */
export function sniffContainer(head: Uint8Array): Container | null {
  if (head.length >= 12) {
    const box = Buffer.from(head.subarray(4, 8)).toString('latin1');
    if (box === 'ftyp') {
      const brand = Buffer.from(head.subarray(8, 12)).toString('latin1');
      return brand === 'qt  ' ? 'mov' : 'mp4';
    }
  }
  if (head.length >= 8 && EBML.every((byte, index) => head[index] === byte)) {
    const text = Buffer.from(head.subarray(0, Math.min(head.length, 64))).toString('latin1');
    return text.includes('webm') ? 'webm' : 'matroska';
  }
  return null;
}
