import { randomUUID } from "node:crypto";

import type { ApplicationConfig } from "../../Runtime/application.js";
import type { RuntimeContext } from "../../Runtime/Schema/runtime.js";
import { loadWorkspaceRuntimeOptions } from "./workspace-local-env.js";
import type { ParsedCommand } from "./cli-types.js";

export type RuntimeContextBuilder = (parsed: ParsedCommand) => Promise<RuntimeContext>;

export async function buildRuntimeContext(parsed: ParsedCommand): Promise<RuntimeContext> {
  const workspaceRoot = readSingleRequiredOption(parsed.options, "workdir", "workspace");
  const explicitRunId = readOptionalSingleOption(parsed.options, "run-id", "runid");

  return {
    workspaceRoot,
    runId: explicitRunId ?? randomUUID(),
  };
}

export async function loadApplicationConfigFromCommand(parsed: ParsedCommand): Promise<ApplicationConfig> {
  const workspaceRoot = readOptionalSingleOption(parsed.options, "workdir", "workspace");
  const workspaceConfig = workspaceRoot ? await loadWorkspaceRuntimeOptions(workspaceRoot) : {};
  return {
    ...workspaceConfig,
    resourceResolver: {
      ...workspaceConfig.resourceResolver,
      ...(workspaceRoot ? { workdir: workspaceRoot } : {}),
    },
  };
}

function readSingleRequiredOption(options: ParsedCommand["options"], ...keys: string[]): string {
  const value = readOptionalSingleOption(options, ...keys);
  if (value) {
    return value;
  }

  throw new Error(`Missing required option: --${keys[0]}`);
}

function readOptionalSingleOption(options: ParsedCommand["options"], ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = options[key];
    if (typeof value === "undefined") {
      continue;
    }

    if (Array.isArray(value)) {
      return value[0];
    }

    return value;
  }

  return undefined;
}
