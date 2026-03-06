// LLM executor module: public entry for shared LLM execution.
import type {
  ILlmExecutor,
  LlmExecutionRequest,
  LlmExecutionResult,
} from "../../shared/contracts/llm-executor.js";
import { createLlmExecutor } from "./llm-executor-factory.js";
import type { LlmExecutorServiceDependencies } from "./llm-executor-factory.js";

export type { LlmExecutorMode, LlmExecutorServiceDependencies } from "./llm-executor-factory.js";
export type { RealLlmProvider, RealProviderConfig } from "./real-provider-config.js";

// Public API: shared LLM execution entry used by generation and contract modules.
export class LlmExecutorService implements ILlmExecutor {
  private readonly executor: ILlmExecutor;

  constructor(dependencies: LlmExecutorServiceDependencies = {}) {
    this.executor = createLlmExecutor(dependencies);
  }

  async execute(request: LlmExecutionRequest): Promise<LlmExecutionResult> {
    return this.executor.execute(request);
  }
}
