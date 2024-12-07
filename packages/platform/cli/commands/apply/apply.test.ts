import type { StateDeclarationApi } from "@condu/cli/commands/apply/conduApi.js";

declare const packageCondu: StateDeclarationApi;

packageCondu.ignoreFile(".giti", { gitignore: true });
packageCondu.generateFile("package.json", {
  content: { name: "" },
});
packageCondu.modifyGeneratedFile("package.json", {
  content(content, pkg) {
    return content;
  },
});
packageCondu.modifyUserEditableFile("p.json", {
  parse(rawFileContent) {
    return JSON.parse(rawFileContent) as { name: string };
  },
  stringify(content) {
    return JSON.stringify(content);
  },
  content(content, pkg) {
    return content!;
  },
  ifNotExists: true,
});
packageCondu.modifyUserEditableFile("p.json", {
  content(content, pkg) {
    return content!;
  },
  ifNotExists: true,
});

packageCondu.modifyUserEditableFile("p", {
  content(content, pkg) {
    return content!;
  },
  ifNotExists: true,
});

// @ts-expect-error
packageCondu.modifyUserEditableFile("package.json", {
  content(content, pkg) {
    return content!;
  },
});
