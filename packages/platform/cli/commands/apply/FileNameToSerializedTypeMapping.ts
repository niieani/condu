import type { ConduPackageJson } from "./ConduPackageEntry.js";

// a public interface that can be extended by features to include additional file types
// all these need to be created using generateFile call with a parse and stringify method

export interface FileNameToSerializedTypeMapping {
  ".gitignore": Array<string>;
  "package.json": ConduPackageJson;
}
