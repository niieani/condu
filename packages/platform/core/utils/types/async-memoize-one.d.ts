declare module "async-memoize-one" {
  function asyncMemoizeOne<TFn extends (...params: any[]) => Promise<any>>(
    callback: TFn,
  ): TFn;

  export default asyncMemoizeOne;
}
