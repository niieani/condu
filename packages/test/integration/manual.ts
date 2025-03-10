import { createBasicConduProject } from "./test-utils.js";

const registryPort = 4000;
const registryUrl = `http://localhost:${registryPort}`;
const testProject = await createBasicConduProject(
  `
import { configure } from "condu";
import { typescript } from "@condu-feature/typescript/typescript.js";
import { pnpm } from "@condu-feature/pnpm/pnpm.js";
import { gitignore } from "@condu-feature/gitignore/gitignore.js";

export default configure({
  features: [
    typescript(),
    pnpm(),
    gitignore(),
  ],
  projects: ["packages/*"],
  publish: {
    registry: "${registryUrl}"
  }
});`,
  {
    name: "condu-release-test-mono-root",
    version: "0.1.0",
    private: true,
    type: "module",
    devDependencies: {
      "@condu-feature/typescript": "*",
      "@condu-feature/pnpm": "*",
      "@condu-feature/gitignore": "*",
      condu: "*",
    },
  },
  {
    ".git": { refs: { remotes: { origin: { HEAD: "refs/heads/main" } } } },
    packages: {
      "pkg-a": {
        "package.json": JSON.stringify(
          {
            name: "@condu-release-test/pkg-a",
            version: "0.1.0",
            private: false,
            type: "module",
          },
          undefined,
          2,
        ),
        "index.ts": `
export function utilA(): string {
  return "This is package A";
}
              `,
      },
      "pkg-b": {
        "package.json": JSON.stringify(
          {
            name: "@condu-release-test/pkg-b",
            version: "0.1.0",
            private: false,
            type: "module",
            dependencies: {
              "@condu-release-test/pkg-a": "workspace:*",
            },
          },
          undefined,
          2,
        ),
        "index.ts": `
import { utilA } from "@condu-release-test/pkg-a";
export function utilB(): string {
  return \`Package B using: \${utilA()}\`;
}
              `,
      },
    },
  },
);

console.log(`Test project created at ${testProject.dir}`);
