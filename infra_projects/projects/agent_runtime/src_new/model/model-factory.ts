import { StreamingEventAdapter } from "./streaming-event-adapter.js";
import { MockModel } from "./mock-model.js";
import {
  getFetchOverride,
  RealProviderModel,
  validateModeSelection,
} from "./real-provider-model.js";
import type { IModel, ModelCreationInput } from "./types.js";

export class ModelFactory {
  createModel(input: ModelCreationInput): IModel {
    if (input.mock) {
      return new MockModel(input.mockInfo, new StreamingEventAdapter());
    }

    validateModeSelection(input.modeSelection);
    const fetchFn = getFetchOverride(input.mockInfo);
    return new RealProviderModel(input.modeSelection, fetchFn, new StreamingEventAdapter());
  }
}
