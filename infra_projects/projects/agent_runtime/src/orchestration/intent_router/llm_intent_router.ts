import type { AgentSelectionInput } from "../types.js";
import type { ModelFactory } from "../../model/model-factory.js";
import type { ModuleRequest, ModuleResponse } from "../../model/types.js";
import type { RuntimeModelConfig } from "../../runtime/types.js";
import { ensureSuccessfulModelResponse, tryParseJsonRecord } from "../agent_orchestration_helpers.js";
import type { IntentRoutingLlm, IntentRoutingResult } from "./shared.js";
import presets from "./intent_router_presets.json" with { type: "json" };

export interface LlmIntentRouterOptions {
  modelFactory: ModelFactory;
  resolveModelConfig: () => Promise<RuntimeModelConfig>;
}

export class LlmIntentRouter implements IntentRoutingLlm {
  constructor(private readonly options: LlmIntentRouterOptions) {}

  async resolve(input: AgentSelectionInput): Promise<IntentRoutingResult> {
    const modelConfig = await this.options.resolveModelConfig();
    const model = this.options.modelFactory.createModel({
      mock: modelConfig.mock,
      modeSelection: modelConfig.modeSelection ?? {},
      mockInfo: modelConfig.mockInfo,
    });
    const request = buildIntentClassificationRequest(input);
    const response = await model.execute(request);
    ensureSuccessfulModelResponse(response);
    return parseIntentRoutingResult(response);
  }
}

function buildIntentClassificationRequest(input: AgentSelectionInput): ModuleRequest {
  return {
    systemPrompt: [
      "You classify runtime intent into one concrete mode.",
      "Return valid JSON only.",
      "Allowed modes: chat, react, peo.",
      "Use chat when internal knowledge is enough and no multi-step operation is needed.",
      "Use react when external query or a simple tool call is needed.",
      "Use peo when multi-step planning, retries, or step dependencies are needed.",
      "Return exactly: {\"mode\":\"chat|react|peo\",\"reasonCode\":\"string\"}.",
    ],
    responseFormat: "json",
    userPrompt: {
      stage: "intent_router_llm",
      presetSchemas: presets.schemas,
      sessionState: input.sessionState,
      userInput: input.userInput,
    },
    stream: false,
  };
}

function parseIntentRoutingResult(response: ModuleResponse): IntentRoutingResult {
  const parsed = tryParseJsonRecord(response.content);
  const mode = parsed?.mode;
  const reasonCode = typeof parsed?.reasonCode === "string" && parsed.reasonCode.trim()
    ? parsed.reasonCode
    : "llm_classification";
  if (mode === "chat" || mode === "react" || mode === "peo") {
    return {
      mode,
      reasonCode,
    };
  }
  return {
    mode: "chat",
    reasonCode: "llm_fallback_chat",
  };
}
