export type SwapArrayPropertiesToReadonlyArrays<T> = {
  [P in keyof T]: T[P] extends Array<infer O> ? ReadonlyArray<O> : T[P];
};
