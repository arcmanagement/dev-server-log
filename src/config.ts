export const DEFAULT_LOG_MAX_BYTES = 10 * 1024 * 1024;
export const DEFAULT_LOG_MAX_ROTATED_FILES = 2;

export function parseByteSize(raw: string, sourceName = 'byte size'): number {
  const match = raw.trim().match(/^(\d+)(?:\s*(b|kb|kib|mb|mib))?$/i);
  if (match == null) {
    throw new Error(
      `Invalid ${sourceName}: "${raw}". Expected a byte size like "10485760" or "10MB".`,
    );
  }

  const value = Number(match[1]);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(
      `Invalid ${sourceName}: "${raw}". Expected a positive integer byte size.`,
    );
  }

  const unit = match[2]?.toLowerCase();
  const bytes =
    unit == null || unit === 'b'
      ? value
      : unit === 'kb' || unit === 'kib'
        ? value * 1024
        : value * 1024 * 1024;

  if (!Number.isSafeInteger(bytes)) {
    throw new Error(
      `Invalid ${sourceName}: "${raw}". Expected a safe integer byte size.`,
    );
  }

  return bytes;
}

export function parseNonNegativeInteger(
  raw: string,
  sourceName = 'integer',
): number {
  const value = Number(raw.trim());
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      `Invalid ${sourceName}: "${raw}". Expected a non-negative integer.`,
    );
  }
  return value;
}

export function resolveLogMaxBytes(
  env: NodeJS.ProcessEnv,
  explicitMaxBytes?: number,
): number {
  if (explicitMaxBytes != null) return explicitMaxBytes;

  const raw = env.DEV_SERVER_LOG_MAX_BYTES;
  if (raw == null || raw.trim() === '') return DEFAULT_LOG_MAX_BYTES;

  return parseByteSize(raw, 'DEV_SERVER_LOG_MAX_BYTES');
}

export function resolveLogMaxRotatedFiles(
  env: NodeJS.ProcessEnv,
  explicitMaxRotatedFiles?: number,
): number {
  if (explicitMaxRotatedFiles != null) return explicitMaxRotatedFiles;

  const raw = env.DEV_SERVER_LOG_MAX_ROTATED_FILES;
  if (raw == null || raw.trim() === '') return DEFAULT_LOG_MAX_ROTATED_FILES;

  return parseNonNegativeInteger(raw, 'DEV_SERVER_LOG_MAX_ROTATED_FILES');
}
