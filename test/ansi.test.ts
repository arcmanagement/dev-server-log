import { describe, expect, it } from 'vitest';

import { stripAnsi } from '../src/ansi.js';

describe('stripAnsi', () => {
  it('strips CSI sequences', () => {
    expect(stripAnsi('\u001B[31mfailed\u001B[39m')).toBe('failed');
    expect(stripAnsi('\u001B[1;38;5;196mbold\u001B[0m')).toBe('bold');
    expect(stripAnsi('\u001B[2K\u001B[1Gprogress')).toBe('progress');
  });

  it('strips OSC 8 hyperlinks terminated by BEL or ST', () => {
    expect(
      stripAnsi('\u001B]8;;https://example.com\u0007link\u001B]8;;\u0007'),
    ).toBe('link');
    expect(
      stripAnsi('\u001B]8;;https://example.com\u001B\\link\u001B]8;;\u001B\\'),
    ).toBe('link');
  });

  it('strips window title and other string sequences', () => {
    expect(stripAnsi('\u001B]0;vite dev\u0007ready')).toBe('ready');
    expect(stripAnsi('\u001BPq#0;2;0;0;0\u001B\\done')).toBe('done');
  });

  it('keeps plain text unchanged', () => {
    expect(stripAnsi('GET /api [200] 12ms')).toBe('GET /api [200] 12ms');
  });
});
