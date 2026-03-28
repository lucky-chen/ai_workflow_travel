import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ToolHandler, ToolCallInput, ToolCallResult } from "./types.js";

export function createBuiltInToolHandlers(rootDir: string): Record<string, ToolHandler> {
  return {
    echo: {
      async handle(input: ToolCallInput): Promise<ToolCallResult> {
        const content = typeof input.payload.content === "string"
          ? input.payload.content
          : JSON.stringify(input.payload);
        return {
          content,
          exitCode: 0,
        };
      },
    },
    read_file: {
      async handle(input: ToolCallInput): Promise<ToolCallResult> {
        const target = resolveToolPath(rootDir, input);
        const content = await readFile(target, "utf8");
        return {
          content,
          exitCode: 0,
        };
      },
    },
    write_file: {
      async handle(input: ToolCallInput): Promise<ToolCallResult> {
        const target = resolveToolPath(rootDir, input);
        const content = typeof input.payload.content === "string" ? input.payload.content : "";
        await writeFile(target, content, "utf8");
        return {
          content: "written",
          exitCode: 0,
        };
      },
    },
  };
}

function resolveToolPath(rootDir: string, input: ToolCallInput): string {
  const relativePath = typeof input.payload.path === "string" ? input.payload.path : "";
  const baseDir = input.workingDirectory ? path.resolve(input.workingDirectory) : rootDir;
  return path.resolve(baseDir, relativePath);
}
