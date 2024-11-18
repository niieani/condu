import type { PackageCondu } from "@condu/types/applyTypes.js";

declare const packageCondu: PackageCondu;

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
    return JSON.parse(rawFileContent) as PackageCondu;
  },
  stringify(content) {
    return JSON.stringify(content);
  },
  content(content, pkg) {
    return content;
  },
  createIfNotExists: true,
});
packageCondu.modifyUserEditableFile("p.json", {
  content(content, pkg) {
    return content;
  },
  createIfNotExists: true,
});

packageCondu.modifyUserEditableFile("p", {
  content(content, pkg) {
    return content;
  },
  createIfNotExists: true,
});

// @ts-expect-error
packageCondu.modifyUserEditableFile("package.json", {
  content(content, pkg) {
    return content;
  },
});
