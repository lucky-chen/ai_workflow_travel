import path from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export async function createMcpStdioClientHarness(): Promise<{
  client: Client;
  close: () => Promise<void>;
}> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(process.cwd(), "bin", "sdlc-mcp.js")],
    cwd: process.cwd(),
    env: process.env as Record<string, string>,
    stderr: "pipe",
  });
  const client = new Client({
    name: "sdlc-mcp-test-client",
    version: "0.1.0",
  });
  await client.connect(transport);
  return {
    client,
    close: async () => {
      await client.close();
    },
  };
}
