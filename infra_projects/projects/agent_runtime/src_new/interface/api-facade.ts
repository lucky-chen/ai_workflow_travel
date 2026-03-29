import type { RuntimeOptions } from "../runtime/runtime.js";
import { createRuntime } from "../runtime/runtime.js";
import type {
  AgentSessionAccessInput,
  CloseSessionResult,
  ISession,
  RuntimeApi,
} from "./api.js";

export class Api implements RuntimeApi {
  constructor(private readonly runtime: RuntimeApi) {}

  async createSession(input: AgentSessionAccessInput): Promise<ISession> {
    return this.runtime.createSession(input);
  }

  async openSession(sessionId: string): Promise<ISession> {
    return this.runtime.openSession(sessionId);
  }

  async closeSession(sessionId: string): Promise<CloseSessionResult> {
    return this.runtime.closeSession(sessionId);
  }
}

export function createApi(options: RuntimeOptions): Api {
  return new Api(createRuntime(options));
}
