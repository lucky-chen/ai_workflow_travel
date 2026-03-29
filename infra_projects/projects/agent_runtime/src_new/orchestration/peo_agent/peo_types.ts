export interface PlanStepResult {
  plan: string;
  toolCall?: {
    toolCallId: string;
    toolName: string;
    arguments: Record<string, unknown>;
  };
  finalAnswer?: string;
}

export interface ExecutionStepResult {
  executionObservation: string;
  finalAnswer?: string;
  toolCalls: number;
  failedToolCalls: number;
  toolCall?: {
    toolCallId: string;
    toolName: string;
    arguments: Record<string, unknown>;
  };
  toolResult?: {
    content: string;
    errorCode?: string;
    errorMessage?: string;
  };
}

export interface ObserveStepInput {
  plan: string;
  executionResult: ExecutionStepResult;
  priorObservation?: string;
}
