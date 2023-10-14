import {
  Project,
  type SourceFile,
  getCompilerOptionsFromTsConfig,
  ts,
  createWrappedNode,
} from "ts-morph";
import {
  TransactionalFileSystem,
  RealFileSystemHost,
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

// tsConfigContent.options.allowImportingTsExtensions

const renameSpecifiers = async ({
  tsConfigFilePath,
  fsExtensionMapping,
  emittedExtensionMapping,
}: {
  tsConfigFilePath: string;
  fsExtensionMapping: TargetMapping;
  emittedExtensionMapping: TargetMapping;
}) => {
  // const { options: compilerOptions } =
  //   getCompilerOptionsFromTsConfig(tsConfigFilePath);

  const fsHost = new RealFileSystemHost();
  const tfsHost = new TransactionalFileSystem({
    fileSystem: fsHost,
    skipLoadingLibFiles: true,
    libFolderPath: undefined,
  });

  const standardizedTsConfigPath =
    tfsHost.getStandardizedAbsolutePath(tsConfigFilePath);

  const tsConfigResolver = new TsConfigResolver(
    tfsHost,
    standardizedTsConfigPath,
    "utf-8",
  ) as unknown as Omit<TsConfigResolver, "parseJsonConfigFileContent"> & {
    // this is private, but we need it
    parseJsonConfigFileContent: () => ts.ParsedCommandLine;
  };
  const tsConfigContent = tsConfigResolver.parseJsonConfigFileContent();

  // ts.getParsedCommandLineOfConfigFile(tsConfigFilePath, compilerOptions, tfsHost)
  // const builderProgram = ts.createIncrementalProgram({
  //   options: tsConfigContent.options,
  //   projectReferences: tsConfigContent.projectReferences,
  //   rootNames: [],
  //   // rootNames: configContent.,
  // });

  // const builderProgram = ts.createEmitAndSemanticDiagnosticsBuilderProgram(
  //   configContent.fileNames,
  //   configContent.options,
  //   undefined,
  //   undefined,
  //   undefined,
  //   configContent.projectReferences,
  // );
  // const tsProgram = builderProgram.getProgram();
  const tsProgram = ts.createProgram({
    options: tsConfigContent.options,
    configFileParsingDiagnostics: tsConfigContent.errors,
    projectReferences: tsConfigContent.projectReferences,
    rootNames: [],
  });

  const processedTsConfigs = new Set<string>();
  processedTsConfigs.add(standardizedTsConfigPath);
  const tsConfigPathToRemappedProjectAndFiles = new Map<
    string,
    [Project, SourceFile[]]
  >();

  const globalProject = new Project({ tsConfigFilePath });
  const resolvedReferences = tsProgram.getResolvedProjectReferences();

  // TODO: support non-composite projects
  if (!resolvedReferences) return;

  const fileNamesToAdd: string[] = [];
  let sourceFiles: SourceFile[] = [];
  for (const ref of resolvedReferences) {
    if (!ref) continue;
    const tsConfigPath = ref.sourceFile.fileName;
    if (processedTsConfigs.has(tsConfigPath)) continue;
    processedTsConfigs.add(tsConfigPath);

    console.log("ref", tsConfigPath);
    fileNamesToAdd.push(...ref.commandLine.fileNames);

    ref.commandLine.fileNames.forEach((fileName) => {
      sourceFiles.push(globalProject.addSourceFileAtPath(fileName));
    });

    // const sourceFiles = globalProject.addSourceFilesFromTsConfig(tsConfigPath);

    // const remappedProject = new Project({
    //   // useInMemoryFileSystem: true,
    //   tsConfigFilePath: tsConfigPath,
    //   skipAddingFilesFromTsConfig: true,
    // });

    // tsConfigPathToRemappedProjectAndFiles.set(tsConfigPath, [
    //   remappedProject,
    //   sourceFiles,
    // ]);
    // console.log(
    //   tsConfigPath,
    //   srcFiles.map((f) => f.getFilePath()),
    // );
    // ref?.commandLine.projectReferences[0].
  }

  // const sourceFiles = globalProject.addSourceFilesAtPaths(fileNamesToAdd);

  // console.log({ sourceFiles: sourceFiles.map((f) => f.getFilePath()) });

  const globalRemappedProject = new Project({
    useInMemoryFileSystem: true,
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      ...tsConfigContent.options,
      sourceRoot: undefined,
      mapRoot: "./",
    },
  });

  // for (const [
  //   tsConfigPath,
  //   [remappedProject, sourceFiles],
  // ] of tsConfigPathToRemappedProjectAndFiles) {
  //   console.log("processing", tsConfigPath);
  //   await processProject({
  //     sourceFiles,
  //     fsExtensionMapping,
  //     emittedExtensionMapping,
  //     remappedProject,
  //   });
  //   // await globalRemappedProject.emit();
  //   const result = remappedProject.emitToMemory();
  //   result.getFiles().forEach((file) => {
  //     console.log("wrote", file.filePath);
  //   });
  // }

  // const sourceFiles = globalProject.getSourceFiles();

  processProject({
    sourceFiles,
    fsExtensionMapping,
    emittedExtensionMapping,
    remappedProject: globalRemappedProject,
  });

  // const opts = globalRemappedProject
  //   .getProgram()
  //   .compilerObject.getCompilerOptions();
  // opts.mapRoot = "packages/features/auto";

  await Promise.all(
    globalRemappedProject.getSourceFiles().flatMap((file) => {
      const baseName = file.getBaseName();
      const emit = file.getEmitOutput();
      const sourceText = file.getFullText();
      let sourceTextEmitted = false;
      return emit.getOutputFiles().map(async (emittedFile) => {
        const filePath = emittedFile.getFilePath();
        const fileDir = path.dirname(filePath);
        await fsHost.mkdir(fileDir);
        await fsHost.writeFile(filePath, emittedFile.getText());
        if (!sourceTextEmitted) {
          await fsHost.writeFile(path.join(fileDir, baseName), sourceText);
          sourceTextEmitted = true;
        }
        console.log("wrote", filePath);
      });
    }),
  );

  // const res = globalRemappedProject.emitToMemory({
  //   // targetSourceFile: globalRemappedProject.getSourceFile(() => true),
  // });

  // await Promise.all(
  //   res.getFiles().map(async (file) => {
  //     await fsHost.mkdir(path.dirname(file.filePath));
  //     await fsHost.writeFile(file.filePath, file.text);
  //     console.log("wrote", file.filePath);
  //   }),
  // );
  // await globalRemappedProject.emit();

  // const tsProgram = project.getProgram().compilerObject;
  // // ts.createProgram({projectReferences: [{}]})
  // const builderProgram = ts.createEmitAndSemanticDiagnosticsBuilderProgram(
  //   project.getProgram().compilerObject,
  //   fsHost,
  // );

  // project: globalProject,
};

// renameSpecifiers("./packages/features/moon/tsconfig.json", {
renameSpecifiers({
  tsConfigFilePath: "./tsconfig.json",
  fsExtensionMapping: { ".ts": ".mts" },
  emittedExtensionMapping: { ".ts": ".mjs" },
});

function processProject({
  sourceFiles,
  fsExtensionMapping,
  emittedExtensionMapping,
  remappedProject,
}: {
  sourceFiles: SourceFile[];
  /** how to map extensions in the file system before building */
  fsExtensionMapping: TargetMapping;
  /** how to map the import and export specifiers in the emitted files */
  emittedExtensionMapping: TargetMapping;
  remappedProject: Project;
}) {
  const changeSets = new Map<
    SourceFile,
    { start: number; end: number; newText: string }[]
  >();
  for (const sourceFile of sourceFiles) {
    const sourceExtension = sourceFile.getExtension();

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

  for (const [sourceFile, changeSet] of changeSets) {
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
          overwrite: true,
          scriptKind: sourceFile.getScriptKind(),
        },
      );
      if (sourceExtension === ".mjs" || sourceExtension === ".mts") {
        // TODO: what about package.json "type"?
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

    if (targetExtension === ".mjs" || targetExtension === ".mts") {
      newSourceFile.compilerNode.impliedNodeFormat = ts.ModuleKind.ESNext;
    }

    // console.log("filename", newSourceFile.compilerNode.fileName);
    // const s = newSourceFile.getEmitOutput();
    // s.getOutputFiles().forEach((file) => {
    //   // console.log(file.getFilePath(), file.getText());
    // });

    // console.log(`Renamed ${filePath} to ${targetFilePath}`);
  }

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
