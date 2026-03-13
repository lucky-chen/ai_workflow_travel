import { readFile } from "node:fs/promises";

import type { ContractSpec, SectionContract } from "../contract/document-stage-contract.js";
import { describeResourcePath, resolveResourcePath } from "./resource-resolver.js";

export interface ModuleDesignTemplateSpec {
  contractSpec: ContractSpec;
  outputSkeleton: string;
}

const templateSpecCache = new Map<string, ModuleDesignTemplateSpec>();

export async function loadModuleDesignTemplateSpec(workspaceRoot?: string): Promise<ModuleDesignTemplateSpec> {
  const templatePath = await resolveResourcePath("template/ModuleDesignTemplate.md", workspaceRoot);
  const cached = templateSpecCache.get(templatePath);
  if (cached) {
    return cached;
  }

  const templateContent = await readFile(templatePath, "utf8");
  const parsed = parseModuleDesignTemplateSpec(templateContent);
  const spec: ModuleDesignTemplateSpec = {
    contractSpec: {
      ...parsed.contractSpec,
      specific_contract: {
        source: await describeResourcePath(templatePath, workspaceRoot),
        stage: "module_design",
      },
    },
    outputSkeleton: parsed.outputSkeleton,
  };
  templateSpecCache.set(templatePath, spec);
  return spec;
}

export function parseModuleDesignTemplateSpec(content: string): ModuleDesignTemplateSpec {
  const blocks = extractCommentBlocks(content);
  const documentContracts = blocks
    .map(parseJsonBlock)
    .find((entry): entry is { document_contracts: ContractSpec["document_contracts"] } => Array.isArray(entry?.document_contracts))
    ?.document_contracts;

  if (!documentContracts) {
    throw new Error('Module design template must define top-level "document_contracts".');
  }

  const sectionContracts = blocks
    .map(parseJsonBlock)
    .flatMap((entry) => {
      if (!entry || typeof entry !== "object" || !("section_contract" in entry)) {
        return [];
      }

      return [entry.section_contract];
    })
    .filter(isSectionContract);

  if (sectionContracts.length === 0) {
    throw new Error("Module design template must define at least one section contract.");
  }

  return {
    contractSpec: {
      document_contracts: documentContracts,
      section_contracts: sectionContracts,
    },
    outputSkeleton: stripCommentBlocks(content).trim(),
  };
}

function extractCommentBlocks(content: string): string[] {
  return [...content.matchAll(/<!--\s*([\s\S]*?)\s*-->/g)].map((match) => match[1] ?? "");
}

function stripCommentBlocks(content: string): string {
  return content
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\n{3,}/g, "\n\n");
}

function parseJsonBlock(block: string): Record<string, unknown> | null {
  try {
    return JSON.parse(block) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isSectionContract(value: unknown): value is SectionContract {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.section_id === "string"
    && typeof candidate.title === "string"
    && Array.isArray(candidate.checkitems)
    && (candidate.severity === "low" || candidate.severity === "medium" || candidate.severity === "high")
    && (candidate.expected_format === undefined || typeof candidate.expected_format === "string");
}
