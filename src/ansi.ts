const ANSI_ESCAPE_PATTERN = new RegExp(
  `${String.fromCharCode(27)}(?:[@-Z\\\\-_]|\\[[0-?]*[ -/]*[@-~])`,
  'g',
);

export function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE_PATTERN, '');
}
