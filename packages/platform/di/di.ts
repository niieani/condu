export interface Container {
  // extensible by importing and augmenting
}

const container: Partial<Container> = {};

export const register = (implementations: Partial<Container>) => {
  Object.assign(container, implementations);
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
