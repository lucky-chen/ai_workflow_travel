export interface ModelFactory {
  createModel(input: ModelCreationInput): IModel;
}

export interface ModelCreationInput {
  mock: boolean;
  modeSelection: ModeSelection;
  mockInfo?: Record<string, unknown>;
}

export interface ModeSelection {
  url?: string;
  key?: string;
  model?: string;
}

export interface IModel {
  isRunning(): boolean;
  execute(input: ModuleRequest): Promise<ModuleResponse>;
  stream(input: ModuleRequest): AsyncIterable<StreamEvent>;
}

export interface ModuleRequest {
  prompt: Record<string, unknown>;
  stream: boolean;
}

export interface ModuleResponse {
  content: string;
  error: {
    code: string;
    message: string;
  };
}

export interface StreamEvent {
  content: string;
  done: boolean;
  error?: {
    code: string;
    message: string;
  };
}

export interface ProviderStreamEvent {
  payload: Record<string, unknown>;
}

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export type FetchLike = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
  },
) => Promise<FetchResponseLike>;

