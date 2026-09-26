const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);

const ANSI_ESCAPE_PATTERN = new RegExp(
  [
    // OSC (ESC ]) and DCS/SOS/PM/APC (ESC P, X, ^, _) strings, terminated by
    // BEL or ST (ESC \), e.g. OSC 8 hyperlinks and window titles.
    `${ESC}[\\]PX^_][^${BEL}${ESC}]*(?:${BEL}|${ESC}\\\\)`,
    // CSI sequences such as colors and cursor movement.
    `${ESC}\\[[0-?]*[ -/]*[@-~]`,
    // Other two-character escapes.
    `${ESC}[@-Z\\\\-_]`,
  ].join('|'),
  'g',
);

export function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE_PATTERN, '');
}
