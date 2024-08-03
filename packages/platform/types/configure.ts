import type { ConduConfigInput, GetConduConfigPromise } from "./configTypes.js";

// export const CONFIGURED = Symbol.for("Configured");
export const CONFIGURED = "__configured__";

export const configure = (config: ConduConfigInput): GetConduConfigPromise =>
  typeof config === "function"
    ? (...args) =>
        Promise.resolve(config(...args)).then((config) => ({
          ...config,
          [CONFIGURED]: true,
        }))
    : () =>
        Promise.resolve({
          ...config,
          [CONFIGURED]: true,
        });
