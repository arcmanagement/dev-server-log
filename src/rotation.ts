import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { dirname, parse, resolve } from 'node:path';

export type LogSink = {
  path: string;
  fileDescriptor: number;
  bytesWritten: number;
};

let rotatedLogSequence = 0;

export function buildRotatedLogPath(logPath: string): string {
  const parsed = parse(logPath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sequence = rotatedLogSequence;
  rotatedLogSequence += 1;

  const suffix = sequence === 0 ? timestamp : `${timestamp}-${sequence}`;
  let rotatedPath = resolve(
    parsed.dir,
    `${parsed.name}.${suffix}${parsed.ext}`,
  );
  let collision = 1;

  while (existsSync(rotatedPath)) {
    rotatedPath = resolve(
      parsed.dir,
      `${parsed.name}.${suffix}-${collision}${parsed.ext}`,
    );
    collision += 1;
  }

  return rotatedPath;
}

export function pruneRotatedLogs(
  logPath: string,
  maxRotatedFiles: number,
  protectedPath?: string,
): void {
  const parsed = parse(logPath);
  const rotatedPrefix = `${parsed.name}.`;
  const protectedLogPath =
    protectedPath == null ? undefined : resolve(protectedPath);
  const rotatedLogs = readdirSync(parsed.dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => resolve(parsed.dir, entry.name))
    .filter((path) => {
      const candidate = parse(path);
      return (
        candidate.ext === parsed.ext && candidate.base.startsWith(rotatedPrefix)
      );
    })
    .map((path) => ({
      path,
      mtimeMs: statSync(path).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  const keptPaths = new Set<string>();
  if (protectedLogPath != null && maxRotatedFiles > 0) {
    keptPaths.add(protectedLogPath);
  }

  for (const rotatedLog of rotatedLogs) {
    if (keptPaths.size >= maxRotatedFiles) break;
    keptPaths.add(rotatedLog.path);
  }

  for (const rotatedLog of rotatedLogs) {
    if (keptPaths.has(rotatedLog.path)) continue;
    unlinkSync(rotatedLog.path);
  }
}

export function createLogSink(
  logPath: string,
  maxRotatedFiles: number,
): LogSink {
  mkdirSync(dirname(logPath), { recursive: true });

  if (existsSync(logPath) && statSync(logPath).size > 0) {
    const rotatedPath = buildRotatedLogPath(logPath);
    renameSync(logPath, rotatedPath);
    pruneRotatedLogs(logPath, maxRotatedFiles, rotatedPath);
  }

  return {
    path: logPath,
    fileDescriptor: openSync(logPath, 'w'),
    bytesWritten: 0,
  };
}

export function closeLogSink(sink: LogSink): void {
  closeSync(sink.fileDescriptor);
}

export function rotateLogSink(
  sink: LogSink,
  maxRotatedFiles: number,
): string | undefined {
  if (sink.bytesWritten === 0) return undefined;

  closeSync(sink.fileDescriptor);
  const rotatedPath = buildRotatedLogPath(sink.path);
  renameSync(sink.path, rotatedPath);
  pruneRotatedLogs(sink.path, maxRotatedFiles, rotatedPath);

  sink.fileDescriptor = openSync(sink.path, 'w');
  sink.bytesWritten = 0;

  return rotatedPath;
}

export function writeToLogSink(
  sink: LogSink,
  data: Buffer | string,
  maxBytes: number,
  maxRotatedFiles: number,
): string[] {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const rotatedPaths: string[] = [];
  let offset = 0;

  while (offset < buffer.length) {
    if (sink.bytesWritten >= maxBytes) {
      const rotatedPath = rotateLogSink(sink, maxRotatedFiles);
      if (rotatedPath != null) rotatedPaths.push(rotatedPath);
    }

    const writableBytes = Math.min(
      maxBytes - sink.bytesWritten,
      buffer.length - offset,
    );
    const chunk = buffer.subarray(offset, offset + writableBytes);
    writeSync(sink.fileDescriptor, chunk);
    sink.bytesWritten += chunk.length;
    offset += chunk.length;
  }

  return rotatedPaths;
}

export function writeJsonlEntry(
  sink: LogSink,
  entry: Record<string, unknown>,
  maxBytes: number,
  maxRotatedFiles: number,
): string | undefined {
  const buffer = Buffer.from(`${JSON.stringify(entry)}\n`);

  if (sink.bytesWritten > 0 && sink.bytesWritten + buffer.length > maxBytes) {
    rotateLogSink(sink, maxRotatedFiles);
  }

  writeSync(sink.fileDescriptor, buffer);
  sink.bytesWritten += buffer.length;

  return sink.path;
}
