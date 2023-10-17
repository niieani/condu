import {
  Project,
  type SourceFile,
  getCompilerOptionsFromTsConfig,
  ts,
} from "ts-morph";
import {
  TransactionalFileSystem,
  RealFileSystemHost,
  InMemoryFileSystemHost,
  TsConfigResolver,
} from "@ts-morph/common";
import path from "node:path";

const extensionRegexp = /^\.[cm]?[tj]sx?/i;

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
  "parseJsonConfigFileContent"
> & {
  // this is private, but we need it
  parseJsonConfigFileContent: () => ts.ParsedCommandLine;
};

const renameSpecifiers = async ({
  tsConfigFilePath,
  fsExtensionMapping,
  emittedExtensionMapping,
}: {
  tsConfigFilePath: string;
  fsExtensionMapping: TargetMapping;
  emittedExtensionMapping: TargetMapping;
}) => {
  const fsHost = new RealFileSystemHost();
  const tfsHost = new TransactionalFileSystem({
    fileSystem: fsHost,
    skipLoadingLibFiles: true,
    libFolderPath: undefined,
  });
  const memoryFs = new InMemoryFileSystemHost();

  const standardizedTsConfigPath =
    tfsHost.getStandardizedAbsolutePath(tsConfigFilePath);

  const tsConfigResolver = new TsConfigResolver(
    tfsHost,
    standardizedTsConfigPath,
    "utf-8",
  ) as unknown as PrivateTsConfigResolver;

  const tsConfigContent = tsConfigResolver.parseJsonConfigFileContent();

  const tsProgram = ts.createProgram({
    options: tsConfigContent.options,
    configFileParsingDiagnostics: tsConfigContent.errors,
    projectReferences: tsConfigContent.projectReferences,
    rootNames: [],
  });

  const processedTsConfigs = new Set<string>();
  processedTsConfigs.add(standardizedTsConfigPath);

  const tsConfigPathToRemappedProject = new Map<string, Project>();

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

  const sourceFiles: SourceFile[] = [];

  // TODO: we might want to do this recursively, so that we can support nested/complex projects
  for (const ref of projects) {
    if (!ref) continue;

    const tsConfigPath = ref.sourceFile.fileName;
    if (processedTsConfigs.has(tsConfigPath)) continue;
    processedTsConfigs.add(tsConfigPath);

    const dirName = path.dirname(tsConfigPath);

    console.log("ref", tsConfigPath);
    // console.log("ref", tsConfigPath, ref.commandLine.fileNames);

    ref.commandLine.fileNames.forEach((fileName) => {
      if (!fileName.startsWith(dirName)) {
        // only add files belonging to this project
        return;
      }
      const sourceFile = globalProject.addSourceFileAtPath(fileName);
      sourceFiles.push(sourceFile);
    });

    // const sourceFiles = globalProject.addSourceFilesFromTsConfig(tsConfigPath);

    // a temporary project that holds the sources with remapped extensions
    const remappedProject = new Project({
      // TODO: do we need to allow access to real `package.json`s and `tsconfig.json`s in MemFS?
      fileSystem: memoryFs,
      compilerOptions: {
        ...ref.commandLine.options,
        project: tsConfigPath,
      },
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
      skipLoadingLibFiles: true,
    });

    tsConfigPathToRemappedProject.set(tsConfigPath, remappedProject);
  }

  const changeSets = new Map<SourceFile, ChangeSet[]>();

  updateChangeSets({
    emittedExtensionMapping,
    sourceFiles,
    changeSets,
  });

  // const globalRemappedProject = new Project({
  //   fileSystem: memoryFs,
  //   // useInMemoryFileSystem: true,
  //   skipAddingFilesFromTsConfig: true,
  //   compilerOptions: {
  //     ...tsConfigContent.options,
  //     sourceRoot: undefined,
  //     mapRoot: "./",
  //   },
  // });

  await Promise.all(
    Array.from(tsConfigPathToRemappedProject).flatMap(
      ([tsConfigPath, remappedProject]) => {
        const projectDir = path.dirname(tsConfigPath);
        const newFiles = processProject({
          changeSets,
          projectDir,
          fsExtensionMapping,
          remappedProject,
        });

        const emit = remappedProject.emitToMemory();
        return emit.getFiles().flatMap(async (file) => {
          console.log(
            "compiled",
            path.basename(projectDir),
            path.relative(
              path.dirname(standardizedTsConfigPath),
              file.filePath,
            ),
          );
          const fileDir = path.dirname(file.filePath);
          await fsHost.mkdir(fileDir);
          await Promise.all([fsHost.writeFile(file.filePath, file.text)]);
        });

        return newFiles.flatMap((file) => {
          const baseName = file.getBaseName();
          const emit = file.getEmitOutput();
          const sourceText = file.getFullText();
          let sourceTextEmitted = false;

          const outputFiles = emit.getOutputFiles();

          console.log(
            "compiled",
            path.basename(projectDir),
            path.basename(file.getFilePath()),
            "=>",
            outputFiles.map((f) =>
              path.relative(
                path.dirname(standardizedTsConfigPath),
                f.getFilePath(),
              ),
            ),
          );

          // return outputFiles.map(async (emittedFile) => {
          //   const filePath = emittedFile.getFilePath();
          //   const fileDir = path.dirname(filePath);
          //   await fsHost.mkdir(fileDir);
          //   await Promise.all([
          //     fsHost.writeFile(filePath, emittedFile.getText()),
          //     !sourceTextEmitted &&
          //       fsHost
          //         .writeFile(path.join(fileDir, baseName), sourceText)
          //         .then(() => {
          //           sourceTextEmitted = true;
          //         }),
          //   ]);
          // });
        });
      },
    ),
  );
};

renameSpecifiers({
  tsConfigFilePath: "./tsconfig.json",
  fsExtensionMapping: { ".ts": ".mts" },
  emittedExtensionMapping: { ".ts": ".mjs" },
});

function updateChangeSets({
  sourceFiles,
  emittedExtensionMapping,
  changeSets,
}: {
  sourceFiles: SourceFile[];
  /** how to map the import and export specifiers in the emitted files */
  emittedExtensionMapping: TargetMapping;
  changeSets: Map<SourceFile, ChangeSet[]>;
}) {
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
      const newText = replaceExtensionInLiteral(
        literal.getText(),
        sourceFile.getBaseNameWithoutExtension(),
        targetEmitExtension,
      );
      changeSet.push({
        start: literal.getStart(),
        end: literal.getEnd(),
        newText,
      });

      changeSets.set(referencingSourceFile, changeSet);

      // not running literal.setLiteralValue(...) on the original project,
      // because it is very slow
    }
  }
}

function processProject({
  fsExtensionMapping,
  remappedProject,
  projectDir,
  changeSets,
}: {
  /** how to map extensions in the file system before building */
  fsExtensionMapping: TargetMapping;
  changeSets: Map<SourceFile, ChangeSet[]>;
  remappedProject: Project;
  projectDir: string;
}) {
  const newSourceFiles: SourceFile[] = [];

  for (const [sourceFile, changeSet] of changeSets) {
    if (!sourceFile.getFilePath().startsWith(projectDir)) {
      // only add files belonging to this project
      continue;
    }
    // if (sourceFile.getBaseName() !== "loadProject.ts") {
    //   continue;
    // }
    const contents = sourceFile.getFullText();
    const sourceExtension = sourceFile.getExtension();

    if (
      !isMappableExtension(sourceExtension) ||
      !fsExtensionMapping[sourceExtension]
    ) {
      const newFile = remappedProject.createSourceFile(
        sourceFile.getFilePath(),
        contents,
        {
          // overwrite: true,
          scriptKind: sourceFile.getScriptKind(),
        },
      );
      newSourceFiles.push(newFile);
      if (sourceExtension === ".mjs" || sourceExtension === ".mts") {
        // TODO: what about package.json "type"?
        // TODO: should we change logic when allowImportingTsExtensions is true?
        newFile.compilerNode.impliedNodeFormat = ts.ModuleKind.ESNext;
      }
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

    const newSourceFile = remappedProject.createSourceFile(
      targetFilePath,
      newContents,
      { scriptKind: sourceFile.getScriptKind() },
    );
    newSourceFiles.push(newSourceFile);

    if (targetExtension === ".mjs" || targetExtension === ".mts") {
      newSourceFile.compilerNode.impliedNodeFormat = ts.ModuleKind.ESNext;
    }
  }

  return newSourceFiles;

  // this fails now, because files is [] for the composite project
  // after this sourcemaps are broken, because they refer to the non-existing .mts files
  // maybe we iterate over each referenced project and emit files for each project?
  // downsides: performance might be bad? projects might also have same files referenced
  // although currently it looks like references aren't loaded at all, so might be ok?
  // not sure how it compiles though without resolving the references?
  // const result = await remappedProject.emit();
  // result.getDiagnostics().forEach((diagnostic) => {
  //   console.log(
  //     diagnostic.getCode(),
  //     diagnostic.getSourceFile()?.getBaseName(),
  //     diagnostic.getLineNumber(),
  //     diagnostic.getMessageText(),
  //   );
  // });
}

function replaceExtensionInLiteral(
  literal: string,
  fileNameNoExtension: string,
  newExtension: string,
) {
  const lastOccurrenceIndex = literal.lastIndexOf(fileNameNoExtension);
  if (lastOccurrenceIndex === -1) {
    return literal;
  }
  const oldExtension = literal
    .slice(lastOccurrenceIndex + fileNameNoExtension.length)
    .match(extensionRegexp)?.[0];
  if (!oldExtension) {
    return literal;
  }

  return (
    literal.slice(0, lastOccurrenceIndex) +
    fileNameNoExtension +
    newExtension +
    literal.slice(
      lastOccurrenceIndex + fileNameNoExtension.length + oldExtension.length,
    )
  );
}
