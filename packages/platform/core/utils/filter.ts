export const nonEmpty = <T>(
  value: T | undefined | false | 0 | "",
): value is T => Boolean(value);
