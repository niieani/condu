import { type SourceFile, Project, ts } from "ts-morph";
import {
  TransactionalFileSystem,
  RealFileSystemHost,
  InMemoryFileSystemHost,
  TsConfigResolver,
  type FileSystemHost,
} from "@ts-morph/common";

import * as path from "node:path";
import { changeSourceMapSourcesToBeRelativeToAdjacentFiles } from "@condu/core/utils/changeSourceMapSourcesToBeRelativeToAdjacentFiles.js";

const extensionRegexp = /^\.[cm]?[jt]sx?/i;

const extensions = [
  ".js",
  ".ts",
  ".tsx",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
] as const;
type Extension = (typeof extensions)[number];

const isMappableExtension = (extension: string): extension is Extension =>
  extensions.includes(extension as Extension);

type TargetMapping = {
  [E in Extension]?: Extension;
};

interface ChangeSet {
  start: number;
  end: number;
  newText: string;
}

type PrivateTsConfigResolver = Omit<
  TsConfigResolver,
  "_parseJsonConfigFileContent"
> & {
  // this is private, but we need it
  _parseJsonConfigFileContent: () => ts.ParsedCommandLine;
};

const buildTsWithRenamedSpecifiers = async ({
  tsConfigFilePath,
  fsExtensionMapping,
  emittedExtensionMapping,
  fsHost = new RealFileSystemHost(),
  // new OverlayMemoryOnReadOnlyRealFileSystem(fsHost)
  virtualFs = new InMemoryFileSystemHost(),
}: {
  fsHost?: FileSystemHost;
  virtualFs?: FileSystemHost;
  tsConfigFilePath: string;
  fsExtensionMapping: TargetMapping;
  emittedExtensionMapping: TargetMapping;
}) => {
  const tfsHost = new TransactionalFileSystem({
    fileSystem: fsHost,
    skipLoadingLibFiles: true,
    libFolderPath: undefined,
  });

  const standardizedTsConfigPath =
    tfsHost.getStandardizedAbsolutePath(tsConfigFilePath);

  const encoding = "utf-8";
  const tsConfigResolver = new TsConfigResolver(
    tfsHost,
    standardizedTsConfigPath,
    encoding,
  ) as unknown as PrivateTsConfigResolver;

  const tsConfigContent = tsConfigResolver._parseJsonConfigFileContent();

  const tsProgram = ts.createProgram({
    options: tsConfigContent.options,
    configFileParsingDiagnostics: tsConfigContent.errors,
    projectReferences: tsConfigContent.projectReferences,
    rootNames: [],
  });

  const processedTsConfigs = new Set<string>();

  const tsConfigPathToRemappedProject = new Set<
    ts.CompilerOptions & { project: string }
  >();

  /**
   * one massive pseudo-project that contains all the files from all the referenced TS projects
   * this is to enable us to map out all the references between files
   * and rename them all at once
   * the downside of this is that it might not scale for extremely large projects
   * might be worth testing with TypeScript's own codebase
   **/
  const globalProject = new Project({
    fileSystem: fsHost,
    tsConfigFilePath,
  });
  const projects = [
    ...(tsProgram.getResolvedProjectReferences() ?? []),
    {
      sourceFile: { fileName: standardizedTsConfigPath },
      commandLine: tsConfigContent,
    },
  ];

  const sourceFiles = new Set<SourceFile>();

  // TODO: we might want to do this recursively, so that we can support nested/complex projects
  for (const ref of projects) {
    if (!ref) continue;

    const tsConfigPath = ref.sourceFile.fileName;
    if (processedTsConfigs.has(tsConfigPath)) continue;
    processedTsConfigs.add(tsConfigPath);

    const dirName = path.dirname(tsConfigPath);

    console.log("loading project", path.relative(process.cwd(), tsConfigPath));

    for (const fileName of ref.commandLine.fileNames) {
      if (!fileName.startsWith(dirName)) {
        // only add files belonging to this project
        continue;
      }
      const sourceFile = globalProject.addSourceFileAtPath(fileName);
      sourceFiles.add(sourceFile);
    }

    // this also works, but is (possibly) slower:
    // const sourceFiles = globalProject.addSourceFilesFromTsConfig(tsConfigPath);

    tsConfigPathToRemappedProject.add({
      ...ref.commandLine.options,
      project: tsConfigPath,
    });
  }

  const changeSets = createChangeSets({
    emittedExtensionMapping,
    sourceFiles,
  });

  await Promise.all(
    Array.from(tsConfigPathToRemappedProject).flatMap((compilerOptions) => {
      const tsConfigPath = compilerOptions.project;
      const projectDir = path.dirname(tsConfigPath);
      const newFileSpecs = getNewSourcesWithinProject({
        changeSets,
        fsExtensionMapping,
        // TODO: consider using the original 'ref.commandLine.fileNames' instead of a projectDir jail
        projectDir,
      });

      // a temporary in-memory TS project that holds the sources with remapped extensions
      const remappedProject = new Project({
        // TODO: do we need to allow access to real `package.json`s and `tsconfig.json`s in MemFS?
        // we can do that by using our overlay fs, but maybe we'd need to limit it to only those files?
        fileSystem: virtualFs,
        compilerOptions,
        skipAddingFilesFromTsConfig: true,
        // skipFileDependencyResolution: true,
        // skipLoadingLibFiles: true,
      });

      const newFiles = newFileSpecs.map((fileSpec) => {
        const newSourceFile = remappedProject.createSourceFile(
          fileSpec.filePath,
          fileSpec.contents,
          { scriptKind: fileSpec.scriptKind },
        );
        newSourceFile.compilerNode.impliedNodeFormat =
          fileSpec.impliedNodeFormat;
        return newSourceFile;
      });

      // const preemitDiag = remappedProject.formatDiagnosticsWithColorAndContext(
      //   remappedProject.getPreEmitDiagnostics(),
      // );
      // console.log(preemitDiag);

      return newFiles.flatMap((file) => {
        const baseName = file.getBaseName();
        const emit = file.getEmitOutput();
        const sourceText = file.getFullText();
        let sourceTextEmitted = false;

        const outputFiles = emit.getOutputFiles();

        // console.log(
        //   "compiled",
        //   path.basename(projectDir),
        //   path.basename(file.getFilePath()),
        //   "=>",
        //   outputFiles.map((f) =>
        //     path.relative(
        //       path.dirname(standardizedTsConfigPath),
        //       f.getFilePath(),
        //     ),
        //   ),
        // );

        return outputFiles.map(async (emittedFile) => {
          const filePath = emittedFile.getFilePath();
          let contents = emittedFile.getText();
          const extension = path.extname(filePath);
          if (extension === ".map") {
            const map = changeSourceMapSourcesToBeRelativeToAdjacentFiles(
              JSON.parse(contents),
            );
            contents = JSON.stringify(map);
          }
          const fileDir = path.dirname(filePath);
          await fsHost.mkdir(fileDir);
          await Promise.all([
            fsHost.writeFile(filePath, contents),
            !sourceTextEmitted &&
              fsHost
                .writeFile(path.join(fileDir, baseName), sourceText)
                .then(() => {
                  sourceTextEmitted = true;
                }),
          ]);
        });
      });
    }),
  );
};

function createChangeSets({
  sourceFiles,
  emittedExtensionMapping,
}: {
  sourceFiles: Set<SourceFile>;
  /**
   * how to change import and export specifiers in the emitted files
   * the keys are the extension of files present in the filesystem,
   * the values are the extensions that should be present in the source code after mapping
   **/
  emittedExtensionMapping: TargetMapping;
}) {
  const changeSets = new Map<SourceFile, ChangeSet[]>();

  for (const sourceFile of sourceFiles) {
    const sourceExtension = sourceFile.getExtension();

    // ensure every file has a changeset (even if empty)
    const changeSet = changeSets.get(sourceFile) ?? [];
    changeSets.set(sourceFile, changeSet);

    if (!isMappableExtension(sourceExtension)) {
      continue;
    }
    // emit extension is different from real extension,
    // because typescript allows importing from '.js' even if the file is '.ts'
    const targetEmitExtension = emittedExtensionMapping[sourceExtension];
    if (!targetEmitExtension) {
      continue;
    }
    // it would be simplest to run: sourceFile.move(targetFilePath);
    // but that's extremely slow
    // so instead we rename everything manually by references and re-creating the project
    const referencingLiterals =
      sourceFile.getReferencingLiteralsInOtherSourceFiles();

    if (referencingLiterals.length === 0) {
      continue;
    }

    for (const literal of referencingLiterals) {
      const referencingSourceFile = literal.getSourceFile();
      const changeSet = changeSets.get(referencingSourceFile) ?? [];
      // omit the quotes (first and last character)
      const literalPath = literal.getText().slice(1, -1);
      const updatedPath = replaceExtensionInPathReference(
        literalPath,
        sourceFile.getBaseNameWithoutExtension(),
        targetEmitExtension,
      );
      changeSet.push({
        // omit the quotes (first and last character)
        start: literal.getStart() + 1,
        end: literal.getEnd() - 1,
        newText: updatedPath,
      });

      changeSets.set(referencingSourceFile, changeSet);

      // not running literal.setLiteralValue(...) on the original project,
      // because it is very slow
    }
  }

  return changeSets;
}

type NewSourceFileSpec = {
  filePath: string;
  contents: string;
  scriptKind: ts.ScriptKind;
  changed: boolean;
} & Pick<ts.SourceFile, "impliedNodeFormat">;

function getNewSourcesWithinProject({
  fsExtensionMapping,
  changeSets,
  projectDir,
}: {
  /** how to map extensions in the file system before building */
  fsExtensionMapping: TargetMapping;
  changeSets: Map<SourceFile, ChangeSet[]>;
  projectDir: string;
}): NewSourceFileSpec[] {
  const newSourceFiles: NewSourceFileSpec[] = [];

  for (const [sourceFile, changeSet] of changeSets) {
    const filePath = sourceFile.getFilePath();
    if (!filePath.startsWith(projectDir)) {
      // only add files belonging to this project
      continue;
    }
    const contents = sourceFile.getFullText();
    const sourceExtension = sourceFile.getExtension();

    if (
      !isMappableExtension(sourceExtension) ||
      !fsExtensionMapping[sourceExtension]
    ) {
      newSourceFiles.push({
        filePath,
        contents,
        scriptKind: sourceFile.getScriptKind(),
        changed: false,
        impliedNodeFormat:
          sourceFile.compilerNode.impliedNodeFormat ??
          (sourceExtension === ".mjs" || sourceExtension === ".mts"
            ? ts.ModuleKind.ESNext
            : undefined),
      });
      continue;
    }
    const targetExtension = fsExtensionMapping[sourceExtension]!;

    const newContents = changeSet
      // Sort changes from end of file to beginning, so that the indices don't change
      .sort((a, b) => b.start - a.start)
      .reduce((contents, change) => {
        // const previousContent = contents.slice(change.start, change.end);
        // console.log(previousContent, change.newText);
        return (
          contents.slice(0, change.start) +
          change.newText +
          contents.slice(change.end)
        );
      }, contents);

    const targetFilePath = `${sourceFile.getDirectoryPath()}/${sourceFile.getBaseNameWithoutExtension()}${targetExtension}`;

    newSourceFiles.push({
      filePath: targetFilePath,
      contents: newContents,
      scriptKind: sourceFile.getScriptKind(),
      changed: true,
      impliedNodeFormat:
        targetExtension === ".mjs" || targetExtension === ".mts"
          ? ts.ModuleKind.ESNext
          : undefined,
    });
  }

  return newSourceFiles;
}

function replaceExtensionInPathReference(
  pathRef: string,
  fileNameNoExtension: string,
  newExtension: string,
) {
  const lastOccurrenceIndex = pathRef.lastIndexOf(fileNameNoExtension);
  if (lastOccurrenceIndex === -1) {
    return `${pathRef}${newExtension}`;
  }
  const oldExtension = pathRef
    .slice(lastOccurrenceIndex + fileNameNoExtension.length)
    .match(extensionRegexp)?.[0];
  if (!oldExtension) {
    // TODO: what about the case of implicit extensions?
    // not recommended for now, but we might want to support it
    // then the caveats are that:
    // - the literal could be pointing at a directory (expecting /index)
    // - the literal could be pointing at a file without an extension
    return pathRef;
  }

  return (
    pathRef.slice(0, lastOccurrenceIndex) +
    fileNameNoExtension +
    newExtension +
    pathRef.slice(
      lastOccurrenceIndex + fileNameNoExtension.length + oldExtension.length,
    )
  );
}

const presets = {
  "ts-to-cts": {
    fsExtensionMapping: { ".ts": ".cts", ".js": ".cjs" },
    emittedExtensionMapping: { ".ts": ".cjs", ".js": ".cjs" },
  },
  "ts-to-mts": {
    fsExtensionMapping: { ".ts": ".mts", ".js": ".mjs" },
    emittedExtensionMapping: { ".ts": ".mjs", ".js": ".mjs" },
  },
} as const;

export type TypeScriptPipelinePreset = keyof typeof presets;

export const buildRemappedProject = async ({
  tsConfigFilePath,
  mappingPreset,
}: {
  tsConfigFilePath: string;
  mappingPreset: TypeScriptPipelinePreset;
}) =>
  buildTsWithRenamedSpecifiers({
    tsConfigFilePath,
    ...presets[mappingPreset],
  });
