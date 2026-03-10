import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const workspaceRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const sourcePath = path.join(workspaceRoot, "src", "index.ts");

async function main() {
  const sourceContent = await readFile(sourcePath, "utf8");

  if (process.env.SDLC_TEST_SCENARIO === "fixed_workspace_baseline") {
    assert.equal(sourceContent.includes("export function hello"), true, "Expected exported hello function.");
    assert.equal(sourceContent.includes("hello-service"), true, "Expected baseline hello-service output.");
    process.stdout.write("hello-service mock shell check passed.\n");
    return;
  }

  const scriptContent = sourceContent
    .replace(/^export\s+/m, "")
    .replace(/\)\s*:\s*[A-Za-z0-9_<>\[\]\s|]+\s*\{/g, ") {");
  const sandbox = {};
  vm.runInNewContext(`${scriptContent}\nthis.hello = hello;`, sandbox);
  assert.equal(typeof sandbox.hello, "function", "Expected hello export.");
  const result = sandbox.hello();
  assert.equal(typeof result, "string", "Expected hello() to return a string.");
  assert.equal(result.trim().length > 0, true, "Expected non-empty hello() result.");
  process.stdout.write(`hello-service real shell check passed: ${result}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
