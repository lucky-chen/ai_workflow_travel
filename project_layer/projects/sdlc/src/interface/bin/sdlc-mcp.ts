import { McpProjectRegistryService, McpServerService } from "../Mcp/index.js";
import { McpStdioServer } from "../Mcp/stdio-server.js";

async function main(): Promise<void> {
  const projectRegistry = new McpProjectRegistryService({
    ...(process.env.SDLC_REPOSITORY_ROOT ? { repositoryRoot: process.env.SDLC_REPOSITORY_ROOT } : {}),
  });
  const service = new McpServerService({ projectRegistry });
  const server = new McpStdioServer(service, {
    serverInfo: {
      name: "sdlc-mcp",
      version: "0.1.0",
    },
  });
  server.start();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
