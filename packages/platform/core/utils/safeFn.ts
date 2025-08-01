interface FulfilledResult<T> {
  status: "fulfilled";
  value: T;
}
interface RejectedResult {
  status: "rejected";
  reason: unknown;
}

type SafeReturn<TOut> =
  TOut extends Promise<unknown>
    ? Promise<FulfilledResult<Awaited<TOut>> | RejectedResult>
    : FulfilledResult<Awaited<TOut>> | RejectedResult;

export const safeFn =
  <TArgs, TOut>(fn: (...args: TArgs[]) => TOut) =>
  (...args: TArgs[]): SafeReturn<TOut> => {
    try {
      const maybePromise = fn(...args);

      if (maybePromise instanceof Promise) {
        return maybePromise
          .catch((error) => ({
            status: "rejected",
            reason: error,
          }))
          .then((result) => ({
            status: "fulfilled",
            value: result,
          })) as SafeReturn<TOut>;
      }

      return {
        status: "fulfilled",
        value: maybePromise,
      } as SafeReturn<TOut>;
    } catch (error) {
      return {
        status: "rejected",
        reason: error,
      } as SafeReturn<TOut>;
    }
  };
