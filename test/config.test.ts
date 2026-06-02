import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LOG_MAX_BYTES,
  DEFAULT_LOG_MAX_ROTATED_FILES,
  parseByteSize,
  parseNonNegativeInteger,
  resolveLogMaxBytes,
  resolveLogMaxRotatedFiles,
} from '../src/config.js';

describe('config parsing', () => {
  it('parses byte sizes', () => {
    expect(parseByteSize('10485760')).toBe(10 * 1024 * 1024);
    expect(parseByteSize('10MB')).toBe(10 * 1024 * 1024);
    expect(parseByteSize('10MiB')).toBe(10 * 1024 * 1024);
    expect(parseByteSize('5kb')).toBe(5 * 1024);
  });

  it('rejects invalid byte sizes', () => {
    expect(() => parseByteSize('0')).toThrow('positive integer');
    expect(() => parseByteSize('10GB')).toThrow('Invalid');
    expect(() => parseByteSize('abc')).toThrow('Invalid');
  });

  it('parses non-negative integers', () => {
    expect(parseNonNegativeInteger('0')).toBe(0);
    expect(parseNonNegativeInteger('2')).toBe(2);
    expect(() => parseNonNegativeInteger('-1')).toThrow('non-negative');
  });

  it('uses explicit values before env and env before defaults', () => {
    expect(resolveLogMaxBytes({}, undefined)).toBe(DEFAULT_LOG_MAX_BYTES);
    expect(resolveLogMaxRotatedFiles({}, undefined)).toBe(
      DEFAULT_LOG_MAX_ROTATED_FILES,
    );
    expect(
      resolveLogMaxBytes({ DEV_SERVER_LOG_MAX_BYTES: '1KB' }, undefined),
    ).toBe(1024);
    expect(
      resolveLogMaxRotatedFiles(
        { DEV_SERVER_LOG_MAX_ROTATED_FILES: '4' },
        undefined,
      ),
    ).toBe(4);
    expect(resolveLogMaxBytes({ DEV_SERVER_LOG_MAX_BYTES: '1KB' }, 100)).toBe(
      100,
    );
    expect(
      resolveLogMaxRotatedFiles({ DEV_SERVER_LOG_MAX_ROTATED_FILES: '4' }, 1),
    ).toBe(1);
  });
});
