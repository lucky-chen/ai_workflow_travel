import process from "node:process";

const { Client } = (await import(
  resolveWorkspaceModule("../../../../../project_layer/projects/sdlc/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js")
)) as any;
const { StdioClientTransport } = (await import(
  resolveWorkspaceModule("../../../../../project_layer/projects/sdlc/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js")
)) as any;

type ProviderDefinition =
  | {
      type: "stdio";
      command: string;
      args?: string[];
      env?: Record<string, string> | (() => Record<string, string>);
    };

const PROVIDER_DEFINITIONS: Record<string, ProviderDefinition> = {
  googleMaps: {
    type: "stdio",
    command: "npx",
    args: ["-y", "@open-mcp/google-maps"],
    env: () => ({
      KEY: envOrEmpty("GOOGLE_MAPS_API_KEY"),
    }),
  },
  amapMaps: {
    type: "stdio",
    command: "npx",
    args: ["-y", "@amap/amap-maps-mcp-server"],
    env: () => ({
      AMAP_MAPS_API_KEY: envOrEmpty("AMAP_MAPS_API_KEY"),
    }),
  },
  openWeather: {
    type: "stdio",
    command: "npx",
    args: ["-y", "@open-mcp/open-weather"],
  },
};

export class ProviderMcpRegistry {
  readonly #clients = new Map<string, InstanceType<typeof Client>>();

  getProviderNames(): string[] {
    return Object.keys(PROVIDER_DEFINITIONS);
  }

  async getClient(name: string): Promise<InstanceType<typeof Client>> {
    if (!this.#clients.has(name)) {
      const definition = PROVIDER_DEFINITIONS[name];
      if (!definition) {
        throw new Error(`Unsupported provider MCP: ${name}`);
      }
      this.#clients.set(name, await createClient(name, definition));
    }
    return this.#clients.get(name)!;
  }

  async listProviderTools(name: string): Promise<Array<{ name: string; description?: string; inputSchema?: unknown }>> {
    const client = await this.getClient(name);
    const result = await client.listTools();
    return (result.tools ?? []).map((tool: { name: string; description?: string; inputSchema?: unknown }) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  }

  async callProviderTool(
    providerName: string,
    toolName: string,
    argumentsPayload: Record<string, unknown>,
  ): Promise<{
    status: "ok" | "error";
    provider: string;
    tool: string;
    arguments: Record<string, unknown>;
    result?: unknown;
    message?: string;
  }> {
    try {
      const client = await this.getClient(providerName);
      const result = await client.callTool({
        name: toolName,
        arguments: argumentsPayload,
      });
      return {
        status: result.isError ? "error" : "ok",
        provider: providerName,
        tool: toolName,
        arguments: argumentsPayload,
        result: result.structuredContent ?? result.content ?? result,
      };
    } catch (error) {
      return {
        status: "error",
        provider: providerName,
        tool: toolName,
        arguments: argumentsPayload,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

async function createClient(name: string, definition: ProviderDefinition): Promise<InstanceType<typeof Client>> {
  const client = new Client({
    name: `travel-provider-${name}`,
    version: "0.1.0",
  });
  await client.connect(createTransport(definition));
  return client;
}

function createTransport(definition: ProviderDefinition): InstanceType<typeof StdioClientTransport> {
  const resolvedEnv = typeof definition.env === "function" ? definition.env() : definition.env;
  return new StdioClientTransport({
    command: definition.command,
    args: definition.args ?? [],
    cwd: process.cwd(),
    env: buildStringEnv(resolvedEnv),
    stderr: "pipe",
  });
}

function envOrEmpty(name: string): string {
  return process.env[name] ?? "";
}

function buildStringEnv(extraEnv: Record<string, string> | undefined): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      env[key] = value;
    }
  }
  for (const [key, value] of Object.entries(extraEnv ?? {})) {
    env[key] = value;
  }
  return env;
}

function resolveWorkspaceModule(relativePathFromDistSrc: string): string {
  return new URL(relativePathFromDistSrc, import.meta.url).href;
}
