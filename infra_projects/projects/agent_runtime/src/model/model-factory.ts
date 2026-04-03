import { StreamingEventAdapter } from "./streaming-event-adapter.js";
import { MockModel } from "./mock-model.js";
import {
  DeepSeekModel,
  getFetchOverride,
  validateModeSelection,
} from "./deepseek-model.js";
import type { IModel, ModelConfig, ModelCreationInput, ModelTraceWriter } from "./types.js";

export class ModelFactory {
  constructor(
    private readonly trace?: ModelTraceWriter,
    private readonly resolveDefaultConfig?: () => Promise<ModelConfig>,
  ) {}

  createModel(input: ModelCreationInput): IModel {
    if (input.mock) {
      return new MockModel(input.mockInfo, new StreamingEventAdapter(), this.trace);
    }

    validateModeSelection(input.modeSelection);
    const fetchFn = getFetchOverride(input.mockInfo);
    return new DeepSeekModel(input.modeSelection, fetchFn, new StreamingEventAdapter(), this.trace);
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
    return new ModelFactory(this.trace, () => Promise.resolve(config));
  }

  withTrace(trace: ModelTraceWriter): ModelFactory {
    return new ModelFactory(trace, this.resolveDefaultConfig);
  }
}
