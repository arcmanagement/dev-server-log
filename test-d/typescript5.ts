import type { JsonlLogEntry, RunLoggedProcessOptions } from '../dist/index.js';
import { createJsonlPath, parseByteSize, stripAnsi } from '../dist/index.js';

const options: RunLoggedProcessOptions = {
  command: 'node',
  label: 'compat',
  logPath: '.log/compat.log',
};

const entry: JsonlLogEntry = {
  event: 'output',
  label: 'compat',
  message: '\u001B[31mfailed\u001B[39m',
  messagePlain: 'failed',
  stream: 'stderr',
  timestamp: new Date().toISOString(),
};

parseByteSize('10MB');
stripAnsi(entry.message);
createJsonlPath(options.logPath);
