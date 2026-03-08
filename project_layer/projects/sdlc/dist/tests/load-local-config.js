import { readFile } from "node:fs/promises";
import path from "node:path";
export async function loadLocalConfig() {
    const configPath = path.resolve(process.cwd(), "local_env.json");
    try {
        const content = await readFile(configPath, "utf8");
        return JSON.parse(content);
    }
    catch (error) {
        const nodeError = error;
        if (nodeError.code === "ENOENT") {
            return {};
        }
        throw error;
    }
}
