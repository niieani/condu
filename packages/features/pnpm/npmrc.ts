import type { types as npmRcTypes } from "@pnpm/config";

type ResolvedType<T> = T extends boolean
  ? boolean
  : T extends string
    ? string
    : T extends number
      ? number
      : T extends BooleanConstructor
        ? boolean
        : T extends StringConstructor
          ? string
          : T extends NumberConstructor
            ? number
            : T extends ArrayConstructor
              ? string[]
              : T extends Function
                ? string
                : T extends null
                  ? null
                  : string;

// Transformation type that maps each property accordingly
type Transform<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? ResolvedType<U>
    : ResolvedType<T[K]>;
};

export type FullPnpmConfig = Transform<typeof npmRcTypes>;
