import type { ComposeRunRequest, IComposeRunService } from "./Schema/compose-run.js";
import type { RuntimeInput, RuntimeResult } from "./Schema/runtime.js";
import { ComposeRunNotImplementedService } from "./compose-run-service.js";

export interface Orchestrator {
  run(input: RuntimeInput): Promise<RuntimeResult>;
}

export class RuntimeOrchestrator implements Orchestrator {
  constructor(
    private readonly composeRunService: IComposeRunService = new ComposeRunNotImplementedService(),
  ) {}

  async run(input: RuntimeInput): Promise<RuntimeResult> {
    if (input.request.mode !== "compose") {
      throw new Error(`Unsupported runtime mode: ${input.request.mode}`);
    }

    const composeRunRequest: ComposeRunRequest = {
      workspaceRoot: input.context.workspaceRoot,
      runId: input.context.runId,
      composeMode: input.request.composeMode,
      ...(input.request.entryUnit ? { entryUnit: input.request.entryUnit } : {}),
      ...(input.request.params ? { params: input.request.params } : {}),
    };

    return this.composeRunService.run(composeRunRequest);
  }
}
