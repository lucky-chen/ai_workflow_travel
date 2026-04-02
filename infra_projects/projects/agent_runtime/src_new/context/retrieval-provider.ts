import type { UserInput } from "../interface/api.js";
import type { RetrievalContext } from "./types.js";
import { WorkspaceRetrievalProvider } from "./workspace-retrieval-provider.js";

export interface RetrievalProvider {
  retrieve(userInput: UserInput, sessionId: string, queryText: string): Promise<RetrievalContext>;
}

export function createRetrievalProvider(workdir: string): RetrievalProvider {
  return new WorkspaceRetrievalProvider(workdir);
}
