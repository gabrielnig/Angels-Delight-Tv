const MAX_KEY_BYTES = 1024;

/** Object keys come from our own code, but a bad one must never reach the file system or a signed URL. */
export function assertSafeKey(key: string): void {
  const segments = key.split('/');
  const invalid =
    key.length === 0 ||
    Buffer.byteLength(key) > MAX_KEY_BYTES ||
    key.includes('\0') ||
    key.includes('\\') ||
    segments.some((segment) => segment === '' || segment === '.' || segment === '..');
  if (invalid) {
    throw new Error('Invalid object key');
  }
}
