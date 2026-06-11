export const trimTrailingLineBreak = (input: string): string =>
  input.length > 0 && input.endsWith('\n') ? input.slice(0, -1) : input
