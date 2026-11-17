/** Plain-words formatting for the upload screens. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${+(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${+(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function formatSpeed(bytesPerSecond: number): string {
  return `${+(bytesPerSecond / 1024 ** 2).toFixed(1)} MB/s`;
}

export function formatEta(seconds: number | null): string {
  if (seconds === null) return 'Working out time left';
  if (seconds < 10) return 'A few seconds left';
  if (seconds < 60) return `About ${Math.round(seconds / 10) * 10} seconds left`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `About ${minutes} min left`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `About ${hours} h ${rest} min left`;
}
