import type { Exact, RequireExactlyOne } from "type-fest";

export interface Container {
  // extensible by importing and augmenting
  abc: string;
}

const container: Partial<Container> = {};

export const register = (implementations: Partial<Container>) => {
  Object.assign(container, implementations);
};

const DI_PREFIX = "$";
type DI_PREFIX = typeof DI_PREFIX;

type RemovePrefix<T extends `${DI_PREFIX}${string}`> =
  T extends `${DI_PREFIX}${infer K}` ? K : never;
const removePrefix = <T extends `${DI_PREFIX}${string}`>(key: T) =>
  key.slice(1) as RemovePrefix<T>;

// TODO: use import https://github.com/sindresorhus/type-fest/pull/682
export type UnionToIntersection<Union> =
  // `extends unknown` is always going to be the case and is used to convert the
  // `Union` into a [distributive conditional
  // type](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-8.html#distributive-conditional-types).
  (
    Union extends unknown
      ? // The union type is used as the only argument to a function since the union
        // of function arguments is an intersection.
        (distributedUnion: Union) => void
      : // This won't happen.
        never
  ) extends // Infer the `Intersection` type since TypeScript represents the positional
  // arguments of unions of functions as an intersection of the union.
  (mergedIntersection: infer Intersection) => void
    ? Intersection & Union
    : never;

type PrefixedContainer<K extends keyof Container = keyof Container> =
  K extends K
    ? {
        [Key in K as `${DI_PREFIX}${K}`]: Container[Key];
      }
    : never;

type EnsureFunction<T> = T extends (...args: unknown[]) => unknown
  ? T
  : () => T;

type EnsureDiFunction<T> = EnsureFunction<T> & {
  defaultImplementation: T;
  implementation: T;
};

// TODO: don't even need to use a centralized container -- each function is its own container!
// TODO: simplify, simplify, simplify (no need for the prefix)
// TODO: maybe automation for node/bun to re-route imports to use the DI functions in tests?
// TODO: ensure we use function.apply and pass the correct `this` context
export const withDi = <Implementation extends PrefixedContainer>(
  defaultImplementationObj: RequireExactlyOne<Implementation>,
): EnsureDiFunction<
  Implementation[UnionToIntersection<keyof Implementation>]
> => {
  const keys = Object.keys(defaultImplementationObj) as (keyof Implementation &
    `${DI_PREFIX}${keyof Container}`)[];
  if (keys.length > 1) {
    throw new Error(
      `You need to provide a single implementation to 'withDi', you provided: ${keys.join(
        ", ",
      )}`,
    );
  }
  const prefixedKey = keys[0];
  const defaultImplementation = defaultImplementationObj[prefixedKey] as
    | Container[keyof Container]
    | undefined;
  const key = removePrefix(prefixedKey);

  let diFunction: EnsureFunction<
    Implementation[UnionToIntersection<keyof Implementation>]
  >;

  if (typeof defaultImplementation === "function") {
    const implementation = (container[key] ??
      defaultImplementation) as NonNullable<typeof defaultImplementation>;
    const fn: typeof implementation = (...args) => implementation(...args);
    diFunction = fn as EnsureFunction<
      Implementation[UnionToIntersection<keyof Implementation>]
    >;
  } else {
    // for values that are not functions, we return a getter function that returns the value
    const fn = () =>
      (container[key] ?? defaultImplementation) as NonNullable<
        typeof defaultImplementation
      >;
    diFunction = fn as EnsureFunction<
      Implementation[UnionToIntersection<keyof Implementation>]
    >;
  }

  const fn = Object.assign(diFunction, { defaultImplementation });
  Object.defineProperty(fn, "implementation", {
    get: () => container[key] ?? defaultImplementation,
    set: (v) => {
      container[key] = v;
    },
  });

  return fn as EnsureDiFunction<
    Implementation[UnionToIntersection<keyof Implementation>]
  >;
};

export const registerOne = <Key extends keyof Container>(
  ...kv: [Key, Container[Key]]
) => {
  container[kv[0]] = kv[1];
};

export const get = <Key extends keyof Container>(key: Key): Container[Key] => {
  const value = container[key];
  if (!value) {
    throw new Error(`No DI value registered for key '${key}'`);
  }
  return value;
};
