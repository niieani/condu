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

const jsonStringify = <DeserializedT>(content: DeserializedT): string =>
  commentJsonStringify(content, undefined, 2);
const noopStringify = <DeserializedT>(content: DeserializedT) =>
  String(content);

export function getDefaultStringify<DeserializedT>(
  filePath: string,
): (content: DeserializedT) => string {
  const extension = path.extname(filePath);
  return match(extension)
    .with(P.string.regex(/\.ya?ml$/i), () => yamlStringify)
    .with(P.string.regex(/\.json5?$/i), () => jsonStringify)
    .otherwise(() => noopStringify);
}

export const getJsonStringify = <DeserializedT>() =>
  jsonStringify as (content: DeserializedT) => string;
export const getYamlStringify = <DeserializedT>() =>
  yamlStringify as (content: DeserializedT) => string;
export const getJsonParse = <DeserializedT>() =>
  commentJsonParse as (raw: string) => DeserializedT;
export const getYamlParse = <DeserializedT>() =>
  yamlParse as (raw: string) => DeserializedT;
export const getYamlParseAndStringify = <DeserializedT>() => ({
  parse: getYamlParse<DeserializedT>(),
  stringify: getYamlStringify<DeserializedT>(),
});
export const getJsonParseAndStringify = <DeserializedT>() => ({
  parse: getJsonParse<DeserializedT>(),
  stringify: getJsonStringify<DeserializedT>(),
});
