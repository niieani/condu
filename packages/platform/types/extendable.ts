// these are public interfaces used for inter-feature communication
// they should be extended via declaration merging in the feature implementation

export interface PeerContext {
  // TODO: maybe we move as much of functionality into condu context that's always there?
  // condu: { _: string };
  global: GlobalPeerContext;
}

/**
 * a public interface that can be extended by features to include additional global context
 * think of it as global, shared attributes that can be set and modified by features
 */
export interface GlobalPeerContext {
  execWithTsSupport: boolean;
}

export interface GlobalFileAttributes {
  /**
   * when set to true, file will not be published to npm
   */
  npmignore?: boolean;

  /**
   * internal flag that is set by the apply command
   * to indicate that the file was created in all packages in the monorepo (except the root)
   */
  inAllPackages?: boolean;

  /**
   * when set to true, the file will always be overwritten without asking,
   * even if it contains local changes
   */
  alwaysOverwrite?: boolean;
}

/**
 * a public interface that can be extended by features to include additional file types
 * all these need to be created using generateFile call with a parse and stringify method
 */
export interface FileNameToSerializedTypeMapping {
  // never allow creating package.json using the apply command:
  "package.json": never;
}
