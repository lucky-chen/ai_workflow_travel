import type { AgentSelectionInput } from "../types.js";
import type { IntentRoutingResult, IntentRoutingRule } from "./shared.js";
import presets from "./intent_router_presets.json" with { type: "json" };

export class RuleIntentRouter implements IntentRoutingRule {
  async resolve(input: AgentSelectionInput): Promise<IntentRoutingResult | undefined> {
    const command = getSlashCommand(input.userInput.content);
    if (command) {
      return resolveSlashCommand(command);
    }
    return resolveFixedRule(input);
  }
}

function getSlashCommand(content: Record<string, unknown>): string | undefined {
  if (typeof content.task === "string") {
    const trimmed = content.task.trim();
    const [firstToken] = trimmed.split(/\s+/, 1);
    return firstToken.startsWith("/") ? firstToken.toLowerCase() : undefined;
  }
  return undefined;
}

function resolveSlashCommand(command: string): IntentRoutingResult | undefined {
  const preset = presets.slashCommands[command as keyof typeof presets.slashCommands];
  const mode = normalizeMode(preset?.mode);
  if (!preset || !mode) {
    return undefined;
  }
  return {
    mode,
    reasonCode: preset.reasonCode,
  };
}

function resolveFixedRule(input: AgentSelectionInput): IntentRoutingResult | undefined {
  const normalizedTask = getTaskText(input.userInput.content).toLowerCase();
  for (const rule of presets.fixedRules) {
    const mode = normalizeMode(rule.mode);
    if (!mode) {
      continue;
    }
    if (matchesMainKeywords(normalizedTask, rule.mainKeywords)) {
      return {
        mode,
        reasonCode: rule.reasonCode,
      };
    }
  }
  return undefined;
}

function getTaskText(content: Record<string, unknown>): string {
  if (typeof content.task === "string") {
    return content.task.trim();
  }
  return JSON.stringify(content);
}

function matchesMainKeywords(normalizedTask: string, mainKeywords: readonly string[] | undefined): boolean {
  if (!mainKeywords || mainKeywords.length === 0) {
    return false;
  }
  return mainKeywords.some((keyword) => keyword.trim() && normalizedTask.includes(keyword.toLowerCase()));
}

function normalizeMode(mode: unknown): IntentRoutingResult["mode"] | undefined {
  return mode === "chat" || mode === "react" || mode === "peo"
    ? mode
    : undefined;
}
