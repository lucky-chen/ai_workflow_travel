import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "agent-runtime-test-mcp-server",
  version: "0.1.0",
});

server.registerTool(
  "remote_echo",
  {
    description: "Echo content from the external MCP server.",
    inputSchema: {
      content: z.string().optional(),
    },
  },
  async ({ content }) => ({
    content: [
      {
        type: "text",
        text: `remote:${content ?? ""}`,
      },
    ],
  }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
