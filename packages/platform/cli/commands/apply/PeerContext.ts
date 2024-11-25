// Define PeerContext as an empty interface to be extended via declaration merging

export interface PeerContext {
  // TODO: maybe we move as much of functionality into condu context that's always there?
  condu: { _: string };
}
