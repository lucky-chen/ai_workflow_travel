import type { LaunchTaskRequest } from "../../shared/contracts/pipeline.js";
import { StageRegistry } from "./stage-registry.js";
export declare class LaunchValidator {
    validate(request: LaunchTaskRequest, registry: StageRegistry): void;
}
