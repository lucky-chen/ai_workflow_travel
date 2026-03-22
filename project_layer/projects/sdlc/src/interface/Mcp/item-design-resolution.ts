import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

interface ArchitectureBreakdownEntry {
  targetName?: string;
  name?: string;
  documentPath?: string;
}

const ITEM_BREAKDOWN_PATH = "sdlc/docs/architecture_design_breakdown.json";

export async function resolvePrimaryItemDocumentPath(workspaceRoot: string): Promise<string> {
  const breakdownEntries = await readArchitectureBreakdown(workspaceRoot);
  const firstEntry = breakdownEntries.find((entry) => typeof entry.documentPath === "string" && entry.documentPath.length > 0);
  if (firstEntry?.documentPath) {
    return firstEntry.documentPath;
  }

  const itemDesignDirectory = path.join(workspaceRoot, "sdlc", "docs", "item_design");
  const entries = await readdir(itemDesignDirectory, { withFileTypes: true });
  const firstDocument = entries.find((entry) => entry.isFile() && entry.name.endsWith(".md"));
  if (firstDocument) {
    return path.join("sdlc", "docs", "item_design", firstDocument.name);
  }

  throw new Error("Unable to resolve primary item design document for MCP item_design_contract.");
}

export async function loadItemDesignDocuments(
  workspaceRoot: string,
): Promise<Array<{ itemName: string; content: string }>> {
  const breakdownEntries = await readArchitectureBreakdown(workspaceRoot);
  const results = await Promise.all(
    breakdownEntries
      .filter((entry) => typeof entry.documentPath === "string" && entry.documentPath.length > 0)
      .map(async (entry) => ({
        itemName: entry.targetName ?? entry.name ?? path.basename(entry.documentPath!, ".md"),
        content: await readFile(path.join(workspaceRoot, entry.documentPath!), "utf8"),
      })),
  );

  if (results.length === 0) {
    throw new Error("Unable to build prepared step context: no item design documents are available.");
  }

  return results;
}

async function readArchitectureBreakdown(workspaceRoot: string): Promise<ArchitectureBreakdownEntry[]> {
  const raw = await readFile(path.join(workspaceRoot, ITEM_BREAKDOWN_PATH), "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Architecture design breakdown must be a JSON array.");
  }

  return parsed as ArchitectureBreakdownEntry[];
}
