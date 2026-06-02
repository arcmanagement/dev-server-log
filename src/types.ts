import type { Writable } from 'node:stream';

export type LogStream = 'stdout' | 'stderr';

export type JsonlLogEntry =
  | JsonlStartLogEntry
  | JsonlOutputLogEntry
  | JsonlSignalLogEntry
  | JsonlErrorLogEntry
  | JsonlExitLogEntry;

export type JsonlBaseLogEntry = {
  timestamp: string;
  label: string;
};

export type JsonlStartLogEntry = JsonlBaseLogEntry & {
  event: 'start';
  command: string;
  args: string[];
  cwd: string;
  logPath: string;
  jsonlPath: string;
  logMaxBytes: number;
  logMaxRotatedFiles: number;
};

export type JsonlOutputLogEntry = JsonlBaseLogEntry & {
  event: 'output';
  stream: LogStream;
  message: string;
  messagePlain: string;
};

export type JsonlSignalLogEntry = JsonlBaseLogEntry & {
  event: 'signal';
  message: string;
  messagePlain: string;
  signal: NodeJS.Signals;
};

export type JsonlErrorLogEntry = JsonlBaseLogEntry & {
  event: 'error';
  message: string;
  messagePlain: string;
  errorName: string;
  errorMessage: string;
};

export type JsonlExitLogEntry = JsonlBaseLogEntry & {
  event: 'exit';
  message: string;
  messagePlain: string;
  code: number | null;
  signal: NodeJS.Signals | null;
  exitCode: number;
};

export type RunLoggedProcessOptions = {
  label: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  logPath: string;
  jsonlPath?: string;
  maxBytes?: number;
  maxRotatedFiles?: number;
  terminalStdout?: Writable;
  terminalStderr?: Writable;
};

export type RunLoggedProcessResult = {
  exitCode: number;
  code: number | null;
  signal: NodeJS.Signals | null;
  logPath: string;
  jsonlPath: string;
};
