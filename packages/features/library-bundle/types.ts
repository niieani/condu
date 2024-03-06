export interface LibraryBundleConfig {
  moduleTarget: "esm" | "umd";
  codeTarget?: string;
  engineTarget?: string;
  binName?: string;
  export?: string;
  filename?: string;
  outDir?: string;
}
