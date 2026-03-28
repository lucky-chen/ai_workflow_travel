import type {
  AgentSessionAccessInput,
  ChatHistoryItem,
  SessionData,
  SessionResult,
  UserInput,
} from "../interface/api.js";

export interface RuntimeDependencies {
  storageRoot: string;
}

export interface StoredSessionState {
  sessionId: string;
  title?: string;
  history: ChatHistoryItem[];
  config?: Record<string, unknown>;
  status: "active" | "closed";
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeSessionCreateInput extends AgentSessionAccessInput {
  sessionId: string;
}

export interface AgentSessionLike {
  sessionId: string;
  load(): Promise<SessionData>;
  isRunning(): boolean;
  execute(userInput: UserInput): Promise<SessionResult>;
  close(): Promise<void>;
}

