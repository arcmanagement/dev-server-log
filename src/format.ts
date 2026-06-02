export function quoteCommandPart(part: string): string {
  if (/^[A-Za-z0-9_./:=@%+-]+$/.test(part)) return part;
  return `'${part.replaceAll("'", "'\\''")}'`;
}

export function formatCommand(command: string, args: string[]): string {
  return [command, ...args].map(quoteCommandPart).join(' ');
}
