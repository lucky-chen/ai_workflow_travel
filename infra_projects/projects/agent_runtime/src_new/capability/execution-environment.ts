import type {
  ExecutionEnvironment as ExecutionEnvironmentContract,
  ExecutionEnvironmentInput,
  ToolCallResult,
} from "./types.js";

export class ExecutionEnvironment implements ExecutionEnvironmentContract {
  async execute(input: ExecutionEnvironmentInput): Promise<ToolCallResult> {
    return input.handler.handle(input.toolCall);
  }
}
