import { readFile } from "node:fs/promises";

import type { McpToolRequest, McpToolResult } from "../runtime/agent-runtime-types.js";
import type { IMcpToolHandler } from "./mcp-tool-registry.js";

export class FileReadMcpToolHandler implements IMcpToolHandler {
  readonly toolName = "file_read";

  async call(request: McpToolRequest): Promise<McpToolResult> {
    const filePath = readStringArg(request.arguments, "path", this.toolName);
    const content = await readFile(filePath, "utf8");
    return {
      toolName: this.toolName,
      success: true,
      content,
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
