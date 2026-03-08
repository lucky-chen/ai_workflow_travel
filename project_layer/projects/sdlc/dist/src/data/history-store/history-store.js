import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
export class HistoryStoreService {
    storageRoot;
    constructor(storageRoot = path.resolve(process.cwd(), "history_store")) {
        this.storageRoot = storageRoot;
    }
    async writeRecord(record) {
        const recordId = record.recordId ?? `history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const targetPath = path.join(this.storageRoot, "records", `${recordId}.json`);
        await mkdir(path.dirname(targetPath), { recursive: true });
        await writeFile(targetPath, JSON.stringify({
            ...record,
            recordId,
        }, null, 2), "utf8");
        return recordId;
    }
    async getRecord(recordId) {
        const targetPath = path.join(this.storageRoot, "records", `${recordId}.json`);
        const raw = await readFile(targetPath, "utf8");
        return JSON.parse(raw);
    }
    async listRecords(query = {}) {
        const recordsDirectory = path.join(this.storageRoot, "records");
        let entries;
        try {
            entries = await readdir(recordsDirectory);
        }
        catch (error) {
            const nodeError = error;
            if (nodeError.code === "ENOENT") {
                return [];
            }
            throw error;
        }
        const records = await Promise.all(entries
            .filter((entry) => entry.endsWith(".json"))
            .map(async (entry) => {
            const raw = await readFile(path.join(recordsDirectory, entry), "utf8");
            return JSON.parse(raw);
        }));
        return records.filter((record) => {
            if (query.category && record.category !== query.category) {
                return false;
            }
            if (query.taskId && record.taskId !== query.taskId) {
                return false;
            }
            if (query.stageId && record.stageId !== query.stageId) {
                return false;
            }
            return true;
        });
    }
}
