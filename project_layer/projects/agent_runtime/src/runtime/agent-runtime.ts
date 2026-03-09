import type { IAgentTraceRecorder } from "./agent-trace-recorder.js";
import { DefaultAgent } from "./default-agent.js";
import { DefaultExecutor } from "./default-executor.js";
import { DefaultMcpGateway } from "../mcp/default-mcp-gateway.js";
import { DefaultObserver } from "./default-observer.js";
import { DefaultPlanner } from "./default-planner.js";
import type { IAgent, IMcpGateway, IModelExecutionBackend } from "./agent-runtime-types.js";

export * from "./agent-runtime-types.js";
export { AgentTraceApi } from "./agent-trace-api.js";
export * from "./agent-trace-events.js";
export { DefaultAgent } from "./default-agent.js";
export { DefaultPlanner } from "./default-planner.js";
export { DefaultObserver } from "./default-observer.js";
export { DefaultExecutor } from "./default-executor.js";
export { DefaultMcpGateway } from "../mcp/default-mcp-gateway.js";
export { McpToolRegistry } from "../mcp/mcp-tool-registry.js";
export type { IMcpToolHandler } from "../mcp/mcp-tool-registry.js";
export { FileReadMcpToolHandler } from "../mcp/file-read-mcp-tool-handler.js";
export { FileWriteMcpToolHandler } from "../mcp/file-write-mcp-tool-handler.js";

export interface CreateDefaultAgentOptions {
  backend: IModelExecutionBackend;
  mcpGateway?: IMcpGateway;
  traceRecorder?: IAgentTraceRecorder;
}

export function createDefaultAgent(options: CreateDefaultAgentOptions): IAgent {
  const planner = new DefaultPlanner();
  const executor = new DefaultExecutor(options.backend, options.mcpGateway ?? new DefaultMcpGateway());
  const observer = new DefaultObserver();
  return new DefaultAgent(planner, executor, observer, options.traceRecorder);
}
