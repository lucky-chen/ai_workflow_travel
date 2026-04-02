import type { RuntimeEventBus } from "../capability/runtime-event-bus.js";
import { StreamingEventAdapter } from "./streaming-event-adapter.js";
import { MockModel } from "./mock-model.js";
import {
  DeepSeekModel,
  getFetchOverride,
  validateModeSelection,
} from "./deepseek-model.js";
import type { IModel, ModelConfig, ModelCreationInput } from "./types.js";

export class ModelFactory {
  constructor(
    private readonly eventBus?: RuntimeEventBus,
    private readonly resolveDefaultConfig?: () => Promise<ModelConfig>,
  ) {}

  createModel(input: ModelCreationInput): IModel {
    if (input.mock) {
      return new MockModel(input.mockInfo, new StreamingEventAdapter(), this.eventBus);
    }

    validateModeSelection(input.modeSelection);
    const fetchFn = getFetchOverride(input.mockInfo);
    return new DeepSeekModel(input.modeSelection, fetchFn, new StreamingEventAdapter(), this.eventBus);
  }

  async createDefaultModel(): Promise<IModel> {
    if (!this.resolveDefaultConfig) {
      throw new Error("Default model config resolver is not configured.");
    }
    const config = await this.resolveDefaultConfig();
    return this.createModel({
      mock: config.mock,
      modeSelection: config.modeSelection ?? {},
      mockInfo: config.mockInfo,
    });
  }

  withDefaultConfig(config: ModelConfig): ModelFactory {
    return new ModelFactory(this.eventBus, async () => config);
  }
}
