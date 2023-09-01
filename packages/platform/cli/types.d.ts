import "@pnpm/types";

declare module "@pnpm/types" {
  export interface BaseManifest {
    packageManager?: string;
  }
}
