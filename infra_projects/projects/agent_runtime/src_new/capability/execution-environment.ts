import type { ExecutionEnvironment, ToolCallInput, ToolCallResult, ToolHandler } from "./types.js";

export class LocalExecutionEnvironment implements ExecutionEnvironment {
  async execute(toolCall: ToolCallInput, handler: ToolHandler): Promise<ToolCallResult> {
    return handler.handle(toolCall);
  }
}
