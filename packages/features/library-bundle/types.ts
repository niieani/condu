export interface LibraryBundleConfig {
  moduleTarget: "esm" | "umd";
  codeTarget?: string;
  engineTarget?: string;
  name?: string;
  export?: string;
  filename?: string;
  outDir?: string;
}
