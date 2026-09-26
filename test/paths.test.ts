import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createJsonlPath } from '../src/paths.js';

describe('createJsonlPath', () => {
  it('replaces the extension and keeps relative paths relative', () => {
    expect(createJsonlPath('.log/start-dev.log')).toBe('.log/start-dev.jsonl');
    expect(createJsonlPath('dev.log')).toBe('dev.jsonl');
    expect(createJsonlPath('.log/dev')).toBe('.log/dev.jsonl');
  });

  it('keeps absolute paths absolute', () => {
    const logPath = resolve('/var/log/app/dev.log');
    expect(createJsonlPath(logPath)).toBe(resolve('/var/log/app/dev.jsonl'));
  });
});
