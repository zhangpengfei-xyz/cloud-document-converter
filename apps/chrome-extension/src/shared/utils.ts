export const compare = (a: number, b: number): 0 | 1 | -1 => {
  if (a === b) return 0

  return a > b ? 1 : -1
}

export function isDefined<T>(arg: T | null | undefined): arg is T {
  return arg !== null && arg !== undefined
}
