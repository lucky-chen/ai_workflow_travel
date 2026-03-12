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
  const match = line.match(/^- (?:`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)):\s*(.+)$/);
  if (!match) {
    return null;
  }

  const rawDocumentPath = match[1] ?? match[3] ?? "";
  const documentPath = normalizeDocumentPath(rawDocumentPath);
  const description = match[4].trim();
  if (documentPath.length === 0 || description.length === 0) {
    return null;
  }

  return {
    name: inferDocumentName(documentPath),
    documentPath,
    description,
    responsibilities: [description],
  };
}

function inferDocumentName(documentPath: string): string {
  return path.posix.basename(documentPath, path.posix.extname(documentPath));
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
