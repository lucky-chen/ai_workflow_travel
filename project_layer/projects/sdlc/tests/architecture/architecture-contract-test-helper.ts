import type { ContractExecutionResult, ContractSpec } from "../../src/contract/document-stage-contract.js";

export function runArchitectureContractStyleChecks(
  generatedResult: string,
  contractSpec: ContractSpec,
): ContractExecutionResult {
  const content = generatedResult;
  const issues: ContractExecutionResult["issues"] = [];

  for (const section of contractSpec.section_contracts.filter((entry) => !entry.section_id.includes("."))) {
    const headingCandidates = [`# ${section.section_id}. ${section.title}`, `# ${section.section_id} ${section.title}`];
    if (!headingCandidates.some((heading) => content.includes(heading))) {
      issues.push({
        checkItem: "document_structure_complete",
        message: `Missing required heading for section ${section.section_id}: ${section.title}`,
        severity: "high",
      });
    }
  }

  const levelContract = contractSpec.document_contracts.find((entry) => entry.check_item === "architecture_level_consistency");
  if (/{[^}]+}/.test(content)) {
    issues.push({
      checkItem: levelContract?.check_item ?? "architecture_level_consistency",
      message: "Architecture document still contains unresolved template placeholders.",
      severity: levelContract?.severity ?? "high",
    });
  }
  if (/\bclass\s+[A-Z]\w*/i.test(content) || /\bAPI endpoint\b/i.test(content)) {
    issues.push({
      checkItem: levelContract?.check_item ?? "architecture_level_consistency",
      message: "Architecture document appears to contain implementation-level detail.",
      severity: levelContract?.severity ?? "high",
    });
  }

  const crossSectionContract = contractSpec.document_contracts.find((entry) => entry.check_item === "cross_section_alignment");
  const layersSection = extractSection(content, getSectionHeading(contractSpec, "4.2", "Layers or Partitions"));
  if (!/^\s*-\s+/m.test(layersSection)) {
    issues.push({
      checkItem: crossSectionContract?.check_item ?? "cross_section_alignment",
      message: "Layers or Partitions section should list architecture partitions.",
      severity: crossSectionContract?.severity ?? "high",
    });
  }

  const dependenciesSection = extractSection(content, getSectionHeading(contractSpec, "4.3", "Allowed Dependencies"));
  if (!dependenciesSection.includes("ALLOW:")) {
    issues.push({
      checkItem: crossSectionContract?.check_item ?? "cross_section_alignment",
      message: "Allowed Dependencies section should declare ALLOW dependency rules.",
      severity: crossSectionContract?.severity ?? "high",
    });
  }

  const layerNames = [...layersSection.matchAll(/^\s*-\s+([^:\n]+):/gm)].map((match) => match[1].trim());
  const dependencyNodes = [...dependenciesSection.matchAll(/-\s+([^-\n]+?)\s*->\s*([^\n]+)/g)]
    .flatMap((match) => [match[1].trim(), match[2].trim()]);
  const unknownDependencyNodes = dependencyNodes.filter((name) => !layerNames.includes(name));
  if (unknownDependencyNodes.length > 0) {
    issues.push({
      checkItem: crossSectionContract?.check_item ?? "cross_section_alignment",
      message: `Allowed Dependencies references undefined layers or partitions: ${unknownDependencyNodes.join(", ")}`,
      severity: crossSectionContract?.severity ?? "high",
    });
  }

  const coreModulesSection = extractSection(content, getSectionHeading(contractSpec, "5.2", "Core Modules"));
  const coreModules = [...coreModulesSection.matchAll(/^\s*-\s+([^:\n]+):/gm)];
  if (coreModules.length < 3) {
    issues.push({
      checkItem: crossSectionContract?.check_item ?? "cross_section_alignment",
      message: "Core Modules section should list the major modules needed to understand the architecture.",
      severity: crossSectionContract?.severity ?? "high",
    });
  }

  return {
    passed: issues.length === 0,
    summary: issues.length === 0
      ? "Architecture design document passed contract checks."
      : "Architecture design document failed contract checks.",
    issues,
  };
}

function getSectionHeading(contractSpec: ContractSpec, sectionId: string, fallbackTitle: string): string {
  const section = contractSpec.section_contracts.find((entry) => entry.section_id === sectionId);
  const title = section?.title ?? fallbackTitle;
  const headingLevel = sectionId.includes(".") ? "##" : "#";
  return `${headingLevel} ${sectionId} ${title}`;
}

function extractSection(content: string, heading: string): string {
  const startIndex = content.indexOf(heading);
  if (startIndex < 0) {
    return "";
  }

  const rest = content.slice(startIndex + heading.length);
  const nextHeadingOffset = rest.search(/\n# /);
  if (nextHeadingOffset < 0) {
    return rest;
  }

  return rest.slice(0, nextHeadingOffset);
}
