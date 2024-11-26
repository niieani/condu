// these are public interfaces used for inter-feature communication
// they should be extended via declaration merging in the feature implementation

export interface PeerContext {
  // TODO: maybe we move as much of functionality into condu context that's always there?
  condu: { _: string };
}

export interface GlobalFileFlags {
  gitignore?: boolean;
  npmignore?: boolean;
}

/**
 * a public interface that can be extended by features to include additional file types
 * all these need to be created using generateFile call with a parse and stringify method
 */
export interface FileNameToSerializedTypeMapping {
  // never allow creating package.json using the apply command:
  "package.json": never;
}
