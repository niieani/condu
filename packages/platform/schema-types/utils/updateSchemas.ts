import { compile } from "json-schema-to-typescript";
import { promises as fs } from "fs";
import path from "node:path";
import { schemas } from "./schemas.js";

const outputDirectoryUrl = import.meta.url;
const outputDirectory = new URL("../schemas/", outputDirectoryUrl).pathname;

const isValidIdentifier = (str: string) =>
  /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(str);

async function updateSchemas() {
  let promises = [];
  for (const [name, url] of Object.entries(schemas)) {
    const schema = await fetch(url).then((res) => res.json());
    if (!isValidIdentifier(schema.title)) {
      schema.title = `${name[0].toUpperCase()}${name.slice(1)}`;
    }
    const defaultExport = schema.title;
    let ts = await compile(schema, name);
    ts += `\nexport default ${defaultExport};\n`;

    promises.push(
      fs
        .writeFile(path.join(outputDirectory, `${name}.ts`), ts)
        .catch(console.error),
    );
  }
  await Promise.all(promises);
}

await updateSchemas();
