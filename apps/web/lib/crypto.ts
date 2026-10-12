/**
 * Calculate SHA-256 hash of an ArrayBuffer or File using standard Web Crypto API.
 */
export async function calculateSHA256(data: ArrayBuffer | Uint8Array): Promise<string> {
  const buffer = data instanceof Uint8Array ? data.buffer : data;
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer as ArrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Format bytes into human-readable size (KB, MB, GB).
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
