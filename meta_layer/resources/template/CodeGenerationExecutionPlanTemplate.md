# Code Generation Execution Plan Template

## 1. Purpose

This document is the implementation plan for building `{target_project}` from zero to the complete workflow defined by:

- `{architecture_document_1}`
- `{architecture_document_2}`
- `{architecture_document_n}`

This plan is organized to match:

- the workflow runtime order
- the architecture module boundaries

## 1.1 Collaboration Rule

All implementation work under this plan must follow the shared collaboration standard:

- `{collaboration_standard_path}`

This plan keeps only delivery status and implementation scope. Collaboration behavior is defined in the shared standard document.

## 2. Workflow Delivery Order

The implementation should be delivered in this order:

1. `{workflow_phase_1}`
2. `{workflow_phase_2}`
3. `{workflow_phase_3}`
4. `{workflow_phase_n}`

## 3. Execution Steps

<!--
Runtime parsing shape:

```ts
interface ImplementationWorkPlan {
  steps: ImplementationWorkPlanStep[]
}

interface ImplementationWorkPlanStep {
  stepId: string
  title: string
  status: "not_started" | "in_progress" | "completed"
  architecture_modules_in_scope: string[]
  batches: ImplementationWorkPlanBatch[]
}

interface ImplementationWorkPlanBatch {
  batchId: string
  title: string
  status: "not_started" | "in_progress" | "completed"
  tasks: string[]
}
```

Markdown-to-structure mapping rule:

- `### Step {n}. Deliver {step_name}` defines one `ImplementationWorkPlanStep`
- `- [ ] Step {n} is not started` defines `ImplementationWorkPlanStep.status`
- `- [ ] Batch {n}: {batch_name}` defines one `ImplementationWorkPlanBatch`
- task bullet lines under one batch define `ImplementationWorkPlanBatch.tasks`
- one `implementation_execution` run targets one accepted batch, not one whole step
-->

### Step {n}. Deliver {step_name}

- [ ] Step {n} is not started
- [ ] Architecture modules in scope
  - [ ] `{module_1}`
  - [ ] `{module_2}`
  - [ ] `{module_n}`
- [ ] Batch 1: `{batch_1_name}`
  - [ ] `{batch_1_item_1}`
  - [ ] `{batch_1_item_2}`
  - [ ] `{batch_1_item_3}`
- [ ] Batch 2: `{batch_2_name}`
  - [ ] `{batch_2_item_1}`
  - [ ] `{batch_2_item_2}`
  - [ ] `{batch_2_item_3}`
- [ ] Batch n: `{batch_n_name}`
  - [ ] `{batch_n_item_1}`
  - [ ] `{batch_n_item_2}`
  - [ ] `{batch_n_item_3}`

### Step {n+1}. Deliver {next_step_name}

- [ ] Step {n+1} is not started
- [ ] Architecture modules in scope
  - [ ] `{module_1}`
  - [ ] `{module_2}`
  - [ ] `{module_n}`
- [ ] Batch 1: `{batch_1_name}`
  - [ ] `{batch_1_item_1}`
  - [ ] `{batch_1_item_2}`
  - [ ] `{batch_1_item_3}`
- [ ] Batch 2: `{batch_2_name}`
  - [ ] `{batch_2_item_1}`
  - [ ] `{batch_2_item_2}`
  - [ ] `{batch_2_item_3}`
- [ ] Batch n: `{batch_n_name}`
  - [ ] `{batch_n_item_1}`
  - [ ] `{batch_n_item_2}`
  - [ ] `{batch_n_item_3}`
