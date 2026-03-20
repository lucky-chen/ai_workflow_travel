import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

export const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(workspaceRoot, "..", "..");
const sdlcProjectRoot = path.join(projectRoot, "project_layer", "projects", "sdlc");
const cliEntry = path.join(sdlcProjectRoot, "bin", "sdlc.js");
const DEFAULT_ITEM_NAME = "EchoService";
const DEFAULT_REAL_LLM_CLI_TIMEOUT_MS = 300000;
const DEFAULT_REAL_LLM_PROVIDER_TIMEOUT_MS = 240000;

export async function createWorkspaceCopy() {
  const copiedWorkspaceRoot = await mkdtemp(path.join(os.tmpdir(), "hello-service-sdlc-"));
  await cp(workspaceRoot, copiedWorkspaceRoot, {
    recursive: true,
    filter(sourcePath) {
      const relativePath = path.relative(workspaceRoot, sourcePath);
      if (!relativePath) {
        return true;
      }

      const topLevelName = relativePath.split(path.sep)[0];
      return !["node_modules", "dist", ".artifact-store", "reports"].includes(topLevelName);
    },
  });
  await normalizeLocalEnvForCurrentCli(copiedWorkspaceRoot);
  return copiedWorkspaceRoot;
}

export async function removeWorkspace(targetWorkspaceRoot) {
  await rm(targetWorkspaceRoot, { recursive: true, force: true });
}

export async function resetWorkspace(targetWorkspaceRoot) {
  await rm(path.join(targetWorkspaceRoot, "dist"), { recursive: true, force: true });
  await rm(path.join(targetWorkspaceRoot, "src"), { recursive: true, force: true });
  await rm(path.join(targetWorkspaceRoot, "sdlc", "docs", "item_design"), { recursive: true, force: true });
  await rm(path.join(targetWorkspaceRoot, "sdlc", "docs", "architecture_design_breakdown.json"), { force: true });
  await rm(path.join(targetWorkspaceRoot, "sdlc", "docs", "work_plan.yaml"), { force: true });
}

export async function runCli(targetWorkspaceRoot, args, options = {}) {
  const result = await executeCli(targetWorkspaceRoot, args, options);
  assert.equal(result.exitCode, 0, `CLI failed.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}

export async function runCliExpectFailure(targetWorkspaceRoot, args, options = {}) {
  const result = await executeCli(targetWorkspaceRoot, args, options);
  assert.notEqual(result.exitCode, 0, `CLI unexpectedly succeeded.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  return result;
}

async function executeCli(targetWorkspaceRoot, args, options = {}) {
  const {
    taskId = "hello-service-task",
    runId,
    extraEnv = {},
    runtimeMode = "mock",
    timeoutMs = runtimeMode === "real" ? DEFAULT_REAL_LLM_CLI_TIMEOUT_MS : undefined,
  } = options;
  if (runtimeMode === "real") {
    await prepareRealLlmWorkspace(targetWorkspaceRoot);
  }
  const commandArgs = [...args, "--workdir", targetWorkspaceRoot];
  if (runId) {
    commandArgs.push("--run-id", runId);
  }

  const scenarioEnv = runtimeMode === "mock"
    ? {
        SDLC_TEST_SCENARIO: "fixed_workspace_baseline",
        SDLC_TEST_SERVICE_NAME: "hello-service",
      }
    : {};

  const child = spawn(process.execPath, [cliEntry, ...commandArgs], {
    cwd: sdlcProjectRoot,
    env: {
      ...process.env,
      ...scenarioEnv,
      SDLC_TEST_TASK_ID: taskId,
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  let timeoutId;
  let killId;
  let timedOut = false;
  child.stdout.on("data", (chunk) => {
    stdout += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  if (typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      killId = setTimeout(() => {
        child.kill("SIGKILL");
      }, 5000);
    }, timeoutMs);
  }

  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
  if (killId) {
    clearTimeout(killId);
  }

  return {
    exitCode,
    stdout,
    stderr: timedOut
      ? `${stderr}\nCLI timed out after ${timeoutMs}ms.`
      : stderr,
  };
}

export function getTraceFilePath(targetWorkspaceRoot, runId) {
  return path.join(targetWorkspaceRoot, "dist", "sdlc", runId, "trace.json");
}

export async function loadTraceRecords(targetWorkspaceRoot, runId) {
  return JSON.parse(await readFile(getTraceFilePath(targetWorkspaceRoot, runId), "utf8"));
}

export function findTraceRecordsByEventType(records, eventType) {
  return records.filter((entry) => entry.payload?.eventType === eventType);
}

export function findTraceRecordsByExecutionUnit(records, executionUnitId) {
  return records.filter((entry) => entry.scope?.executionUnitId === executionUnitId);
}

export function findTraceRecordsByCategory(records, category) {
  return records.filter((entry) => entry.category === category);
}

export function assertUnitLlmTrace(records, { executionUnitId, runtimeMode }) {
  assert.equal(
    findTraceRecordsByExecutionUnit(records, executionUnitId).some(
      (entry) =>
        entry.payload?.eventType === "llm_execution_started"
        && entry.payload?.metadata?.mode === runtimeMode,
    ),
    true,
  );
  assert.equal(
    findTraceRecordsByExecutionUnit(records, executionUnitId).some(
      (entry) => entry.payload?.eventType === "llm_execution_finished",
    ),
    true,
  );
}

export async function readJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function createItemDescriptor(targetWorkspaceRoot) {
  const breakdownEntry = await getPrimaryBreakdownEntry(targetWorkspaceRoot);
  const descriptorDirectory = path.join(targetWorkspaceRoot, "tmp");
  await mkdir(descriptorDirectory, { recursive: true });
  const descriptorPath = path.join(descriptorDirectory, `${breakdownEntry.targetName}.json`);
  await writeFile(
    descriptorPath,
    JSON.stringify({
      name: breakdownEntry.targetName,
      responsibilities: breakdownEntry.responsibilities,
      documentPath: breakdownEntry.documentPath,
      description: breakdownEntry.description,
    }, null, 2),
    "utf8",
  );
  return path.relative(targetWorkspaceRoot, descriptorPath);
}

export async function createPreparedStepContext(targetWorkspaceRoot) {
  const breakdownEntry = await getPrimaryBreakdownEntry(targetWorkspaceRoot);
  const requirementDocument = await readFile(path.join(targetWorkspaceRoot, "sdlc", "docs", "Requirement.md"), "utf8");
  const architectureDocument = await readFile(path.join(targetWorkspaceRoot, "sdlc", "docs", "TechnicalArchitecture.md"), "utf8");
  const itemDesignDocument = await readFile(path.join(targetWorkspaceRoot, breakdownEntry.documentPath), "utf8");

  const contextDirectory = path.join(targetWorkspaceRoot, "tmp");
  await mkdir(contextDirectory, { recursive: true });
  const preparedStepContextPath = path.join(contextDirectory, "prepared-step-context.json");
  await writeFile(
    preparedStepContextPath,
    JSON.stringify({
      workplanRef: "sdlc/docs/work_plan.yaml#step-1.batch-1",
      workplan: {
        steps: [
          {
            stepId: "step-1",
            title: `${breakdownEntry.targetName} baseline`,
            status: "not_started",
            architectureModulesInScope: [breakdownEntry.targetName],
            batches: [
              {
                batchId: "batch-1",
                title: "Create source file",
                status: "not_started",
                tasks: ["add src/index.ts with hello export"],
              },
            ],
          },
        ],
      },
      currentBatch: {
        batchId: "batch-1",
        title: "Create source file",
        status: "not_started",
        tasks: ["add src/index.ts with hello export"],
      },
      upstreamContext: {
        requirementDocument,
        architectureDocument,
        itemDesignDocuments: [
          {
            itemName: breakdownEntry.targetName,
            content: itemDesignDocument,
          },
        ],
      },
    }, null, 2),
    "utf8",
  );
  return path.relative(targetWorkspaceRoot, preparedStepContextPath);
}

export async function writeRequirementContractSuccessFixture(targetWorkspaceRoot) {
  await writeMarkdownFixtureFromContractSpec(
    targetWorkspaceRoot,
    "RequirementTemplate.contract.json",
    path.join("sdlc", "docs", "Requirement.md"),
  );
}

export async function writeArchitectureContractSuccessFixture(targetWorkspaceRoot) {
  await writeMarkdownFixtureFromContractSpec(
    targetWorkspaceRoot,
    "TechnicalArchitectureTemplate.contract.json",
    path.join("sdlc", "docs", "TechnicalArchitecture.md"),
  );
}

export async function writeArchitectureBreakdownFixture(targetWorkspaceRoot) {
  const breakdownPath = path.join(targetWorkspaceRoot, "sdlc", "docs", "architecture_design_breakdown.json");
  await mkdir(path.dirname(breakdownPath), { recursive: true });
  await writeFile(
    breakdownPath,
    JSON.stringify([
      {
        name: DEFAULT_ITEM_NAME,
        targetName: DEFAULT_ITEM_NAME,
        targetType: "item_design",
        documentPath: `sdlc/docs/item_design/${DEFAULT_ITEM_NAME}.md`,
        description: `Design document for ${DEFAULT_ITEM_NAME}.`,
        responsibilities: [`Design document for ${DEFAULT_ITEM_NAME}.`],
      },
    ], null, 2),
    "utf8",
  );
}

export async function writeItemDesignContractSuccessFixture(targetWorkspaceRoot) {
  const breakdownEntry = await getPrimaryBreakdownEntry(targetWorkspaceRoot);
  await writeMarkdownFixtureFromContractSpec(
    targetWorkspaceRoot,
    "ItemDesignTemplate.contract.json",
    breakdownEntry.documentPath,
    `# ${breakdownEntry.targetName} Design\n`,
  );
}

export async function getPrimaryBreakdownEntry(targetWorkspaceRoot) {
  const breakdownPath = path.join(targetWorkspaceRoot, "sdlc", "docs", "architecture_design_breakdown.json");
  const breakdown = await readJsonFile(breakdownPath);
  if (!Array.isArray(breakdown) || breakdown.length === 0 || typeof breakdown[0]?.documentPath !== "string") {
    throw new Error(`Missing usable design document entry in ${breakdownPath}`);
  }

  return breakdown[0];
}

export async function getPrimaryItemDesignDocumentPath(targetWorkspaceRoot) {
  return (await getPrimaryBreakdownEntry(targetWorkspaceRoot)).documentPath;
}

export async function prepareRealLlmWorkspace(targetWorkspaceRoot) {
  const localEnvPath = path.join(targetWorkspaceRoot, "sdlc", "local_env.json");
  const localEnv = JSON.parse(await readFile(localEnvPath, "utf8"));
  if (!localEnv.llm || typeof localEnv.llm !== "object") {
    return;
  }

  if (localEnv.llm.provider === "deepseek" && localEnv.llm.model === "deepseek-reasoner") {
    localEnv.llm.model = "deepseek-chat";
  }

  const timeoutMs = Number(localEnv.llm.timeout_ms);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > DEFAULT_REAL_LLM_PROVIDER_TIMEOUT_MS) {
    localEnv.llm.timeout_ms = DEFAULT_REAL_LLM_PROVIDER_TIMEOUT_MS;
  }

  await writeFile(localEnvPath, `${JSON.stringify(localEnv, null, 2)}\n`, "utf8");
}

async function writeMarkdownFixtureFromContractSpec(targetWorkspaceRoot, contractFileName, relativePath, title = "") {
  const contractSpecPath = path.join(projectRoot, "meta_layer", "resources", "contract", contractFileName);
  const contractSpec = JSON.parse(await readFile(contractSpecPath, "utf8"));
  const renderedDocument = renderMarkdownDocumentFromContractSpec(contractSpec, title);
  const absolutePath = path.join(targetWorkspaceRoot, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, renderedDocument, "utf8");
}

function renderMarkdownDocumentFromContractSpec(contractSpec, title = "") {
  const sections = contractSpec.section_contracts.map((section) => {
    const headingLevel = Math.min(section.section_id.split(".").length, 6);
    const heading = `${"#".repeat(headingLevel)} ${section.section_id}. ${replacePlaceholders(section.title)}`;
    const body = renderSectionBody(section.expected_format);
    return `${heading}\n\n${body}`.trim();
  });

  return `${title}${sections.join("\n\n")}\n`;
}

function renderSectionBody(expectedFormat) {
  if (typeof expectedFormat !== "string" || expectedFormat.trim().length === 0) {
    return "- Sample bullet";
  }

  return replacePlaceholders(expectedFormat).replace(/\nNo prose outside code blocks\.\s*$/i, "");
}

function replacePlaceholders(text) {
  return text.replace(/\{([^}]+)\}/g, (_match, key) => resolvePlaceholderValue(key));
}

function resolvePlaceholderValue(key) {
  const directOverrides = {
    ArchitectureStyle: "modular monolith",
    CollaboratorA: "RequirementDesign",
    CollaboratorB: "WorkPlan",
    ItemName: DEFAULT_ITEM_NAME,
    ItemPath: DEFAULT_ITEM_NAME,
    METHOD: "POST",
    PATH: "/hello",
    SystemName: "hello-service",
  };
  if (key in directOverrides) {
    return directOverrides[key];
  }

  if (/Type$/.test(key)) {
    return toPascalCase(key);
  }

  if (/Field/.test(key)) {
    return toCamelCase(key);
  }

  if (/Path$/.test(key)) {
    return `/${toKebabCase(key)}`;
  }

  if (/Description|Summary|Goal|Purpose|Role|Responsibility|Problem|Ability|Constraint|Reason|Support|Matters|Boundary/i.test(key)) {
    return `sample ${toWords(key)}`;
  }

  return `Sample${toPascalCase(key)}`;
}

function toPascalCase(value) {
  return value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function toCamelCase(value) {
  const pascal = toPascalCase(value);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function toKebabCase(value) {
  return value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.toLowerCase())
    .join("-");
}

function toWords(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

async function normalizeLocalEnvForCurrentCli(targetWorkspaceRoot) {
  const localEnvPath = path.join(targetWorkspaceRoot, "sdlc", "local_env.json");
  const localEnv = JSON.parse(await readFile(localEnvPath, "utf8"));
  if (localEnv.resources?.root_dir) {
    return;
  }

  const templateDir = localEnv.resources?.template_dir;
  const contractDir = localEnv.resources?.contract_dir;
  const rootDirCandidate = templateDir
    ? path.dirname(templateDir)
    : contractDir
      ? path.dirname(contractDir)
      : null;

  localEnv.resources = rootDirCandidate
    ? { root_dir: rootDirCandidate }
    : { root_dir: "../../meta_layer/resources" };
  await writeFile(localEnvPath, `${JSON.stringify(localEnv, null, 2)}\n`, "utf8");
}
