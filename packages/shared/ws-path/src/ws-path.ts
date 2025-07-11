import { throwAppError } from '@bangle.io/base-utils';
import {
  DEFAULT_NOTE_EXTENSION,
  PATH_SEPARATOR,
  VALID_MARKDOWN_EXTENSIONS_SET,
  VALID_NOTE_EXTENSIONS_SET,
} from './constants';
import { pathJoin } from './helpers';
import * as validation from './validation';
import {
  type ValidationError,
  type ValidationResult,
  validatePath,
  validateWsName,
  validateWsPath,
} from './validation';

/** Internal shape for parsed data. */
interface WsPathData {
  wsName: string;
  path: string;
  extension?: string;
  isFile: boolean;
  isDir: boolean;
}

// Constants for file types are re-exported from './constants'

type SafeParseResult<T extends WsPath = WsPath> = {
  ok: boolean;
  data?: T;
  validationError?: ValidationError;
};

type ParseResult = ValidationResult<WsPathData>;

/**
 * Represents an immutable workspace path (wsPath) in the form "wsName:path/to/file".
 *
 * Key behaviors:
 * - Directory paths are normalized to always end with a trailing slash
 * - Paths with trailing slashes are always treated as directories
 *
 * Usage:
 *   // Files
 *   const w = WsPath.fromString('myWorkspace:dir/sub/file.md');
 *   w.wsName;        // "myWorkspace"
 *   w.path;          // "dir/sub/file.md"
 *   w.extension;     // ".md"
 *   w.isFile;        // true
 *   w.isDir;         // false
 *
 *   // Directories
 *   const d = WsPath.fromString('myWorkspace:dir/sub');
 *   d.path;          // "dir/sub/"  (note trailing slash)
 *   d.isFile;        // false
 *   d.isDir;         // true
 *
 *   // Root directory
 *   const r = WsPath.fromString('myWorkspace:');
 *   r.path;          // ""
 *   r.isDir;         // true
 *
 *   // weird files
 *   const h = WsPath.fromString('myWorkspace:.config');
 *   h.isFile;        // true (hidden files are treated as files,
 *   h.extension;     // ".config"
 *
 *   const h = WsPath.fromString('myWorkspace:.config/'); // append `/` to force it to be a dir
 *   h.isFile;        // false
 *   h.isDir;         // true
 *   h.path;          // ".config/"
 *
 *   // Creating new paths immutably
 *   const changed = w.withWsName('otherWorkspace');
 *   console.log(changed.toString()); // "otherWorkspace:dir/sub/file.md"
 *
 *   // Check validity without throwing
 *   const result = WsPath.safeParse('badpath');
 *   if ('validationError' in result) {
 *     console.log(result.validationError.reason);
 *   }
 *
 *   // Check if path points to a file
 *   const isFile = WsPath.isFileWsPath('myWorkspace:file.md'); // true
 *   const isFile2 = WsPath.isFileWsPath('myWorkspace:dir/'); // false
 */
export class WsPath {
  public static readonly pathJoin = pathJoin;
  public static readonly DEFAULT_NOTE_EXTENSION = DEFAULT_NOTE_EXTENSION;
  public static readonly VALID_NOTE_EXTENSIONS_SET = VALID_NOTE_EXTENSIONS_SET;
  public static readonly PATH_SEPARATOR = PATH_SEPARATOR;
  public static readonly validation = validation;

  public readonly wsPath: string;
  private readonly _rawWsPath: string;
  protected _memo: WsPathData | null = null;

  protected constructor(wsPath: string, data?: WsPathData) {
    this.wsPath = wsPath.trim();
    this._rawWsPath = wsPath;
    this._memo = data || null;
  }

  protected static _toRawString(raw: string | WsPath): string {
    return raw instanceof WsPath ? raw.toString() : raw;
  }

  public static fromString(raw: string | WsPath): WsPath {
    if (raw instanceof WsPath) {
      return raw;
    }

    return new WsPath(raw);
  }

  /**
   * Safely creates a WsPath by combining wsName + ':' + path.
   * Returns either a WsPath instance or validation error.
   */
  public static safeFromParts(wsName: string, _path: string): SafeParseResult {
    const path = removeStartsWith(_path, WsPath.PATH_SEPARATOR);

    const wsNameResult = validateWsName(wsName);
    if (!wsNameResult.ok) {
      return { ok: false, validationError: wsNameResult.validationError };
    }

    const pathResult = validatePath(path);
    if (!pathResult.ok) {
      return { ok: false, validationError: pathResult.validationError };
    }

    const raw = `${wsName}:${path}`;
    const result = WsPath._parseCore(raw);
    if (!result.ok) {
      return { ok: false, validationError: result.validationError };
    }

    return { ok: true, data: new WsPath(raw, result.data) };
  }

  /**
   * Creates a WsPath by combining wsName + ':' + path.
   * @throws Error if either wsName or path is invalid
   */
  public static fromParts(wsName: string, path: string): WsPath {
    const result = WsPath.safeFromParts(wsName, path);
    if (result.validationError) {
      throw new Error(result.validationError.reason);
    }
    if (!result.data) {
      throw new Error('Failed to create WsPath');
    }
    return result.data;
  }

  public static safeParse(raw: string | WsPath): SafeParseResult {
    if (raw instanceof WsPath) {
      return { ok: true, data: raw };
    }
    const result = WsPath._parseCore(raw);
    if (!result.ok) {
      return { ok: false, validationError: result.validationError };
    }
    return { ok: true, data: new WsPath(raw, result.data) };
  }

  public static assert(raw: string | WsPath): WsPath {
    const parsed = WsPath.safeParse(raw);
    if (parsed.validationError) {
      throwAppError(
        'error::ws-path:invalid-ws-path',
        parsed.validationError.reason,
        {
          invalidPath: raw.toString(),
        },
      );
    }
    if (!parsed.data) {
      throwAppError(
        'error::ws-path:invalid-ws-path',
        'Failed to parse WsPath',
        {
          invalidPath: raw.toString(),
        },
      );
    }
    return parsed.data;
  }

  public get wsName(): string {
    return this._parse().wsName;
  }

  public get path(): string {
    return this._parse().path;
  }

  public get extension(): string | undefined {
    return this._parse().extension;
  }

  public get isFile(): boolean {
    return this._parse().isFile;
  }

  public get isDir(): boolean {
    return this._parse().isDir;
  }

  public toString(): string {
    return this.wsPath;
  }

  public withWsName(newWsName: string): WsPath {
    return WsPath.fromParts(newWsName, this.path);
  }

  public asFile(): WsFilePath | undefined {
    if (!this.isFile) {
      return undefined;
    }
    return WsFilePath.fromString(this.wsPath);
  }

  public asDir(): WsDirPath | undefined {
    if (!this.isDir) {
      return undefined;
    }
    return WsDirPath.fromString(this.wsPath);
  }

  public isMarkdown(): boolean {
    const ext = this.extension;
    return (
      this.isFile && ext !== undefined && VALID_MARKDOWN_EXTENSIONS_SET.has(ext)
    );
  }

  public isNote(): boolean {
    const ext = this.extension;
    return (
      this.isFile && ext !== undefined && VALID_NOTE_EXTENSIONS_SET.has(ext)
    );
  }

  public static isMarkdownWsPath(wsPath: string | WsPath): boolean {
    try {
      const path =
        wsPath instanceof WsPath ? wsPath : WsPath.fromString(wsPath);
      return path.isMarkdown();
    } catch {
      return false;
    }
  }

  public static isNoteWsPath(wsPath: string | WsPath): boolean {
    try {
      const path =
        wsPath instanceof WsPath ? wsPath : WsPath.fromString(wsPath);
      return path.isNote();
    } catch {
      return false;
    }
  }

  public assertMarkdown(): this {
    if (!this.isMarkdown()) {
      throwAppError(
        'error::ws-path:invalid-markdown-path',
        'Expected markdown file that ends with .md or .markdown',
        {
          invalidWsPath: this.wsPath,
        },
      );
    }
    return this;
  }

  public assertNote(): this {
    if (!this.isNote()) {
      throwAppError(
        'error::ws-path:invalid-note-path',
        'Invalid note file path',
        {
          invalidWsPath: this.wsPath,
        },
      );
    }
    return this;
  }

  protected _parse(): WsPathData {
    if (this._memo) {
      return this._memo;
    }
    const result = WsPath._parseCore(this.wsPath);
    if (!result.ok) {
      throwAppError(
        'error::ws-path:invalid-ws-path',
        result.validationError.reason,
        {
          invalidPath: this.wsPath,
        },
      );
    }
    this._memo = result.data;
    return this._memo;
  }

  /**
   * Core logic for validating & extracting wsPath components
   */
  protected static _parseCore(raw: string): ParseResult {
    const validationResult = validateWsPath(raw);
    if (!validationResult.ok) {
      return validationResult;
    }

    const { wsName, filePath } = validationResult.data;
    const hasTrailingSlash = filePath.endsWith(WsPath.PATH_SEPARATOR);

    let extension: string | undefined;
    const segments = filePath.split(WsPath.PATH_SEPARATOR);

    const lastSegment = segments[segments.length - 1];

    // // only search for dot in last segment, so we can allow dotted dirs
    if (lastSegment?.includes('.') && !hasTrailingSlash) {
      const lastDot = filePath.lastIndexOf('.');
      if (lastDot > -1 && lastDot < filePath.length - 1) {
        extension = filePath.substring(lastDot);
      }
    }

    const isFile = !!extension && !hasTrailingSlash;
    const isDir = !isFile;

    // If it's a directory but doesn't end with a slash, add it
    const normalizedPath =
      isDir && filePath !== '' ? ensureEndsWith(filePath, '/') : filePath;

    return {
      ok: true,
      data: {
        wsName,
        path: normalizedPath,
        extension: isFile ? extension : undefined,
        isFile,
        isDir,
      },
    };
  }

  public static isFileWsPath(wsPath: string | WsPath): boolean {
    const parsed = WsPath.safeParseFile(wsPath);
    return !('validationError' in parsed);
  }

  public static isDirWsPath(wsPath: string | WsPath): boolean {
    const parsed = WsPath.safeParse(wsPath);
    return parsed.ok && parsed.data?.isDir === true;
  }

  public static safeParseFile(
    raw: string | WsPath,
  ): SafeParseResult<WsFilePath> {
    const normalizedRaw = typeof raw === 'string' ? raw : raw.wsPath;
    const result = WsPath._parseCore(normalizedRaw);

    if (!result.ok) {
      return { ok: false, validationError: result.validationError };
    }

    if (!result.data.isFile) {
      return {
        ok: false,
        validationError: {
          reason: 'Invalid wsPath: Expected a file path with extension',
          invalidPath: normalizedRaw,
        },
      };
    }
    return { ok: true, data: new WsFilePath(normalizedRaw, result.data) };
  }

  public static assertFile(raw: string | WsPath): WsFilePath {
    const result = WsPath.safeParseFile(raw);
    if (result.validationError) {
      throw new Error(`Invalid wsPath: ${result.validationError.reason}`);
    }
    if (!result.data) {
      throw new Error('Failed to parse WsFilePath');
    }
    return result.data;
  }

  /**
   * Converts a filesystem path to a wsPath by splitting on first '/' and joining with ':'.
   * Returns undefined if the path is invalid or doesn't contain a workspace name.
   */
  public static fromFSPath(fsPath: string): WsPath | undefined {
    const [wsName, ...rest] = fsPath.split(WsPath.PATH_SEPARATOR);
    const wsNameResult = validateWsName(wsName || '');
    if (!wsNameResult.ok || !wsName) {
      return undefined;
    }
    const result = WsPath.safeFromParts(wsName, pathJoin(...rest));
    if (!result.ok) {
      return undefined;
    }
    return result.data;
  }

  public toFSPath(): string {
    if (this.isDir) {
      return ensureEndsWith(
        pathJoin(this.wsName, this.path),
        WsPath.PATH_SEPARATOR,
      );
    }
    return pathJoin(this.wsName, this.path);
  }

  /**
   * Returns the parent directory path or undefined if this is already at the root.
   */
  public getParent(): WsDirPath | undefined {
    if (this.isRoot) {
      return undefined;
    }

    const dirPath = this._getDirPath();

    // If we're at root level, return empty dir
    if (dirPath === '' || dirPath === '/') {
      return WsDirPath.fromString(`${this.wsName}:`);
    }

    return WsDirPath.fromString(`${this.wsName}:${dirPath}`);
  }

  /**
   * Returns true if this path represents the root of a workspace.
   */
  public get isRoot(): boolean {
    return this.path === '' || this.path === '.' || this.path === '..';
  }

  /**
   * Returns the name of the path - fileName for files and dirName for directories.
   * For root paths, returns an empty string.
   */
  public get name(): string {
    if (this.isRoot) {
      return '';
    }

    if (this.isDir) {
      const normalizedPath = this.path.replace(/\/+$/, '');
      const parts = normalizedPath.split(WsPath.PATH_SEPARATOR);
      const lastPart = parts[parts.length - 1] || '';
      return lastPart.replace(/\/$/, '');
    }

    const parts = this.path.split(WsPath.PATH_SEPARATOR);
    const name = parts[parts.length - 1];
    if (!name) {
      throwAppError(
        'error::ws-path:invalid-ws-path',
        'WsFilePath must have a file name',
        {
          invalidPath: this.wsPath,
        },
      );
    }
    return name;
  }

  /**
   * Returns the directory path string for this path.
   * For files, returns the parent directory path.
   * For directories, returns the directory path itself.
   * For root paths, returns empty string.
   */
  protected _getDirPath(): string {
    // Handle root cases
    if (this.isRoot) {
      return '';
    }

    // Remove trailing slashes
    const normalizedPath = this.path.replace(/\/+$/, '');

    let result = '';

    if (this.isFile) {
      const lastSlash = normalizedPath.lastIndexOf(WsPath.PATH_SEPARATOR);
      result = lastSlash === -1 ? '' : normalizedPath.substring(0, lastSlash);
    } else if (this.isDir) {
      // For directories, get the parent directory path
      const lastSlash = normalizedPath.lastIndexOf(WsPath.PATH_SEPARATOR);
      result = lastSlash === -1 ? '' : normalizedPath.substring(0, lastSlash);
    }

    if (result === '') {
      return '';
    }

    return ensureEndsWith(result, WsPath.PATH_SEPARATOR);
  }
}

/**
 * A specialized WsPath that is guaranteed to point to a file.
 */
export class WsFilePath extends WsPath {
  public static fromString(raw: string | WsPath): WsFilePath {
    const isDir = raw instanceof WsPath ? raw.isDir : raw.endsWith('/');

    if (isDir) {
      throwAppError(
        'error::ws-path:invalid-ws-path',
        'Expected a file path but got a directory path',
        {
          invalidPath: raw.toString(),
        },
      );
    }

    const result = WsPath.safeParseFile(raw);
    if (result.validationError) {
      throwAppError(
        'error::ws-path:invalid-ws-path',
        result.validationError.reason,
        {
          invalidPath: raw.toString(),
        },
      );
    }
    if (!result.data) {
      throwAppError(
        'error::ws-path:invalid-ws-path',
        'Failed to parse WsFilePath',
        {
          invalidPath: raw.toString(),
        },
      );
    }
    return result.data;
  }

  public get filePath(): string {
    return this.path;
  }

  public get fileName(): string {
    const parts = this.path.split(WsPath.PATH_SEPARATOR);
    const name = parts[parts.length - 1];
    if (!name) {
      throwAppError(
        'error::ws-path:invalid-ws-path',
        'WsFilePath must have a file name',
        {
          invalidPath: this.wsPath,
        },
      );
    }
    return name;
  }

  public get fileNameWithoutExtension(): string {
    const fileName = this.fileName;
    const extension = this.extension;
    return fileName.slice(0, -extension.length);
  }

  public get extension(): string {
    const ext = super.extension;
    if (!ext) {
      throwAppError(
        'error::ws-path:invalid-ws-path',
        'WsFilePath must have an extension',
        {
          invalidPath: this.wsPath,
        },
      );
    }
    return ext;
  }

  public get isFile(): boolean {
    return true;
  }

  public get isDir(): boolean {
    return false;
  }

  public asFile(): WsFilePath {
    return this;
  }

  public asDir(): undefined {
    return undefined;
  }

  /**
   * Replaces the file name of this WsFilePath with a new one.
   * @param newFileName The new file name to use (with extension)
   * @returns A new WsFilePath instance with the replaced file name
   * @throws Error if the new file name is invalid
   */
  public replaceFileName(newFileName: string): WsFilePath {
    if (!newFileName) {
      throwAppError(
        'error::ws-path:invalid-ws-path',
        'New file name cannot be empty',
        {
          invalidPath: newFileName,
        },
      );
    }

    // Check if newFileName has an extension
    const dotIndex = newFileName.lastIndexOf('.');
    if (dotIndex === -1 || dotIndex === newFileName.length - 1) {
      throwAppError(
        'error::ws-path:invalid-ws-path',
        'New file name must have an extension',
        {
          invalidPath: newFileName,
        },
      );
    }

    // Get the directory path
    const dirPath = this._getDirPath();

    // Combine workspace name, directory path, and the new file name
    const newPath = `${this.wsName}:${dirPath}${newFileName}`;

    return WsFilePath.fromString(newPath);
  }

  public isRootLevelFile(): boolean {
    return this.getParent()?.isRoot ?? false;
  }
}

/**
 * A specialized WsPath that is guaranteed to point to a directory.
 */
export class WsDirPath extends WsPath {
  public static fromString(raw: string | WsPath): WsDirPath {
    if (raw instanceof WsDirPath) {
      return raw;
    }
    let normalizedRaw = typeof raw === 'string' ? raw : raw.toString();

    const result = WsPath._parseCore(normalizedRaw);
    if (!result.ok) {
      throwAppError(
        'error::ws-path:invalid-ws-path',
        result.validationError.reason,
        {
          invalidPath: normalizedRaw,
        },
      );
    }

    if (!result.data.isDir) {
      throwAppError(
        'error::ws-path:invalid-ws-path',
        'Expected a directory path without extension',
        {
          invalidPath: normalizedRaw,
        },
      );
    }

    if (result.data.path !== '') {
      normalizedRaw = ensureEndsWith(normalizedRaw, WsPath.PATH_SEPARATOR);
    }

    return new WsDirPath(normalizedRaw);
  }

  public static fromParts(wsName: string, path: string): WsDirPath {
    const pathWithSlash = ensureEndsWith(path, WsPath.PATH_SEPARATOR);
    return WsDirPath.fromString(`${wsName}:${pathWithSlash}`);
  }

  public get extension(): undefined {
    return undefined;
  }

  public get isFile(): boolean {
    return false;
  }

  public get isDir(): boolean {
    return true;
  }

  public asFile(): undefined {
    return undefined;
  }

  public asDir(): WsDirPath {
    return this;
  }

  /**
   * Creates a new file path in this directory.
   * @param fileName The file name to create (with extension)
   * @returns A new WsFilePath instance in the current directory
   * @throws Error if the file name is invalid
   */
  public createFilePath(fileName: string): WsFilePath {
    if (!fileName) {
      throwAppError(
        'error::ws-path:invalid-ws-path',
        'File name cannot be empty',
        {
          invalidPath: fileName,
        },
      );
    }

    // Check if fileName has an extension
    const dotIndex = fileName.lastIndexOf('.');
    if (dotIndex === -1 || dotIndex === fileName.length - 1) {
      throwAppError(
        'error::ws-path:invalid-ws-path',
        'File name must have an extension',
        {
          invalidPath: fileName,
        },
      );
    }

    // Ensure fileName doesn't have any path separators
    if (fileName.includes(WsPath.PATH_SEPARATOR)) {
      throwAppError(
        'error::ws-path:invalid-ws-path',
        `File name cannot contain path separator (${WsPath.PATH_SEPARATOR})`,
        {
          invalidPath: fileName,
        },
      );
    }

    // Combine workspace name, current directory path, and the file name
    const newPath = `${this.wsName}:${this.path}${fileName}`;

    return WsFilePath.fromString(newPath);
  }
}

export function ensureEndsWith(str: string, suffix: string): string {
  return str.endsWith(suffix) ? str : str + suffix;
}

export function removeStartsWith(str: string, char: string): string {
  return str.startsWith(char) ? str.slice(char.length) : str;
}
