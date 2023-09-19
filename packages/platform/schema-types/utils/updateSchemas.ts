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
    let topLevelSchemaNameSource = schema.title ?? schema.$id ?? schema.id;
    const createdName = `${name[0].toUpperCase()}${name.slice(1)}`;
    if (!isValidIdentifier(topLevelSchemaNameSource)) {
      topLevelSchemaNameSource = createdName;
      schema.title = createdName;
    }
    let ts = (
      await compile(schema, name, {
        strictIndexSignatures: true,
      })
    ).replaceAll(
      // fix for Property '...' of type '... | undefined' is not assignable to 'string' index type '...[]'. ts(2411)
      /\[k: string\]: (.+);/g,
      (match, type) =>
        type.includes("undefined")
          ? match
          : `[k: string]: (${type}) | undefined;`,
    );

    // fixes specific to bugs in the json-schema-to-typescript output:
    if (name === "packageJson") {
      ts = ts.replace(/} & Person1;/g, `} | Person1;`);
    }

    ts += `\nexport default ${topLevelSchemaNameSource};\n`;

    promises.push(
      fs
        .writeFile(path.join(outputDirectory, `${name}.ts`), ts)
        .catch(console.error),
    );
  }
  await Promise.all(promises);
}

await updateSchemas();
