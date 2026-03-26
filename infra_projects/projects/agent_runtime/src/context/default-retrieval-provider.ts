import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import type {
  RequestMetadata,
  RetrievalItem,
  RetrievalRequest,
} from "../runtime/agent-runtime-types.js";

export interface RetrievalProvider {
  load(request: RetrievalRequest): Promise<RetrievalItem[]>;
}

export class DefaultRetrievalProvider implements RetrievalProvider {
  async load(request: RetrievalRequest): Promise<RetrievalItem[]> {
    if (!request.query.trim()) {
      return [];
    }

    const items: RetrievalItem[] = [];
    for (const source of request.candidateSources) {
      items.push(...(await loadCandidateSource(source, request.query, request.metadata)));
    }
    return items;
  }
}

async function loadCandidateSource(
  source: string,
  query: string,
  metadata?: RequestMetadata,
): Promise<RetrievalItem[]> {
  try {
    const stats = await stat(source);
    if (stats.isDirectory()) {
      return loadDirectory(source, query, metadata);
    }

    if (stats.isFile()) {
      return loadFile(source, query, metadata);
    }
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  return [];
}

async function loadDirectory(
  directory: string,
  query: string,
  metadata?: RequestMetadata,
): Promise<RetrievalItem[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const items: RetrievalItem[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      items.push(...(await loadDirectory(entryPath, query, metadata)));
      continue;
    }

    if (entry.isFile()) {
      items.push(...(await loadFile(entryPath, query, metadata)));
    }
  }

  return items;
}

async function loadFile(
  filePath: string,
  query: string,
  metadata?: RequestMetadata,
): Promise<RetrievalItem[]> {
  const content = await readFile(filePath, "utf8");
  const snippet = extractSnippet(content, query);
  if (!snippet) {
    return [];
  }

  return [createRetrievalItem(filePath, snippet, metadata)];
}

function extractSnippet(content: string, query: string): string | undefined {
  const normalizedContent = content.toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();
  const matchIndex = normalizedContent.indexOf(normalizedQuery);
  if (matchIndex < 0) {
    return undefined;
  }

  const start = Math.max(0, matchIndex - 120);
  const end = Math.min(content.length, matchIndex + normalizedQuery.length + 120);
  return content.slice(start, end);
}

function createRetrievalItem(source: string, content: string, metadata?: RequestMetadata): RetrievalItem {
  return {
    ref: source,
    content,
    ...(metadata ? { metadata: toStringRecord(metadata) } : {}),
  };
}

function toStringRecord(metadata: RequestMetadata): Record<string, string> {
  const record: Record<string, string> = {};
  if (metadata.requestId) {
    record.requestId = metadata.requestId;
  }
  if (metadata.caller) {
    record.caller = metadata.caller;
  }
  if (metadata.traceId) {
    record.traceId = metadata.traceId;
  }
  if (metadata.labels) {
    Object.assign(record, metadata.labels);
  }
  return record;
}
