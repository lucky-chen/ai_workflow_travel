import type { AgentSelectionInput } from "../types.js";
import type { ModelFactory } from "../../model/model-factory.js";
import type { ModuleRequest, ModuleResponse } from "../../model/types.js";
import { ensureSuccessfulModelResponse, tryParseJsonRecord } from "../agent_parsing.js";
import type { IntentRoutingLlm, IntentRoutingResult } from "./shared.js";
import presets from "./intent_router_presets.json" with { type: "json" };

export interface LlmIntentRouterOptions {
  modelFactory: ModelFactory;
}

export class LlmIntentRouter implements IntentRoutingLlm {
  constructor(private readonly options: LlmIntentRouterOptions) {}

  async resolve(input: AgentSelectionInput): Promise<IntentRoutingResult> {
    const model = await this.options.modelFactory.createDefaultModel();
    const request = buildIntentClassificationRequest(input);
    const response = await model.execute(request);
    ensureSuccessfulModelResponse(response);
    return parseIntentRoutingResult(response);
  }
}

function buildIntentClassificationRequest(input: AgentSelectionInput): ModuleRequest {
  return {
    systemPrompt: [
      "You classify runtime intent into one concrete type.",
      "Return valid JSON only.",
      "Allowed types: chat, react, peo.",
      "Use chat when internal knowledge is enough and no multi-step operation is needed.",
      "Use react when external query or a simple tool call is needed.",
      "Use peo when multi-step planning, retries, or step dependencies are needed.",
      "Return exactly: {\"type\":\"chat|react|peo\",\"reasonCode\":\"string\"}.",
    ],
    responseFormat: "json",
    userPrompt: {
      stage: "intent_router_llm",
      presetSchemas: presets.schemas,
      userInput: input.userInput,
    },
    stream: false,
  };
}

function parseIntentRoutingResult(response: ModuleResponse): IntentRoutingResult {
  const parsed = tryParseJsonRecord(response.content);
  const type = parsed?.type;
  const reasonCode = typeof parsed?.reasonCode === "string" && parsed.reasonCode.trim()
    ? parsed.reasonCode
    : "llm_classification";
  if (type === "chat" || type === "react" || type === "peo") {
    return {
      type,
      reasonCode,
    };
  }
  return {
    type: "chat",
    reasonCode: "llm_fallback_chat",
  };
}
