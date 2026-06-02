import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { runLoggedProcess } from '../src/process.js';
import type { JsonlLogEntry } from '../src/types.js';

class MemoryWritable extends Writable {
  chunks: Buffer[] = [];

  _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: () => void,
  ): void {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    callback();
  }

  text(): string {
    return Buffer.concat(this.chunks).toString('utf8');
  }
}

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'dev-server-log-'));
}

function readJsonl(path: string): JsonlLogEntry[] {
  return readFileSync(path, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as JsonlLogEntry);
}

describe('runLoggedProcess', () => {
  it('tees stdout and stderr to terminal, plain log, and JSONL', async () => {
    const cwd = tempDir();
    const terminalStdout = new MemoryWritable();
    const terminalStderr = new MemoryWritable();

    const result = await runLoggedProcess({
      args: [
        '-e',
        'console.log("\\u001B[31mhello\\u001B[39m"); console.error("failed");',
      ],
      command: process.execPath,
      cwd,
      label: 'test',
      logPath: '.log/test.log',
      terminalStderr,
      terminalStdout,
    });

    expect(result.exitCode).toBe(0);
    expect(terminalStdout.text()).toContain('\u001B[31mhello\u001B[39m');
    expect(terminalStderr.text()).toContain('failed');

    const plainLog = readFileSync(join(cwd, '.log/test.log'), 'utf8');
    expect(plainLog).toContain('hello');
    expect(plainLog).toContain('failed');

    const entries = readJsonl(join(cwd, '.log/test.jsonl'));
    expect(entries.some((entry) => entry.event === 'start')).toBe(true);
    expect(entries).toContainEqual(
      expect.objectContaining({
        event: 'output',
        message: '\u001B[31mhello\u001B[39m',
        messagePlain: 'hello',
        stream: 'stdout',
      }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        event: 'output',
        message: 'failed',
        messagePlain: 'failed',
        stream: 'stderr',
      }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({ event: 'exit', exitCode: 0 }),
    );
  });

  it('returns the child exit code', async () => {
    const cwd = tempDir();

    const result = await runLoggedProcess({
      args: ['-e', 'process.exit(7)'],
      command: process.execPath,
      cwd,
      label: 'exit-code',
      logPath: '.log/exit-code.log',
      terminalStderr: new MemoryWritable(),
      terminalStdout: new MemoryWritable(),
    });

    expect(result.exitCode).toBe(7);
  });

  it('rotates plain text and JSONL logs without splitting JSON lines', async () => {
    const cwd = tempDir();

    const result = await runLoggedProcess({
      args: [
        '-e',
        'for (let i = 0; i < 12; i += 1) console.log("line-" + i + "-xxxxxxxxxx")',
      ],
      command: process.execPath,
      cwd,
      label: 'rotate',
      logPath: '.log/rotate.log',
      maxBytes: 120,
      maxRotatedFiles: 2,
      terminalStderr: new MemoryWritable(),
      terminalStdout: new MemoryWritable(),
    });

    expect(result.exitCode).toBe(0);
    const files = readdirSync(join(cwd, '.log'));
    const rotatedPlain = files.filter((file) => /^rotate\..+\.log$/.test(file));
    const rotatedJsonl = files.filter((file) =>
      /^rotate\..+\.jsonl$/.test(file),
    );
    expect(rotatedPlain.length).toBeLessThanOrEqual(2);
    expect(rotatedJsonl.length).toBeLessThanOrEqual(2);
    expect(rotatedPlain.length).toBeGreaterThan(0);
    expect(rotatedJsonl.length).toBeGreaterThan(0);

    for (const file of files.filter((name) => name.endsWith('.jsonl'))) {
      const contents = readFileSync(join(cwd, '.log', file), 'utf8');
      for (const line of contents.trim().split('\n').filter(Boolean)) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    }
  });
});
