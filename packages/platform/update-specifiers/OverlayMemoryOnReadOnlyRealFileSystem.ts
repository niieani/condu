import type { FileSystemHost } from "ts-morph";
import { InMemoryFileSystemHost, type RuntimeDirEntry } from "@ts-morph/common";

export class OverlayMemoryOnReadOnlyRealFileSystem
  extends InMemoryFileSystemHost
  implements FileSystemHost
{
  constructor(private readonly realFs: FileSystemHost) {
    super();
  }

  override async directoryExists(dirPath: string): Promise<boolean> {
    const memResult = await super.directoryExists(dirPath);
    if (memResult) return true;
    return this.realFs.directoryExists(dirPath);
  }

  override directoryExistsSync(dirPath: string): boolean {
    const memResult = super.directoryExistsSync(dirPath);
    if (memResult) return true;
    return this.realFs.directoryExistsSync(dirPath);
  }

  override async fileExists(filePath: string): Promise<boolean> {
    const memResult = await super.fileExists(filePath);
    if (memResult) return true;
    return this.realFs.fileExists(filePath);
  }

  override fileExistsSync(filePath: string): boolean {
    const memResult = super.fileExistsSync(filePath);
    if (memResult) return true;
    return this.realFs.fileExistsSync(filePath);
  }

  override getCurrentDirectory(): string {
    return this.realFs.getCurrentDirectory();
  }

  override async readFile(
    filePath: string,
    encoding?: string,
  ): Promise<string> {
    const memResult = await super
      .readFile(filePath, encoding)
      .catch(() => undefined);
    if (memResult !== undefined) return memResult;
    return this.realFs.readFile(filePath, encoding);
  }

  override readFileSync(
    filePath: string,
    encoding?: string | undefined,
  ): string {
    try {
      const memResult = super.readFileSync(filePath, encoding);
      if (memResult) return memResult;
    } catch {
      // ignore
    }
    return this.realFs.readFileSync(filePath, encoding);
  }

  override realpathSync(path: string): string {
    try {
      const memResult = super.realpathSync(path);
      if (memResult) return memResult;
    } catch {
      // ignore
    }
    return this.realFs.realpathSync(path);
  }

  override readDirSync(dirPath: string): RuntimeDirEntry[] {
    try {
      const memResult = super.readDirSync(dirPath);
      if (memResult.length) return memResult;
    } catch {
      // ignore
    }
    return this.realFs.readDirSync(dirPath);
  }

  override async glob(patterns: readonly string[]): Promise<string[]> {
    const memResult = await super.glob(patterns);
    if (memResult.length) return memResult;
    return this.realFs.glob(patterns);
  }
}
