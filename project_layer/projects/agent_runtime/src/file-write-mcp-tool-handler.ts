import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { McpToolRequest, McpToolResult } from "./agent-runtime-types.js";
import type { IMcpToolHandler } from "./mcp-tool-registry.js";

export class FileWriteMcpToolHandler implements IMcpToolHandler {
  readonly toolName = "file_write";

  async call(request: McpToolRequest): Promise<McpToolResult> {
    const filePath = readStringArg(request.arguments, "path", this.toolName);
    const content = readStringArg(request.arguments, "content", this.toolName);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf8");
    return {
      toolName: this.toolName,
      success: true,
      content: "ok",
      metadata: {
        path: filePath,
      },
    };
  }
}

function readStringArg(args: Record<string, unknown>, key: string, toolName: string): string {
  const value = args[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`MCP tool "${toolName}" requires a non-empty string argument "${key}".`);
  }

  return value;
}
