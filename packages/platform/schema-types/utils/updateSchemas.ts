import { compile, type JSONSchema } from "json-schema-to-typescript";
import { promises as fs } from "node:fs";
import path from "node:path";
import { schemas } from "./schemas.js";

const currentModuleUrl = import.meta.url;
const outputDirectory = new URL("../schemas/", currentModuleUrl).pathname;

const isValidIdentifier = (str: string) => /^[$A-Z_a-z][\w$]*$/.test(str);

async function updateSchemas() {
  let promises = [];
  for (const [name, url] of Object.entries(schemas)) {
    const schema = await fetch(url).then((res) => res.json() as JSONSchema);
    let topLevelSchemaNameSource = schema.title ?? schema["$id"] ?? schema.id;
    const createdName = `${name.slice(0, 1).toUpperCase()}${name.slice(1)}`;
    if (
      !topLevelSchemaNameSource ||
      !isValidIdentifier(topLevelSchemaNameSource)
    ) {
      topLevelSchemaNameSource = createdName;
      schema.title = createdName;
    }
    let ts = (
      await compile(schema, name, {
        strictIndexSignatures: true,
        format: false,
        $refOptions: {
          resolve: {
            vscode: {
              canRead: /^vscode?:\/\//,
              read(file) {
                const [, path] = file.url.split("://");
                if (!path) throw new Error("Invalid vscode:// schema path");
                return fetch(
                  `https://github.com/wraith13/vscode-schemas/raw/master/en/latest/${path}.json`,
                ).then((res) => res.json() as JSONSchema);
              },
            },
          },
        },
      })
    )
      .replaceAll(
        // fix for Property '...' of type '... | undefined' is not assignable to 'string' index type '...[]'. ts(2411)
        /^\[k: string]: ([^{]+?)$/gm,
        (match, type) =>
          type.includes("undefined")
            ? match
            : `[k: string]: (${type}) | undefined`,
      )
      // [k: string]: (string | Style)
      // fix-up empty enums like this one: https://github.com/wraith13/vscode-schemas/blob/6ca800de79fd8290e118deee170a447705f19bff/en/latest/schemas/settings/workspace.json#L2223-L2226
      // they generate invalid typescript like '()'
      .replaceAll(/\(\)(?!\s*=>)/g, "string")
      .replaceAll(
        `semanticHighlighting?: boolean
}`,
        `semanticHighlighting?: boolean
} | undefined`,
      )
      .replaceAll(
        `rules?: TokenStyling18
}`,
        `rules?: TokenStyling18
} | undefined`,
      );

    // fixes specific to bugs in the json-schema-to-typescript output:
    if (name === "packageJson") {
      ts = ts
        .replace(/} & Person1;/g, `} | Person1;`)
        // fix unescaped comment
        .replace(`.*/[a-z]*)$"`, `.*[a-z]*)$"`);
    }

    ts += `\nexport type { ${topLevelSchemaNameSource} as default };\n`;

    promises.push(
      fs
        .writeFile(path.join(outputDirectory, `${name}.gen.ts`), ts)
        .catch(console.error),
    );
  }
  await Promise.all(promises);
}

await updateSchemas();
