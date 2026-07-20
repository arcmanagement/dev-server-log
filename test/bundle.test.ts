import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('bundled CLI', () => {
  it('includes Commander instead of resolving it from the consumer project', () => {
    const cliPath = resolve('dist/cli.js');
    const cliSource = readFileSync(cliPath, 'utf8');
    const output = execFileSync(process.execPath, [cliPath, '--help'], {
      encoding: 'utf8',
    });

    expect(cliSource).not.toMatch(/\bfrom\s+["']commander["']/);
    expect(output).toContain('Usage: devlog');
    expect(output).toContain('--log <path>');
  });
});
