import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { JsonlLogEntry } from '../src/types.js';

const cliPath = resolve('dist/cli.js');

// Prints "ready", then on each forwarded signal logs it and exits 0 after
// a short graceful shutdown.
const gracefulChild = `
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log('received ' + signal);
    setTimeout(() => {
      console.log('done');
      process.exit(0);
    }, 300);
  });
}
console.log('ready');
setInterval(() => {}, 1000);
`;

type RunResult = {
  code: number | null;
  signal: NodeJS.Signals | null;
  entries: JsonlLogEntry[];
};

async function runWithSignals(signals: NodeJS.Signals[]): Promise<RunResult> {
  const cwd = mkdtempSync(join(tmpdir(), 'dev-server-log-signal-'));
  const devlog = spawn(
    process.execPath,
    [
      cliPath,
      '-n',
      'signal',
      '-l',
      '.log/signal.log',
      '--',
      process.execPath,
      '-e',
      gracefulChild,
    ],
    { cwd, stdio: ['pipe', 'pipe', 'pipe'] },
  );

  await new Promise<void>((resolveReady) => {
    devlog.stdout.on('data', (data: Buffer) => {
      if (data.toString().includes('ready')) resolveReady();
    });
  });

  const exited = new Promise<Pick<RunResult, 'code' | 'signal'>>(
    (resolveExit) => {
      devlog.on('exit', (code, signal) => resolveExit({ code, signal }));
    },
  );

  for (const signal of signals) {
    devlog.kill(signal);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
  }

  const { code, signal } = await exited;
  const entries = readFileSync(join(cwd, '.log/signal.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as JsonlLogEntry);

  return { code, entries, signal };
}

describe('signal handling', () => {
  it('keeps running until the command exits when signalled twice', async () => {
    const { code, entries, signal } = await runWithSignals([
      'SIGTERM',
      'SIGTERM',
    ]);

    expect(signal).toBeNull();
    expect(code).toBe(0);
    expect(entries.filter((entry) => entry.event === 'signal')).toHaveLength(2);
    expect(entries).toContainEqual(
      expect.objectContaining({ event: 'output', message: 'done' }),
    );
    expect(entries.at(-1)).toMatchObject({ event: 'exit', exitCode: 0 });
  });

  it('forwards SIGINT when stdin is not a terminal', async () => {
    const { code, entries } = await runWithSignals(['SIGINT']);

    expect(code).toBe(0);
    expect(entries).toContainEqual(
      expect.objectContaining({ event: 'output', message: 'received SIGINT' }),
    );
  });
});
