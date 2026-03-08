// Project layer public exports: re-export shared contracts and module entry classes.
// Public API: shared contracts consumed across modules.
export * from "./shared/contracts/pipeline.js";
export * from "./shared/types/common.js";

// Public API: module entry classes exposed to callers and composition roots.
export * from "./app/composition-root.js";
export * from "./contract/architecture-design-contract/architecture-design-contract.js";
export * from "./contract/implementation-contract/implementation-contract.js";
export * from "./contract/module-design-contract/module-design-contract.js";
export * from "./contract/requirement-contract/requirement-contract.js";
export * from "./data/artifact-store/artifact-store.js";
export * from "./execution/architecture-design-generator/architecture-design-generator.js";
export * from "./execution/implementation-generator/implementation-generator.js";
export * from "./execution/module-design-generator/module-design-generator.js";
export * from "./execution/requirement-generator/requirement-generator.js";
export * from "./interface/cli/cli.js";
export * from "./quality-gate/change-gate/change-gate.js";
export * from "./quality-gate/trace/trace-recorder.js";
export * from "./sdk/llm-executor/llm-executor.js";
export * from "./workflow/stage-runners/implementation-stage-runner.js";
export * from "./workflow/stage-runners/architecture-stage-runner.js";
export * from "./workflow/stage-runners/requirement-stage-runner.js";
export * from "./workflow/pipeline/pipeline.js";
