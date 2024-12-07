// possibly use @reflink/reflink
// or in bun it should be supported to do: fs.copyFileSync('a', 'b', fs.constants.COPYFILE_FICLONE_FORCE)
// we probably wanna use glob to list all source and then copy them one by one

import { walkDirectoryRecursively } from "@condu/core/utils/walkDirectoryRecursively.js";
import { defineFeature } from "condu/defineFeature.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";

interface Result {
  type: "test" | "source" | "doc";
  content: string;
  filePath: string;
}

interface FeaturePeerContext {
  ignore?: string[];
  removeComments?: boolean;
}

interface FeatureOptions extends FeaturePeerContext {
  summaryFileName?: string;
}

interface SummarizerOptions extends FeatureOptions {
  summaryFileName: string;
  rootDir: string;
  recursive?: boolean;
}

declare module "@condu/types/extendable.js" {
  interface PeerContext {
    gptSummarizer: Required<FeaturePeerContext>;
  }
}

function removeSingleLineComments(input: string): string {
  // Matches lines that start with optional whitespace followed by //, until the end of the line.
  // Includes the newline character in the match to remove the whole line.
  // The 'gm' flags ensure the pattern is applied across multiple lines and matches are made at the beginning of each line.
  return input.replaceAll(/^\s*\/\/.*(\r?\n|$)/gm, "");
}

export const summarize = async ({
  rootDir,
  recursive = true,
  ignore = [],
  removeComments = false,
  summaryFileName,
}: SummarizerOptions): Promise<string> => {
  const work: Promise<Result | undefined>[] = [];
  for await (const { directoryPath, entry } of walkDirectoryRecursively(
    rootDir,
    ({ entry }) =>
      !ignore.includes(entry.name) &&
      entry.name !== "node_modules" &&
      !entry.name.startsWith(".") &&
      // TODO: replace with CONDU_CONFIG_DIR_NAME (?)
      !/\.config\./.test(entry.name) &&
      !/\.gen\./.test(entry.name) &&
      !entry.name.endsWith(".d.ts") &&
      entry.name !== summaryFileName &&
      (recursive ? true : entry.isFile()),
  )) {
    if (entry.isDirectory()) continue;
    const isSource = /\.[cm]?[jt]sx?$/.test(entry.name);
    const isTest = isSource && /\.test\./.test(entry.name);
    const isDoc = /\.mdx?$/.test(entry.name);
    const type = isDoc
      ? "doc"
      : isTest
        ? "test"
        : isSource
          ? "source"
          : undefined;

    // skip unknown file types
    if (!type) continue;

    const fileName = entry.name;
    const filePath = path.join(directoryPath, fileName);
    work.push(
      (async (): Promise<Result | undefined> => {
        let content = await fs.readFile(filePath, { encoding: "utf-8" });

        // Remove comments containing "eslint-disable" or "@ts-expect-error"
        content = content.replace(
          /\/\*.*?(eslint-disable|@ts-expect-error|Copyright).*?\*\//gs,
          "",
        );
        content = content.replace(
          /\/\/.*?(eslint-disable|@ts-expect-error).*?$/gm,
          "",
        );
        // Reduce consecutive newlines to a single newline and trim newlines at the start and end of the file
        content = content.replace(/\n{2,}/g, "\n").trim();
        if (removeComments) {
          content = removeSingleLineComments(content);
        }
        if (!content) return;

        return {
          filePath: path.relative(rootDir, filePath),
          content,
          type,
        };
      })().catch((error) => {
        console.error(`Error reading ${filePath}:\n${error.message}`);
        return undefined;
      }),
    );
  }

  // TODO: could show progress bar
  const files = await Promise.all(work);

  // sort - first source (priority 1), then test (priority 2), then doc (priority 3)
  const summarized = files
    .filter((f): f is Result => !!f)
    .sort((a, b) => {
      const priorityA = a.type === "source" ? 1 : a.type === "test" ? 2 : 3;
      const priorityB = b.type === "source" ? 1 : b.type === "test" ? 2 : 3;
      if (priorityA < priorityB) return -1;
      return 0;
    })
    .reduce((summarized, file) => {
      summarized += `### ${file.filePath}\n\`\`\`${
        file.type === "source" ? "ts" : ""
      }\n${file.content}\n\`\`\`\n---\n`;
      return summarized;
    }, "");

  return summarized;
};

const DEFAULT_SUMMARY_FILE_NAME = "about-the-projects-and-its-source-code.md";

export const gptSummarizer = ({
  summaryFileName = DEFAULT_SUMMARY_FILE_NAME,
  ...opts
}: FeatureOptions = {}) =>
  defineFeature("gptSummarizer", {
    initialPeerContext: {
      ignore: opts.ignore ?? [],
      removeComments: opts.removeComments ?? false,
    },

    defineRecipe: async (condu, { ignore, removeComments }) => {
      const packages = condu.project.workspacePackages;
      const summarized = await summarize({
        rootDir: condu.project.config.workspaceDir,
        recursive: false,
        ignore,
        removeComments,
        summaryFileName,
      });
      let fullSummary = `# Workspace Documentation\n${summarized}\n`;
      fullSummary += "# Packages\n";
      for (const pkg of packages) {
        const summarized = await summarize({
          rootDir: pkg.absPath,
          ignore,
          removeComments,
          summaryFileName,
        });
        fullSummary += `## Package ${pkg.name}\n${summarized}\n`;
      }

      condu.root.generateFile(summaryFileName, {
        content: fullSummary,
        attributes: { alwaysOverwrite: true },
      });
    },
  });
