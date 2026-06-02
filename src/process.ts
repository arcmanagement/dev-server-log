import { resolve } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import spawn from 'cross-spawn';

import { stripAnsi } from './ansi.js';
import { resolveLogMaxBytes, resolveLogMaxRotatedFiles } from './config.js';
import { formatCommand } from './format.js';
import { createJsonlPath } from './paths.js';
import {
  closeLogSink,
  createLogSink,
  rotateLogSink,
  writeJsonlEntry,
  writeToLogSink,
} from './rotation.js';
import type {
  LogStream,
  RunLoggedProcessOptions,
  RunLoggedProcessResult,
} from './types.js';

const signalExitCodes: Partial<Record<NodeJS.Signals, number>> = {
  SIGINT: 130,
  SIGTERM: 143,
};

export async function runLoggedProcess({
  label,
  command,
  args = [],
  cwd = process.cwd(),
  env = process.env,
  logPath,
  jsonlPath,
  maxBytes,
  maxRotatedFiles,
  terminalStdout = process.stdout,
  terminalStderr = process.stderr,
}: RunLoggedProcessOptions): Promise<RunLoggedProcessResult> {
  const resolvedLogPath = resolve(cwd, logPath);
  const resolvedJsonlPath = resolve(
    cwd,
    jsonlPath ?? createJsonlPath(resolvedLogPath),
  );
  const logMaxBytes = resolveLogMaxBytes(env, maxBytes);
  const logMaxRotatedFiles = resolveLogMaxRotatedFiles(env, maxRotatedFiles);
  const logSink = createLogSink(resolvedLogPath, logMaxRotatedFiles);
  const jsonlSink = createLogSink(resolvedJsonlPath, logMaxRotatedFiles);
  const outputBuffers: Record<LogStream, string> = {
    stderr: '',
    stdout: '',
  };
  const outputDecoders: Record<LogStream, StringDecoder> = {
    stderr: new StringDecoder('utf8'),
    stdout: new StringDecoder('utf8'),
  };

  const writePlainLog = (data: Buffer | string) => {
    for (const rotatedPath of writeToLogSink(
      logSink,
      data,
      logMaxBytes,
      logMaxRotatedFiles,
    )) {
      terminalStderr.write(`[${label}] rotated log to ${rotatedPath}\n`);
    }
  };

  const writeJsonl = (entry: Record<string, unknown>) => {
    const beforePath = jsonlSink.path;
    const beforeBytes = jsonlSink.bytesWritten;
    if (beforeBytes > 0) {
      const estimated = Buffer.byteLength(
        `${JSON.stringify({ timestamp: new Date().toISOString(), label, ...entry })}\n`,
      );
      if (beforeBytes + estimated > logMaxBytes) {
        const rotatedPath = rotateLogSink(jsonlSink, logMaxRotatedFiles);
        if (rotatedPath != null) {
          terminalStderr.write(
            `[${label}] rotated jsonl log to ${rotatedPath}\n`,
          );
        }
      }
    }

    writeJsonlEntry(
      jsonlSink,
      {
        timestamp: new Date().toISOString(),
        label,
        ...entry,
      },
      logMaxBytes,
      logMaxRotatedFiles,
    );

    if (beforePath !== jsonlSink.path) {
      terminalStderr.write(`[${label}] rotated jsonl log from ${beforePath}\n`);
    }
  };

  const writeLifecycleLog = (
    event: 'error' | 'exit' | 'signal',
    message: string,
    extra: Record<string, unknown>,
  ) => {
    writePlainLog(`\n[${new Date().toISOString()}] ${label} ${message}\n`);
    writeJsonl({
      event,
      message,
      messagePlain: message,
      ...extra,
    });
  };

  const writeOutputJsonl = (stream: LogStream, data: Buffer) => {
    outputBuffers[stream] += outputDecoders[stream].write(data);

    const lines = outputBuffers[stream].split(/\r?\n/);
    outputBuffers[stream] = lines.pop() ?? '';

    for (const line of lines) {
      writeJsonl({
        event: 'output',
        stream,
        message: line,
        messagePlain: stripAnsi(line),
      });
    }
  };

  const flushOutputJsonl = () => {
    for (const stream of ['stdout', 'stderr'] as const) {
      outputBuffers[stream] += outputDecoders[stream].end();
      const message = outputBuffers[stream];
      if (message === '') continue;

      writeJsonl({
        event: 'output',
        stream,
        message,
        messagePlain: stripAnsi(message),
      });
      outputBuffers[stream] = '';
    }
  };

  writePlainLog(`[${new Date().toISOString()}] ${label} started\n`);
  writePlainLog(`$ ${formatCommand(command, args)}\n`);
  writePlainLog(`log max bytes: ${logMaxBytes}\n`);
  writePlainLog(`log max rotated files: ${logMaxRotatedFiles}\n\n`);
  writeJsonl({
    event: 'start',
    command,
    args,
    cwd,
    logPath: resolvedLogPath,
    jsonlPath: resolvedJsonlPath,
    logMaxBytes,
    logMaxRotatedFiles,
  });
  terminalStderr.write(
    `[${label}] writing logs to ${resolvedLogPath} and ${resolvedJsonlPath} (max ${logMaxBytes} bytes, ${logMaxRotatedFiles} rotated files)\n`,
  );

  return await new Promise<RunLoggedProcessResult>((resolveResult) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['inherit', 'pipe', 'pipe'],
    });
    let didFinish = false;

    const finish = (
      code: number | null,
      signal: NodeJS.Signals | null,
      exitCode: number,
    ) => {
      if (didFinish) return;
      didFinish = true;
      process.off('SIGINT', handleSigint);
      process.off('SIGTERM', handleSigterm);
      closeLogSink(logSink);
      closeLogSink(jsonlSink);
      resolveResult({
        code,
        exitCode,
        jsonlPath: resolvedJsonlPath,
        logPath: resolvedLogPath,
        signal,
      });
    };

    const handleSignal = (signal: NodeJS.Signals) => {
      writeLifecycleLog('signal', `received ${signal}`, { signal });
      child.kill(signal);
    };

    const handleSigint = () => {
      handleSignal('SIGINT');
    };

    const handleSigterm = () => {
      handleSignal('SIGTERM');
    };

    child.stdout?.on('data', (data: Buffer) => {
      terminalStdout.write(data);
      writePlainLog(data);
      writeOutputJsonl('stdout', data);
    });

    child.stderr?.on('data', (data: Buffer) => {
      terminalStderr.write(data);
      writePlainLog(data);
      writeOutputJsonl('stderr', data);
    });

    child.on('error', (error) => {
      terminalStderr.write(`${error.message}\n`);
      writeLifecycleLog('error', `failed: ${error.message}`, {
        errorName: error.name,
        errorMessage: error.message,
      });
      finish(null, null, 1);
    });

    child.on('close', (code, signal) => {
      flushOutputJsonl();
      const exitDescription =
        signal == null ? `code ${code ?? 0}` : `signal ${signal}`;
      const exitCode =
        signal == null ? (code ?? 0) : (signalExitCodes[signal] ?? 1);

      writeLifecycleLog('exit', `exited with ${exitDescription}`, {
        code,
        signal,
        exitCode,
      });
      finish(code, signal, exitCode);
    });

    process.once('SIGINT', handleSigint);
    process.once('SIGTERM', handleSigterm);
  });
}
