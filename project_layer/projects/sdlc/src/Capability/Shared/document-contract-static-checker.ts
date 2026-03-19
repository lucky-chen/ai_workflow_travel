import type { ContractIssue } from "../../Runtime/Unit/execution-unit.js";
import type { ContractSpec, DocumentContract, SectionContract } from "./document-unit-contract.js";

const PLACEHOLDER_PATTERN = /\{[A-Za-z][A-Za-z0-9_]*\}/;
const HEADING_PATTERN = /^(#{1,6})\s+(.+)$/;

export function runMarkdownDocumentStaticChecks(
  content: string,
  contractSpec: ContractSpec,
): ContractIssue[] {
  const issues: ContractIssue[] = [];
  const structureContract = findDocumentContractByPriority(contractSpec, ["document_structure_complete"]);
  const formatContract = findDocumentContractByPriority(contractSpec, [
    "section_contract_alignment",
    "cross_section_alignment",
    "journey_and_goal_alignment",
    "format_consistency",
    "requirement_scope_consistency",
    "architecture_level_consistency",
  ]) ?? structureContract;

  for (const section of contractSpec.section_contracts) {
    const heading = findSectionHeadingLine(content, section);
    if (!heading) {
      issues.push(buildIssue(
        structureContract,
        `Missing required section: ${formatSectionHeadingDisplay(section)}`,
      ));
      continue;
    }

    const sectionContent = extractSectionContent(content, heading.lineIndex, heading.level);
    collectExpectedFormatIssues(sectionContent, section, formatContract, issues);
  }

  if (PLACEHOLDER_PATTERN.test(content)) {
    issues.push(buildIssue(
      formatContract,
      "Document still contains unresolved template placeholders.",
    ));
  }

  return deduplicateIssues(issues);
}

function collectExpectedFormatIssues(
  sectionContent: string,
  section: SectionContract,
  contract: DocumentContract | undefined,
  issues: ContractIssue[],
): void {
  const expectedFormat = section.expected_format?.trim();
  if (!expectedFormat) {
    return;
  }

  const codeBlockLanguages = [...expectedFormat.matchAll(/```([a-zA-Z0-9_-]+)/g)].map((match) => match[1].toLowerCase());
  for (const language of codeBlockLanguages) {
    if (!sectionContainsCodeBlock(sectionContent, language)) {
      issues.push(buildIssue(
        contract,
        `${formatSectionHeadingDisplay(section)} should include a ${language} code block.`,
      ));
    }
  }

  if (/No prose outside code blocks\./i.test(expectedFormat) && hasNonCodeProse(sectionContent)) {
    issues.push(buildIssue(
      contract,
      `${formatSectionHeadingDisplay(section)} should not contain prose outside code blocks.`,
    ));
  }

  if (hasOrderedListRequirement(expectedFormat) && !sectionHasOrderedList(sectionContent)) {
    issues.push(buildIssue(
      contract,
      `${formatSectionHeadingDisplay(section)} should contain an ordered list.`,
    ));
  }

  if (hasUnorderedListRequirement(expectedFormat) && !sectionHasUnorderedList(sectionContent)) {
    issues.push(buildIssue(
      contract,
      `${formatSectionHeadingDisplay(section)} should contain a bullet list.`,
    ));
  }
}

function findSectionHeadingLine(
  content: string,
  section: SectionContract,
): { lineIndex: number; level: number } | null {
  const lines = content.split("\n");
  const bodyPattern = buildHeadingBodyPattern(section);

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(HEADING_PATTERN);
    if (!match) {
      continue;
    }

    if (bodyPattern.test(match[2].trim())) {
      return { lineIndex: index, level: match[1].length };
    }
  }

  return null;
}

function extractSectionContent(content: string, headingLineIndex: number, headingLevel: number): string {
  const lines = content.split("\n");
  const sectionLines: string[] = [];

  for (let index = headingLineIndex + 1; index < lines.length; index += 1) {
    const match = lines[index].match(HEADING_PATTERN);
    if (match && match[1].length <= headingLevel) {
      break;
    }
    sectionLines.push(lines[index]);
  }

  return sectionLines.join("\n");
}

function buildHeadingBodyPattern(section: SectionContract): RegExp {
  const escapedSectionId = escapeRegExp(section.section_id);
  if (PLACEHOLDER_PATTERN.test(section.title)) {
    return new RegExp(`^${escapedSectionId}(?:\\.)?\\s+.+$`);
  }

  return new RegExp(`^${escapedSectionId}(?:\\.)?\\s+${escapeRegExp(section.title)}$`);
}

function formatSectionHeadingDisplay(section: SectionContract): string {
  const title = PLACEHOLDER_PATTERN.test(section.title) ? "<title>" : section.title;
  return `section ${section.section_id}. ${title}`;
}

function sectionContainsCodeBlock(sectionContent: string, language: string): boolean {
  const pattern = new RegExp("```" + escapeRegExp(language) + "(?:\\s|\\r|\\n)", "i");
  return pattern.test(sectionContent);
}

function hasOrderedListRequirement(expectedFormat: string): boolean {
  return /^\s*1\.\s+/m.test(stripCodeBlocks(expectedFormat));
}

function hasUnorderedListRequirement(expectedFormat: string): boolean {
  return /^\s*-\s+/m.test(stripCodeBlocks(expectedFormat));
}

function sectionHasOrderedList(sectionContent: string): boolean {
  return /^\s*\d+\.\s+/m.test(stripCodeBlocks(sectionContent));
}

function sectionHasUnorderedList(sectionContent: string): boolean {
  return /^\s*-\s+/m.test(stripCodeBlocks(sectionContent));
}

function hasNonCodeProse(sectionContent: string): boolean {
  const lines = sectionContent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (!inCodeBlock) {
      return true;
    }
  }

  return false;
}

function stripCodeBlocks(text: string): string {
  return text.replace(/```[\s\S]*?```/g, "");
}

function buildIssue(contract: DocumentContract | undefined, message: string): ContractIssue {
  return {
    checkItem: contract?.check_item ?? "document_contract_static_check",
    message,
    severity: contract?.severity ?? "high",
  };
}

function findDocumentContractByPriority(
  contractSpec: ContractSpec,
  priorities: string[],
): DocumentContract | undefined {
  for (const checkItem of priorities) {
    const matched = contractSpec.document_contracts.find((entry) => entry.check_item === checkItem);
    if (matched) {
      return matched;
    }
  }

  return undefined;
}

function deduplicateIssues(issues: ContractIssue[]): ContractIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.checkItem}:${issue.message}:${issue.severity}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
