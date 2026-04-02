import { readFile } from "node:fs/promises";
import path from "node:path";

import type { UserInput } from "../interface/api.js";
import type { RetrievalContext, RetrievalFragment } from "./types.js";
import type { RetrievalProvider } from "./retrieval-provider.js";

export class WorkspaceRetrievalProvider implements RetrievalProvider {
  constructor(private readonly workdir: string) {}

  async retrieve(_userInput: UserInput, _sessionId: string, queryText: string): Promise<RetrievalContext> {
    const normalizedQuery = queryText.trim().toLowerCase();
    if (!normalizedQuery) {
      return { fragments: [] };
    }

    const candidates = [
      path.join(this.workdir, "docs", "design.md"),
      path.join(this.workdir, "docs", "api.md"),
      path.join(this.workdir, "README.md"),
    ];
    const fragments: RetrievalFragment[] = [];

    for (const candidate of candidates) {
      try {
        const content = await readFile(candidate, "utf8");
        const score = scoreContent(content, normalizedQuery);
        if (score > 0) {
          fragments.push({
            content,
            source: candidate,
            score,
          });
        }
      } catch (error) {
        if (!isMissingStorageError(error)) {
          throw error;
        }
      }
    }

    fragments.sort((left, right) => (right.score ?? 0) - (left.score ?? 0));
    return { fragments };
  }
}

function scoreContent(content: string, normalizedQuery: string): number {
  const normalizedContent = content.toLowerCase();
  if (!normalizedContent.includes(normalizedQuery)) {
    return 0;
  }
  return normalizedQuery.split(/\s+/).filter((part) => normalizedContent.includes(part)).length;
}

function isMissingStorageError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
