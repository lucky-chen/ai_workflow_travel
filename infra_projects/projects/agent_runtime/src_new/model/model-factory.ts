import { StreamingEventAdapter } from "./streaming-event-adapter.js";
import { MockModel } from "./mock-model.js";
import {
  DeepSeekModel,
  getFetchOverride,
  validateModeSelection,
} from "./deepseek-model.js";
import type { IModel, ModelCreationInput } from "./types.js";

export class ModelFactory {
  createModel(input: ModelCreationInput): IModel {
    if (input.mock) {
      return new MockModel(input.mockInfo, new StreamingEventAdapter());
    }

    validateModeSelection(input.modeSelection);
    const fetchFn = getFetchOverride(input.mockInfo);
    return new DeepSeekModel(input.modeSelection, fetchFn, new StreamingEventAdapter());
  }
}
