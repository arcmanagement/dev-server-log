import { join, parse } from 'node:path';

export function createJsonlPath(logPath: string): string {
  const parsed = parse(logPath);
  return join(parsed.dir, `${parsed.name}.jsonl`);
}
