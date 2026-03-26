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

    return request.candidateSources.map((source) => createRetrievalItem(source, request.metadata));
  }
}

function createRetrievalItem(source: string, metadata?: RequestMetadata): RetrievalItem {
  return {
    ref: source,
    content: `retrieval:${source}`,
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
