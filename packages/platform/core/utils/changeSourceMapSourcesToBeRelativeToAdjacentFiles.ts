import * as path from "node:path";

export function changeSourceMapSourcesToBeRelativeToAdjacentFiles(
  map: RawSourceMap,
) {
  map.sources = map.sources.map((source) =>
    source.startsWith(".") ? path.basename(source) : source,
  );
  return map;
}

// https://github.com/microsoft/TypeScript/blob/514f7e639a2a8466c075c766ee9857a30ed4e196/src/harness/documentsUtil.ts#L43C1-L53C1
export interface RawSourceMap {
  version: number;
  file: string;
  sourceRoot?: string;
  sources: string[];
  sourcesContent?: string[];
  names: string[];
  mappings: string;
}
