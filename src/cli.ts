#!/usr/bin/env node
import { Command, InvalidArgumentError } from 'commander';

import { parseByteSize, parseNonNegativeInteger } from './config.js';
import { runLoggedProcess } from './process.js';
import type { RunLoggedProcessOptions } from './types.js';

type CliOptions = {
  name: string;
  log: string;
  jsonl?: string;
  maxBytes?: number;
  maxRotatedFiles?: number;
};

const program = new Command();

program
  .name('devlog')
  .description(
    'Tee a dev server command to terminal, plain text log, and JSONL log.',
  )
  .requiredOption(
    '-n, --name <name>',
    'label written to lifecycle and JSONL entries',
  )
  .requiredOption('-l, --log <path>', 'plain text log path')
  .option(
    '-j, --jsonl <path>',
    'JSONL log path; defaults to the --log path with .jsonl extension',
  )
  .option(
    '--max-bytes <size>',
    'max bytes per log before rotation, e.g. 10MB',
    (raw) => {
      try {
        return parseByteSize(raw, '--max-bytes');
      } catch (error) {
        throw new InvalidArgumentError(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  )
  .option(
    '--max-rotated-files <count>',
    'number of rotated files to keep',
    (raw) => {
      try {
        return parseNonNegativeInteger(raw, '--max-rotated-files');
      } catch (error) {
        throw new InvalidArgumentError(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  )
  .argument(
    '<command...>',
    'command to run; put it after -- when it has its own options',
  )
  .allowExcessArguments(false);

program.parse(process.argv);

const options = program.opts<CliOptions>();
const commandArgs = program.args;
const command = commandArgs[0];

if (command == null) {
  program.error('missing command');
}

const args = commandArgs.slice(1);
const childCommand = command as string;
const runOptions: RunLoggedProcessOptions = {
  args,
  command: childCommand,
  label: options.name,
  logPath: options.log,
};

if (options.jsonl != null) {
  runOptions.jsonlPath = options.jsonl;
}

if (options.maxBytes != null) {
  runOptions.maxBytes = options.maxBytes;
}

if (options.maxRotatedFiles != null) {
  runOptions.maxRotatedFiles = options.maxRotatedFiles;
}

try {
  const result = await runLoggedProcess(runOptions);
  process.exitCode = result.exitCode;
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
