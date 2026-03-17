export function parseJsonText<T>(content: string, invalidMessage: string): T {
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error(invalidMessage);
  }
}

export function tryParseJsonText<T>(content: string): T | undefined {
  try {
    return JSON.parse(content) as T;
  } catch {
    return undefined;
  }
}
