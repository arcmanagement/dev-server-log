import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { createChildEnv } from '../src/color.js';
import { runLoggedProcess } from '../src/process.js';

function terminal(options: { isTTY?: boolean; colorDepth?: number }): Writable {
  const stream = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  return Object.assign(stream, {
    isTTY: options.isTTY,
    getColorDepth: () => options.colorDepth ?? 4,
  });
}

describe('createChildEnv', () => {
  it('passes the terminal color level through FORCE_COLOR', () => {
    expect(
      createChildEnv({}, terminal({ isTTY: true, colorDepth: 4 })).FORCE_COLOR,
    ).toBe('1');
    expect(
      createChildEnv({}, terminal({ isTTY: true, colorDepth: 8 })).FORCE_COLOR,
    ).toBe('2');
    expect(
      createChildEnv({}, terminal({ isTTY: true, colorDepth: 24 })).FORCE_COLOR,
    ).toBe('3');
  });

  it('does not force colors when the terminal cannot show them', () => {
    expect(createChildEnv({}, terminal({})).FORCE_COLOR).toBeUndefined();
    expect(
      createChildEnv({}, terminal({ isTTY: true, colorDepth: 1 })).FORCE_COLOR,
    ).toBeUndefined();
  });

  it('respects FORCE_COLOR and NO_COLOR from the environment', () => {
    const tty = terminal({ isTTY: true, colorDepth: 24 });
    expect(createChildEnv({ FORCE_COLOR: '0' }, tty).FORCE_COLOR).toBe('0');
    expect(createChildEnv({ NO_COLOR: '1' }, tty).FORCE_COLOR).toBeUndefined();
    expect(createChildEnv({ NO_COLOR: '' }, tty).FORCE_COLOR).toBe('3');
  });

  it('can be disabled or forced explicitly', () => {
    expect(
      createChildEnv({}, terminal({ isTTY: true, colorDepth: 24 }), false)
        .FORCE_COLOR,
    ).toBeUndefined();
    expect(createChildEnv({}, terminal({}), true).FORCE_COLOR).toBe('1');
  });

  it('does not mutate the given env', () => {
    const env = {};
    createChildEnv(env, terminal({ isTTY: true }));
    expect(env).toEqual({});
  });
});

describe('runLoggedProcess colors', () => {
  it('forwards terminal color support to the command', async () => {
    let output = '';
    const terminalStdout = Object.assign(
      new Writable({
        write(chunk: Buffer, _encoding, callback) {
          output += chunk.toString();
          callback();
        },
      }),
      { getColorDepth: () => 8, isTTY: true },
    );
    const env = { ...process.env };
    delete env.FORCE_COLOR;
    delete env.NO_COLOR;

    await runLoggedProcess({
      args: ['-e', 'console.log("FORCE_COLOR=" + process.env.FORCE_COLOR)'],
      command: process.execPath,
      cwd: mkdtempSync(join(tmpdir(), 'dev-server-log-color-')),
      env,
      label: 'color',
      logPath: '.log/color.log',
      terminalStderr: terminal({}),
      terminalStdout,
    });

    expect(output).toContain('FORCE_COLOR=2');
  });
});
