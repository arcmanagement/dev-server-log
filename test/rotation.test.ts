import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  closeLogSink,
  createLogSink,
  writeToLogSink,
} from '../src/rotation.js';

function writeChunks(chunks: string[], maxBytes: number): string[] {
  const logPath = join(
    mkdtempSync(join(tmpdir(), 'dev-server-log-rotation-')),
    'test.log',
  );
  const sink = createLogSink(logPath, 100);
  const rotatedPaths = chunks.flatMap((chunk) =>
    writeToLogSink(sink, chunk, maxBytes, 100),
  );
  closeLogSink(sink);

  return [...rotatedPaths, logPath].map((path) => readFileSync(path, 'utf8'));
}

describe('writeToLogSink', () => {
  it('rotates after the last line that fits', () => {
    expect(writeChunks(['aaaa\nbbbb\ncccc\n'], 10)).toEqual([
      'aaaa\nbbbb\n',
      'cccc\n',
    ]);
  });

  it('keeps lines that span chunks in one file', () => {
    expect(writeChunks(['aaaa\nbb', 'bb\ncccc\n'], 10)).toEqual([
      'aaaa\nbbbb\n',
      'cccc\n',
    ]);
  });

  it('starts a line that does not fit in a new file', () => {
    expect(writeChunks(['ab\n', 'cdefghi\n'], 10)).toEqual([
      'ab\n',
      'cdefghi\n',
    ]);
  });

  it('splits only lines longer than a whole file', () => {
    expect(writeChunks(['ab\n', `${'x'.repeat(12)}\n`], 10)).toEqual([
      'ab\n',
      'x'.repeat(10),
      'xx\n',
    ]);
  });

  it('does not split multi-byte UTF-8 characters', () => {
    expect(writeChunks(['あいう'], 4)).toEqual(['あ', 'い', 'う']);

    const text = 'エラー: ビルドに失敗しました\n'.repeat(3);
    const files = writeChunks([text], 16);
    expect(files.join('')).toBe(text);
    for (const file of files) {
      expect(file).not.toContain('\uFFFD');
      expect(Buffer.byteLength(file)).toBeLessThanOrEqual(16);
    }
  });
});
