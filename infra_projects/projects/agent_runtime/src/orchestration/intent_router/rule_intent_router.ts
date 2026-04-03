import type { AgentSelectionInput } from "../types.js";
import type { IntentRoutingResult, IntentRoutingRule } from "./shared.js";
import presets from "./intent_router_presets.json" with { type: "json" };

export class RuleIntentRouter implements IntentRoutingRule {
  resolve(input: AgentSelectionInput): Promise<IntentRoutingResult | undefined> {
    const command = getSlashCommand(input.userInput.content);
    if (command) {
      return Promise.resolve(resolveSlashCommand(command));
    }
    return Promise.resolve(resolveFixedRule(input));
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
  const type = normalizeType(preset?.type);
  if (!preset || !type) {
    return undefined;
  }
  return {
    type,
    reasonCode: preset.reasonCode,
  };
}

function resolveFixedRule(input: AgentSelectionInput): IntentRoutingResult | undefined {
  const normalizedTask = getTaskText(input.userInput.content).toLowerCase();
  for (const rule of presets.fixedRules) {
    const type = normalizeType(rule.type);
    if (!type) {
      continue;
    }
    if (matchesMainKeywords(normalizedTask, rule.mainKeywords)) {
      return {
        type,
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

function normalizeType(type: unknown): IntentRoutingResult["type"] | undefined {
  return type === "chat" || type === "react" || type === "peo"
    ? type
    : undefined;
}
