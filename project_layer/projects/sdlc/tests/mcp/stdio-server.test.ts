import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

export async function runMcpStdioServerTests(): Promise<void> {
  await runMcpStdioServerStartupTests();
  await runMcpStdioServerToolListTests();
  await runMcpStdioServerToolCallTests();
}

export async function runMcpStdioServerStartupTests(): Promise<void> {
  const harness = await startServer();

  try {
    const response = await harness.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "0.1.0" },
    });

    assert.equal(response.error, undefined);
    assert.deepEqual(response.result, {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: "sdlc-mcp",
        version: "0.1.0",
      },
    });
  } finally {
    await harness.close();
  }
}

export async function runMcpStdioServerToolListTests(): Promise<void> {
  const harness = await startServer();

  try {
    await initializeHarness(harness);
    const response = await harness.request("tools/list", {});

    assert.equal(response.error, undefined);
    const tools = (response.result as { tools: Array<{ name: string }> }).tools;
    assert.equal(tools.length, 15);
    assert.deepEqual(
      tools.map((entry) => entry.name),
      [
        "requirement_design_generate",
        "architecture_design_generate",
        "item_design_generate",
        "work_plan_generate",
        "requirement_design_update",
        "architecture_design_update",
        "item_design_update",
        "work_plan_update",
        "requirement_design_contract",
        "architecture_design_contract",
        "item_design_contract",
        "work_plan_contract",
        "overall_design_contract",
        "work_execute",
        "work_execute_contract",
      ],
    );
  } finally {
    await harness.close();
  }
}

export async function runMcpStdioServerToolCallTests(): Promise<void> {
  const harness = await startServer();

  try {
    await initializeHarness(harness);
    const response = await harness.request("tools/call", {
      name: "requirement_design_update",
      arguments: {
        project_name: "hello-service",
        user_comment: "Add one operational note.",
      },
    });

    assert.equal(response.error, undefined);
    const result = response.result as {
      content: Array<{ type: string; text: string }>;
      structuredContent: {
        status: string;
        message: string;
        files?: Array<{ path: string; role: string }>;
        issues?: Array<{ message: string }>;
        agentAction?: {
          actionType: string;
          targetPath: string;
          instructions: string;
        };
        externalAction?: unknown;
      };
      isError: boolean;
    };
    assert.equal(result.isError, false);
    assert.equal(result.content[0]?.type, "text");
    assert.equal(result.structuredContent.status, "success");
    assert.equal(result.structuredContent.files?.[0]?.path, "sdlc/docs/Requirement.md");
    assert.equal(result.structuredContent.files?.[0]?.role, "requirement_design");
    assert.equal(result.structuredContent.agentAction?.actionType, "update_markdown");
    assert.equal(result.structuredContent.agentAction?.targetPath, "sdlc/docs/Requirement.md");
    assert.match(result.structuredContent.agentAction?.instructions ?? "", /Add one operational note\./);
    assert.equal("externalAction" in result.structuredContent, false);
  } finally {
    await harness.close();
  }
}

async function initializeHarness(harness: StdioHarness): Promise<void> {
  const response = await harness.request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test-client", version: "0.1.0" },
  });
  assert.equal(response.error, undefined);
  harness.notify("notifications/initialized", {});
}

class StdioHarness {
  private readonly process: ChildProcessWithoutNullStreams;

  private buffer = Buffer.alloc(0);

  private nextId = 1;

  private readonly pending = new Map<number, {
    resolve: (response: JsonRpcResponse) => void;
    reject: (error: Error) => void;
  }>();

  constructor(processHandle: ChildProcessWithoutNullStreams) {
    this.process = processHandle;
    this.process.stdout.on("data", (chunk: Buffer | string) => {
      this.consume(typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk);
    });
    this.process.stderr.on("data", () => {
      return;
    });
    this.process.on("exit", () => {
      for (const pending of this.pending.values()) {
        pending.reject(new Error("MCP stdio server exited before responding."));
      }
      this.pending.clear();
    });
  }

  request(method: string, params: unknown): Promise<JsonRpcResponse> {
    const id = this.nextId++;
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    });
    const header = `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n`;
    this.process.stdin.write(header);
    this.process.stdin.write(body);
    return new Promise<JsonRpcResponse>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  notify(method: string, params: unknown): void {
    const body = JSON.stringify({
      jsonrpc: "2.0",
      method,
      params,
    });
    const header = `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n`;
    this.process.stdin.write(header);
    this.process.stdin.write(body);
  }

  async close(): Promise<void> {
    if (this.process.exitCode !== null) {
      return;
    }

    this.process.kill();
    await new Promise<void>((resolve) => {
      this.process.once("exit", () => resolve());
    });
  }

  private consume(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) {
        return;
      }

      const headerText = this.buffer.subarray(0, headerEnd).toString("utf8");
      const contentLengthLine = headerText
        .split("\r\n")
        .find((line) => line.toLowerCase().startsWith("content-length:"));
      if (!contentLengthLine) {
        throw new Error("Missing Content-Length in MCP stdio response.");
      }

      const contentLength = Number.parseInt(contentLengthLine.slice("content-length:".length).trim(), 10);
      const totalLength = headerEnd + 4 + contentLength;
      if (this.buffer.length < totalLength) {
        return;
      }

      const body = this.buffer.subarray(headerEnd + 4, totalLength).toString("utf8");
      this.buffer = this.buffer.subarray(totalLength);
      const response = JSON.parse(body) as JsonRpcResponse;
      const id = typeof response.id === "number" ? response.id : undefined;
      if (id !== undefined) {
        const pending = this.pending.get(id);
        if (pending) {
          this.pending.delete(id);
          pending.resolve(response);
        }
      }
    }
  }
}

async function startServer(): Promise<StdioHarness> {
  const processHandle = spawn(
    process.execPath,
    [path.join(process.cwd(), "bin", "sdlc-mcp.js")],
    {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    },
  );
  return new StdioHarness(processHandle);
}
