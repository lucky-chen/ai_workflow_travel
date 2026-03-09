import type { IAgentTraceRecorder } from "./agent-trace-recorder.js";
import { DefaultAgent } from "./default-agent.js";
import { DefaultExecutor } from "./default-executor.js";
import { DefaultMcpGateway } from "./default-mcp-gateway.js";
import { DefaultObserver } from "./default-observer.js";
import { DefaultPlanner } from "./default-planner.js";
import type { IAgent, IMcpGateway, IModelExecutionBackend } from "./agent-runtime-types.js";

export * from "./agent-runtime-types.js";
export { DefaultAgent } from "./default-agent.js";
export { DefaultPlanner } from "./default-planner.js";
export { DefaultObserver } from "./default-observer.js";
export { DefaultExecutor } from "./default-executor.js";
export { DefaultMcpGateway } from "./default-mcp-gateway.js";
export { McpToolRegistry } from "./mcp-tool-registry.js";
export type { IMcpToolHandler } from "./mcp-tool-registry.js";
export { FileReadMcpToolHandler } from "./file-read-mcp-tool-handler.js";
export { FileWriteMcpToolHandler } from "./file-write-mcp-tool-handler.js";

export interface CreateDefaultAgentOptions {
  backend: IModelExecutionBackend;
  mcpGateway?: IMcpGateway;
  traceRecorder?: IAgentTraceRecorder;
}

export function createDefaultAgent(options: CreateDefaultAgentOptions): IAgent {
  const planner = new DefaultPlanner();
  const executor = new DefaultExecutor(options.backend, options.mcpGateway);
  const observer = new DefaultObserver();
  return new DefaultAgent(planner, executor, observer, options.traceRecorder);
}
