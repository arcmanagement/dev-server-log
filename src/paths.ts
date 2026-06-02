import { parse, resolve } from 'node:path';

export function createJsonlPath(logPath: string): string {
  const parsed = parse(logPath);
  return resolve(parsed.dir, `${parsed.name}.jsonl`);
}

export function normalizeForwardedArgs(args: string[]): string[] {
  const forwardedArgs = [...args];
  if (forwardedArgs[0] === '--') {
    forwardedArgs.shift();
  }
  return forwardedArgs;
}
