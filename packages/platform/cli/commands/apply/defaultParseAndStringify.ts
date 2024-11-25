import path from "node:path";
import { stringify as yamlStringify, parse as yamlParse } from "yaml";
import {
  stringify as commentJsonStringify,
  parse as commentJsonParse,
} from "comment-json";
import { match, P } from "ts-pattern";

const keepRaw = <T>(value: T) => value;

export function getDefaultParse<DeserializedT>(
  filePath: string,
): (rawFileContent: string) => DeserializedT {
  const extension = path.extname(filePath);
  return match(extension)
    .with(P.string.regex(/\.ya?ml$/i), () => yamlParse)
    .with(
      P.string.regex(/\.json5?$/i),
      () => commentJsonParse as (raw: string) => DeserializedT,
    )
    .otherwise(() => keepRaw);
}

const jsonStringify = (content: unknown): string =>
  commentJsonStringify(content, undefined, 2);

export function getDefaultStringify<DeserializedT>(
  filePath: string,
): (content: DeserializedT) => string {
  const extension = path.extname(filePath);
  return match(extension)
    .with(P.string.regex(/\.ya?ml$/i), () => yamlStringify)
    .otherwise(() => jsonStringify);
}
