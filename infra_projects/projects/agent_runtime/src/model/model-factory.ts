import type { RuntimeEventBus } from "../capability/runtime-event-bus.js";
import { StreamingEventAdapter } from "./streaming-event-adapter.js";
import { MockModel } from "./mock-model.js";
import {
  DeepSeekModel,
  getFetchOverride,
  validateModeSelection,
} from "./deepseek-model.js";
import type { IModel, ModelCreationInput } from "./types.js";

export class ModelFactory {
  constructor(private readonly eventBus?: RuntimeEventBus) {}

  createModel(input: ModelCreationInput): IModel {
    if (input.mock) {
      return new MockModel(input.mockInfo, new StreamingEventAdapter(), this.eventBus);
    }

    validateModeSelection(input.modeSelection);
    const fetchFn = getFetchOverride(input.mockInfo);
    return new DeepSeekModel(input.modeSelection, fetchFn, new StreamingEventAdapter(), this.eventBus);
  }
}
