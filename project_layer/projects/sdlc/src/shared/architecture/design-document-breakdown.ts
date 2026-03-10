import path from "node:path";

export interface DesignDocumentDescriptor {
  name: string;
  documentPath: string;
  description: string;
  responsibilities: string[];
}

export function parseDesignDocumentBreakdown(content: string): DesignDocumentDescriptor[] {
  const section = extractSection(content, [
    "## 7.2 Design Document Breakdown",
    "### 7.2 Design Document Breakdown",
  ]);
  if (!section) {
    return [];
  }

  return section
    .split("\n")
    .map((line) => line.trim())
    .map(parseDesignDocumentLine)
    .filter((entry): entry is DesignDocumentDescriptor => entry !== null);
}

function parseDesignDocumentLine(line: string): DesignDocumentDescriptor | null {
  const match = line.match(/^- `([^`]+)`:\s*(.+)$/);
  if (!match) {
    return null;
  }

  const documentPath = normalizeDocumentPath(match[1]);
  const description = match[2].trim();
  if (documentPath.length === 0 || description.length === 0) {
    return null;
  }

  return {
    name: inferDocumentName(documentPath, description),
    documentPath,
    description,
    responsibilities: [description],
  };
}

function inferDocumentName(documentPath: string, description: string): string {
  const backtickedTerms = [...description.matchAll(/`([^`]+)`/g)].map((match) => match[1].trim());
  const meaningfulTerms = backtickedTerms.filter((term) => !term.includes("/") && !term.endsWith(".md"));
  if (meaningfulTerms.length > 0) {
    return meaningfulTerms[0];
  }

  const baseName = path.posix.basename(documentPath, path.posix.extname(documentPath));
  return baseName
    .split(/[-_]/g)
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function extractSection(content: string, headings: string[]): string {
  for (const heading of headings) {
    const startIndex = content.indexOf(heading);
    if (startIndex < 0) {
      continue;
    }

    const rest = content.slice(startIndex + heading.length);
    const nextHeadingOffset = rest.search(/\n## |\n# /);
    if (nextHeadingOffset < 0) {
      return rest;
    }

    return rest.slice(0, nextHeadingOffset);
  }

  return "";
}

function normalizeDocumentPath(filePath: string): string {
  return filePath.split(path.sep).join("/").trim();
}
