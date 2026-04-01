export type RuntimeEvent =
  | {
    type: "runtime";
    runtimeMessage: RuntimeMessage;
  }
  | {
    type: "agent";
    agentMessage: AgentMessage;
  }
  | {
    type: "model";
    modelMessage: ModelMessage;
  }
  | {
    type: "tool";
    toolMessage: ToolMessage;
  };

export interface RuntimeMessage {
  event:
    | "session_create_requested"
    | "session_created"
    | "session_open_requested"
    | "session_opened"
    | "session_closed"
    | "external_mcp_registered"
    | "run_started"
    | "context_assembled"
    | "state_persisted"
    | "run_finished"
    | "run_failed";
  timestamp: string;
  sessionId?: string;
  traceId?: string;
  session?: {
    mode?: "create" | "open" | "close";
  };
  custom?: Record<string, unknown>;
}

export interface AgentMessage {
  event: "step";
  timestamp: string;
  sessionId?: string;
  traceId?: string;
  agent: AgentEventAgent;
  custom?: Record<string, unknown>;
}

export interface ModelMessage {
  event: "model_started" | "model_completed";
  timestamp: string;
  request?: {
    responseFormat: "text" | "json";
    userPrompt: Record<string, unknown>;
    stream: boolean;
    systemPromptCount: number;
  };
  response?: {
    content: string;
    error: {
      code: string;
      message: string;
    };
  };
}

export interface ToolMessage {
  event: "tool_started" | "tool_failed";
  timestamp: string;
  sessionId?: string;
  traceId?: string;
  agent: AgentEventAgent;
  tool: {
    toolName: string;
    arguments?: Record<string, unknown>;
    error?: {
      code: string;
      message: string;
    };
    result?: {
      content: string;
      exitCode?: number;
      blockedByPolicy?: boolean;
    };
  };
  custom?: Record<string, unknown>;
}

export type AgentEventAgent =
  | {
    name: "chat";
    content: {
      step: "chat";
      input: Record<string, unknown>;
    };
  }
  | {
    name: "react";
    content: {
      step: "thought" | "action" | "observation";
      stepIndex: number;
      input: Record<string, unknown>;
    };
  }
  | {
    name: "peo";
    content: {
      step: "plan" | "execution" | "observation";
      stepIndex: number;
      input: Record<string, unknown>;
    };
  };

export interface RuntimeEventCallback {
  onEvent(event: RuntimeEvent): Promise<void> | void;
}
