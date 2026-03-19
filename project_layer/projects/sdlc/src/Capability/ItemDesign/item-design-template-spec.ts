import { readFile } from "node:fs/promises";

import { getTemplateFilePath } from "../Shared/resource-paths.js";

export interface ItemDesignTemplateSpec {
  outputSkeleton: string;
}

const templateSpecCache = new Map<string, ItemDesignTemplateSpec>();

export async function loadItemDesignTemplateSpec(workspaceRoot?: string, resourceRoot?: string): Promise<ItemDesignTemplateSpec> {
  if (!workspaceRoot) {
    throw new Error("Item design template loading requires workspaceRoot.");
  }

  const templatePath = getTemplateFilePath(workspaceRoot, "ItemDesignTemplate.md", resourceRoot);
  const cached = templateSpecCache.get(templatePath);
  if (cached) {
    return cached;
  }

  const templateContent = await readFile(templatePath, "utf8");
  const parsed = parseItemDesignTemplateSpec(templateContent);
  const spec: ItemDesignTemplateSpec = {
    outputSkeleton: parsed.outputSkeleton,
  };
  templateSpecCache.set(templatePath, spec);
  return spec;
}

export function parseItemDesignTemplateSpec(content: string): ItemDesignTemplateSpec {
  return {
    outputSkeleton: stripCommentBlocks(content).trim(),
  };
}

function stripCommentBlocks(content: string): string {
  return content
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\n{3,}/g, "\n\n");
}
