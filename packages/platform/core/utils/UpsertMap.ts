// can be removed once https://github.com/tc39/proposal-upsert gets to stage 4
export class UpsertMap<K, V> extends Map<K, V> {
  getOrInsert(key: K, defaultValue: V): V {
    if (this.has(key)) {
      return this.get(key)!;
    }
    this.set(key, defaultValue);
    return this.get(key)!;
  }

  getOrInsertComputed(key: K, callbackFunction: (key: K) => V): V {
    if (this.has(key)) {
      return this.get(key)!;
    }
    this.set(key, callbackFunction(key));
    return this.get(key)!;
  }
}
