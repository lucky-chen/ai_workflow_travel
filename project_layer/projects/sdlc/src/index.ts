// Project layer public exports: re-export shared contracts and module entry classes.
// Public API: shared contracts consumed across modules.
export * from "./shared/contracts/pipeline.js";
export * from "./shared/types/common.js";

// Public API: module entry classes exposed to callers and composition roots.
export * from "./app/composition-root.js";
export * from "./contract/architecture-design-contract.js";
export * from "./contract/implementation-contract.js";
export * from "./contract/implementation-plan-contract.js";
export * from "./contract/module-design-contract.js";
export * from "./contract/requirement-contract.js";
export * from "./data/artifact-store.js";
export * from "./execution/architecture-design-generator.js";
export * from "./execution/implementation-generator/implementation-generator.js";
export * from "./execution/implementation-plan-generator.js";
export * from "./execution/module-design-generator.js";
export * from "./execution/requirement-generator.js";
export * from "./interface/cli.js";
export * from "./quality-gate/change-gate.js";
export * from "./quality-gate/trace-recorder.js";
export * from "./sdk/llm-executor/llm-executor.js";
export * from "./workflow/stage-runners/implementation-stage-runner.js";
export * from "./workflow/stage-runners/implementation-plan-stage-runner.js";
export * from "./workflow/stage-runners/architecture-stage-runner.js";
export * from "./workflow/stage-runners/module-stage-runner.js";
export * from "./workflow/stage-runners/requirement-stage-runner.js";
export * from "./workflow/stage-runners/validation-stage-runner.js";
export * from "./workflow/pipeline/pipeline.js";
export * from "./workflow/shell-runner.js";
