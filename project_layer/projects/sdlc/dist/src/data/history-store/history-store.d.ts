import type { StageId, TaskId, TraceRef } from "../../shared/types/common.js";
export interface HistoryRecord {
    recordId?: TraceRef;
    category: string;
    taskId?: TaskId;
    stageId?: StageId;
    summary?: string;
    payload: Record<string, unknown>;
}
export interface HistoryQuery {
    category?: string;
    taskId?: TaskId;
    stageId?: StageId;
}
export declare class HistoryStoreService {
    private readonly storageRoot;
    constructor(storageRoot?: string);
    writeRecord(record: HistoryRecord): Promise<TraceRef>;
    getRecord(recordId: TraceRef): Promise<HistoryRecord>;
    listRecords(query?: HistoryQuery): Promise<HistoryRecord[]>;
}
