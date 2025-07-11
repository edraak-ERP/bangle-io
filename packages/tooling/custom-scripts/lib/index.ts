import url from 'node:url';

export * from './workspace-helper';

export function makeThrowValidationError(
  prefix: string,
): (message: string) => never {
  return (message) => {
    throw new Error(`${prefix}: ${message}`);
  };
}

export function makeLogger(prefix: string) {
  return (...message: any[]) => {
    console.log(`${prefix}:`, ...message);
  };
}

export function setDifference<T>(
  setA: ReadonlySet<T>,
  setB: ReadonlySet<T>,
): Set<T> {
  const _difference = new Set(setA);
  for (const elem of setB) {
    _difference.delete(elem);
  }
  return _difference;
}

export function isMainModule(importUrl: string) {
  return importUrl === url.pathToFileURL(process.argv[1] || '').href;
}
