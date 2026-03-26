export function parseJsonLikeContent(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const fencedJson = tryParseFencedJson(content);
    if (fencedJson !== undefined) {
      return fencedJson;
    }

    const embeddedJson = tryParseEmbeddedObject(content);
    if (embeddedJson !== undefined) {
      return embeddedJson;
    }
  }

  throw new Error("Content did not contain valid JSON.");
}

export function extractJsonLikeContent(content: string): string | undefined {
  try {
    JSON.parse(content);
    return content;
  } catch {}

  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    try {
      JSON.parse(fencedMatch[1]);
      return fencedMatch[1];
    } catch {}
  }

  const objectStart = content.indexOf("{");
  const objectEnd = content.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    const candidate = content.slice(objectStart, objectEnd + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {}
  }

  return undefined;
}

function tryParseFencedJson(content: string): unknown | undefined {
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (!fencedMatch?.[1]) {
    return undefined;
  }

  return JSON.parse(fencedMatch[1]);
}

function tryParseEmbeddedObject(content: string): unknown | undefined {
  const objectStart = content.indexOf("{");
  const objectEnd = content.lastIndexOf("}");
  if (objectStart < 0 || objectEnd <= objectStart) {
    return undefined;
  }

  return JSON.parse(content.slice(objectStart, objectEnd + 1));
}
