import type { Writable } from 'node:stream';

type TerminalWritable = Writable & {
  isTTY?: boolean;
  getColorDepth?: (env?: NodeJS.ProcessEnv) => number;
};

function colorLevel(depth: number): number {
  if (depth >= 24) return 3;
  if (depth >= 8) return 2;
  return 1;
}

// The child writes to pipes, so tools that detect color support from
// isTTY would disable colors. Pass the terminal's color support through
// FORCE_COLOR unless the user already decided with FORCE_COLOR/NO_COLOR.
export function createChildEnv(
  env: NodeJS.ProcessEnv,
  terminal: Writable,
  forceColor?: boolean,
): NodeJS.ProcessEnv {
  if (forceColor === false) return env;
  if (env.FORCE_COLOR != null || (env.NO_COLOR ?? '') !== '') return env;

  const { getColorDepth, isTTY } = terminal as TerminalWritable;
  const depth = isTTY === true ? (getColorDepth?.call(terminal, env) ?? 4) : 1;
  if (forceColor !== true && depth < 4) return env;

  return { ...env, FORCE_COLOR: String(colorLevel(depth)) };
}
