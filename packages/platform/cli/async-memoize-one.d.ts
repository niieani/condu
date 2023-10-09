declare module "async-memoize-one" {
  type EqualityFn = <T>(a: T[], b: T[]) => boolean;

  interface Options {
    cachePromiseRejection?: boolean;
  }

  function memoizeOne<T extends (...args: unknown[]) => unknown>(
    fn: T,
    isEqual?: EqualityFn,
    options?: Options,
  ): T;

  export default memoizeOne;
}
