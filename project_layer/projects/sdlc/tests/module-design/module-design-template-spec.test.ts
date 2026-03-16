import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { parseModuleDesignTemplateSpec } from "../../src/shared/module-design-template-spec.js";

export async function runModuleDesignTemplateSpecTests(): Promise<void> {
  await testParseModuleDesignTemplateSpecExtractsContractsAndSkeleton();
}

async function testParseModuleDesignTemplateSpecExtractsContractsAndSkeleton(): Promise<void> {
  const templateContent = await readFile(
    path.resolve(
      process.cwd(),
      "..",
      "..",
      "..",
      "meta_layer",
      "resources",
      "template",
      "ModuleDesignTemplate.md",
    ),
    "utf8",
  );

  const spec = parseModuleDesignTemplateSpec(templateContent);

  assert.equal(spec.contractSpec.document_contracts.length > 0, true);
  assert.equal(spec.contractSpec.section_contracts.some((entry) => entry.section_id === "4.1.2"), true);
  assert.equal(spec.outputSkeleton.includes("# {DesignItemName} Design"), true);
  assert.equal(spec.outputSkeleton.includes("document_contracts"), false);
  assert.equal(spec.outputSkeleton.includes("\"section_contract\""), false);
  assert.equal(spec.outputSkeleton.includes("<!--"), false);
}
