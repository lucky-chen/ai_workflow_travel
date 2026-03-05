<!--
{
  "document_contracts": [
    {
      "check_item": "document_structure_complete",
      "description": "The requirement document should contain the required top-level sections, subsection structure, and stage-oriented product requirement content.",
      "severity": "high"
    },
    {
      "check_item": "requirement_scope_consistency",
      "description": "The document should stay at product requirement level and remain consistent across user scenarios, workflow, scope, constraints, and success criteria.",
      "severity": "high"
    },
    {
      "check_item": "workflow_and_goal_alignment",
      "description": "Product goals, core problems, workflow, outputs, scope, and success criteria should remain logically aligned.",
      "severity": "high"
    }
  ]
}
-->

# 1. Background

<!--
{
  "section_contract": {
    "section_id": "1",
    "title": "Background",
    "checkitems": [
      "describe the business and product context that motivates the requirement",
      "keep the content at product problem and opportunity level",
      "avoid implementation detail"
    ],
    "severity": "medium",
    "expected_format": "- `{BackgroundPoint1}`\n- `{BackgroundPoint2}`\n- `{BackgroundPoint3}`"
  }
}
-->

- In most cases, it's hard to get runnable programs from an idea.
- If we could get programs developed by AI at low cost (time, staff),
- we could verify our ideas in a short time and maintain programs with AI as user requirements change.

# 2. User Scenarios

<!--
{
  "section_contract": {
    "section_id": "2",
    "title": "User Scenarios",
    "checkitems": [
      "identify the primary target users or user groups",
      "describe what each group wants to achieve with the product",
      "keep the focus on user goals and context rather than solution detail"
    ],
    "severity": "medium"
  }
}
-->

## 2.1 Technical Founders

<!--
{
  "section_contract": {
    "section_id": "2.1",
    "title": "Technical Founders",
    "checkitems": [
      "describe one concrete user group",
      "state the core outcome this user group expects"
    ],
    "severity": "medium",
    "expected_format": "`{UserScenarioDescription}`"
  }
}
-->

Validate product ideas quickly, write/update/confirm requirements/technical artifacts, and get the final program.

## 2.2 Indie Developers

<!--
{
  "section_contract": {
    "section_id": "2.2",
    "title": "Indie Developers",
    "checkitems": [
      "describe one concrete user group",
      "state the core outcome this user group expects"
    ],
    "severity": "medium",
    "expected_format": "`{UserScenarioDescription}`"
  }
}
-->

Develop and maintain an indie program, write/update/confirm requirements/technical artifacts, and get the final program.

## 2.3 Small Product Teams (3-5 persons)

<!--
{
  "section_contract": {
    "section_id": "2.3",
    "title": "Small Product Teams (3-5 persons)",
    "checkitems": [
      "describe one concrete user group",
      "include role-level responsibilities when the user group contains multiple roles"
    ],
    "severity": "medium",
    "expected_format": "`{UserScenarioDescription}`\n\n- `{RoleA}`\n  - `{ResponsibilityA1}`\n  - `{ResponsibilityA2}`\n- `{RoleB}`\n  - `{ResponsibilityB1}`\n  - `{ResponsibilityB2}`"
  }
}
-->

Develop and maintain a small program.

- product managers (PM)
    - write or update requirement docs
    - review generated outputs from a product perspective
    - confirm whether generated results align with intended product goals
- engineers:
    - review important generated technical artifacts and code changes
    - edit or update important technical artifacts if they are not suitable, implementable, or maintainable
    - decide whether the changes can be accepted into the project
    - make sure the final generated program can run and pass all test cases

# 3. Product Goals

<!--
{
  "section_contract": {
    "section_id": "3",
    "title": "Product Goals",
    "checkitems": [
      "state the product mission or target outcome in one concise sentence",
      "list the key product goals that guide scope and tradeoffs",
      "keep the goals outcome-oriented"
    ],
    "severity": "high",
    "expected_format": "`{ProductMission}`\n- `{Goal1}`\n- `{Goal2}`\n- `{Goal3}`"
  }
}
-->

An AI-RD-PLATFORM that turns requirements into artifacts, supporting users to continuously maintain outputs when requirements change.
- reduce cost of turning requirements into product outputs
- support iterative updates after requirement changes
- provide reviewable and maintainable outputs

# 4. Core Problems and Product Abilities

<!--
{
  "section_contract": {
    "section_id": "4",
    "title": "Core Problems and Product Abilities",
    "checkitems": [
      "pair each important user or product problem with the corresponding product ability",
      "make the ability a direct answer to the stated problem",
      "keep each subsection focused on one problem-solution pair"
    ],
    "severity": "high"
  }
}
-->

## 4.1 Requirements are not directly actionable

<!--
{
  "section_contract": {
    "section_id": "4.1",
    "title": "Requirements are not directly actionable",
    "checkitems": [
      "state one core problem clearly",
      "describe the product ability that addresses that problem"
    ],
    "severity": "medium",
    "expected_format": "- problem: `{ProblemStatement}`\n- ability: `{ProductAbility}`"
  }
}
-->

- problem: Users write requirements in natural language, which is often ambiguous and cannot be directly used by downstream stages.
- ability: The AI-RD-PLATFORM structures raw requirements into a clearer and more actionable form so they can be used by downstream stages as stable input.

## 4.2 The path from requirement to outputs is disconnected

<!--
{
  "section_contract": {
    "section_id": "4.2",
    "title": "The path from requirement to outputs is disconnected",
    "checkitems": [
      "state one core problem clearly",
      "describe the product ability that addresses that problem"
    ],
    "severity": "medium",
    "expected_format": "- problem: `{ProblemStatement}`\n- ability: `{ProductAbility}`"
  }
}
-->

- problem: Users often need to bridge multiple stages, such as clarification, design, coding, review, test, and update, which is costly and inefficient.
- ability: The AI-RD-PLATFORM provides an end-to-end generation flow that turns requirements into key project artifacts in a more continuous workflow.

## 4.3 Requirement changes are frequent and costly

<!--
{
  "section_contract": {
    "section_id": "4.3",
    "title": "Requirement changes are frequent and costly",
    "checkitems": [
      "state one core problem clearly",
      "describe the product ability that addresses that problem"
    ],
    "severity": "medium",
    "expected_format": "- problem: `{ProblemStatement}`\n- ability: `{ProductAbility}`"
  }
}
-->

- problem: Usually requirements change frequently. Users need to manually update multiple artifacts, which is slow and error-prone.
- ability: The AI-RD-PLATFORM supports incremental updates of important existing artifacts based on requirement changes, instead of recreating everything from scratch.

## 4.4 AI outputs are hard to trust

<!--
{
  "section_contract": {
    "section_id": "4.4",
    "title": "AI outputs are hard to trust",
    "checkitems": [
      "state one core problem clearly",
      "describe the product ability that addresses that problem"
    ],
    "severity": "medium",
    "expected_format": "- problem: `{ProblemStatement}`\n- ability: `{ProductAbility}`"
  }
}
-->

- problem: Sometimes AI hallucinates. Sometimes users cannot clearly understand what the AI-RD-PLATFORM is doing, how AI is thinking, what the AI-RD-PLATFORM plans to change, or whether the result is safe to apply.
- ability: The AI-RD-PLATFORM shows the execution process, generated outputs, and pending changes, and waits for users to confirm before important changes are applied.

## 4.5 Generated results are hard to evaluate

<!--
{
  "section_contract": {
    "section_id": "4.5",
    "title": "Generated results are hard to evaluate",
    "checkitems": [
      "state one core problem clearly",
      "describe the product ability that addresses that problem"
    ],
    "severity": "medium",
    "expected_format": "- problem: `{ProblemStatement}`\n- ability: `{ProductAbility}`"
  }
}
-->

- problem: Even after final artifacts are generated, users still need a basic way to judge whether the results are acceptable.
- ability: The AI-RD-PLATFORM provides basic validation feedback so users can quickly assess whether outputs are ready for review or further iteration.

# 5. User Workflow

<!--
{
  "section_contract": {
    "section_id": "5",
    "title": "User Workflow",
    "checkitems": [
      "describe the end-to-end user workflow and important control points",
      "make main flow, resume support, and failure handling explicit",
      "keep the workflow at product behavior level"
    ],
    "severity": "high"
  }
}
-->

## 5.1 Standard Flow

<!--
{
  "section_contract": {
    "section_id": "5.1",
    "title": "Standard Flow",
    "checkitems": [
      "describe the standard end-to-end workflow in ordered stages",
      "use one subsection per important workflow stage"
    ],
    "severity": "medium"
  }
}
-->

### 5.1.1 Start

<!--
{
  "section_contract": {
    "section_id": "5.1.1",
    "title": "Start",
    "checkitems": [
      "describe one workflow stage clearly",
      "focus on what the user or system does at this stage"
    ],
    "severity": "medium",
    "expected_format": "`{StageDescription}`"
  }
}
-->

PM creates or updates a requirement document and launches a task in the AI-RD-PLATFORM.

### 5.1.2 Requirement Interpretation

<!--
{
  "section_contract": {
    "section_id": "5.1.2",
    "title": "Requirement Interpretation",
    "checkitems": [
      "describe one workflow stage clearly",
      "focus on what the user or system does at this stage"
    ],
    "severity": "medium",
    "expected_format": "`{StageDescription}`"
  }
}
-->

The AI-RD-PLATFORM analyzes the requirement and prepares intended changes.

### 5.1.3. Requirement Review

<!--
{
  "section_contract": {
    "section_id": "5.1.3",
    "title": "Requirement Review",
    "checkitems": [
      "describe one workflow stage clearly",
      "focus on what the user or system does at this stage"
    ],
    "severity": "medium",
    "expected_format": "`{StageDescription}`"
  }
}
-->

PM reviews the intended changes and decides whether to continue, revise the requirement, or stop the task.

### 5.1.4. Design Generate/Update

<!--
{
  "section_contract": {
    "section_id": "5.1.4",
    "title": "Design Generate/Update",
    "checkitems": [
      "describe one workflow stage clearly",
      "focus on what the user or system does at this stage"
    ],
    "severity": "medium",
    "expected_format": "`{StageDescription}`"
  }
}
-->

After PM confirmation, the AI-RD-PLATFORM generates next-stage design outputs.

### 5.1.5 Design Review/Update

<!--
{
  "section_contract": {
    "section_id": "5.1.5",
    "title": "Design Review/Update",
    "checkitems": [
      "describe one workflow stage clearly",
      "focus on what the user or system does at this stage"
    ],
    "severity": "medium",
    "expected_format": "`{StageDescription}`"
  }
}
-->

The engineer reviews the design changes and updates them if needed.
The AI-RD-PLATFORM applies changes after engineer confirmation.

### 5.1.6. Implementation Generation/Update

<!--
{
  "section_contract": {
    "section_id": "5.1.6",
    "title": "Implementation Generation/Update",
    "checkitems": [
      "describe one workflow stage clearly",
      "focus on what the user or system does at this stage"
    ],
    "severity": "medium",
    "expected_format": "`{StageDescription}`"
  }
}
-->

The AI-RD-PLATFORM generates or updates code artifacts based on upstream design outputs.

### 5.1.7. Change Review

<!--
{
  "section_contract": {
    "section_id": "5.1.7",
    "title": "Change Review",
    "checkitems": [
      "describe one workflow stage clearly",
      "focus on what the user or system does at this stage"
    ],
    "severity": "medium",
    "expected_format": "`{StageDescription}`"
  }
}
-->

The engineer reviews the generated changes and decides whether to apply or reject them.

### 5.1.8. Validation

<!--
{
  "section_contract": {
    "section_id": "5.1.8",
    "title": "Validation",
    "checkitems": [
      "describe one workflow stage clearly",
      "focus on what the user or system does at this stage"
    ],
    "severity": "medium",
    "expected_format": "`{StageDescription}`"
  }
}
-->

The AI-RD-PLATFORM runs validation or test steps and presents the result summary.

### 5.1.9. Acceptance

<!--
{
  "section_contract": {
    "section_id": "5.1.9",
    "title": "Acceptance",
    "checkitems": [
      "describe one workflow stage clearly",
      "focus on what the user or system does at this stage"
    ],
    "severity": "medium",
    "expected_format": "`{StageDescription}`"
  }
}
-->

The PM and engineer accept the result.

## 5.2 Resume Support Entry Points

<!--
{
  "section_contract": {
    "section_id": "5.2",
    "title": "Resume Support Entry Points",
    "checkitems": [
      "list the supported resume entry points",
      "state when each entry point should be used"
    ],
    "severity": "medium",
    "expected_format": "Users can resume from selected intermediate stages when there is already enough confirmed context.\n\nSupported resume entry points:\n- `{EntryPointA}`\n  `{EntryPointADescription}`\n- `{EntryPointB}`\n  `{EntryPointBDescription}`\n- `{EntryPointC}`\n  `{EntryPointCDescription}`"
  }
}
-->

Users can resume from selected intermediate stages when there is already enough confirmed context.

Supported resume entry points:
- Design Generation or Update
  Used when requirement interpretation has already been confirmed and the user wants to continue from design generation.
- Implementation Generation or Update
  Used when design outputs are already confirmed and the user wants to continue from implementation.
- Validation
  Used when code changes are already generated and the user wants to rerun validation or test steps.


## 5.3 Failure Handling

<!--
{
  "section_contract": {
    "section_id": "5.3",
    "title": "Failure Handling",
    "checkitems": [
      "describe what happens when a workflow stage fails",
      "make retry and rollback policy explicit"
    ],
    "severity": "medium",
    "expected_format": "- `{FailureRule1}`\n- `{FailureRule2}`\n- `{FailureRule3}`\n- `{FailureRule4}`"
  }
}
-->

- If a workflow stage fails, the platform stops at the current stage.
- The platform does not automatically roll back to an earlier stage.
- Users should fix the issue at the current stage.
- After the issue is fixed, the workflow should retry from that stage.

# 6. Inputs and Outputs

<!--
{
  "section_contract": {
    "section_id": "6",
    "title": "Inputs and Outputs",
    "checkitems": [
      "define required inputs, prerequisites, and outputs",
      "keep the descriptions concrete and product-facing"
    ],
    "severity": "high"
  }
}
-->

## 6.1 Inputs

<!--
{
  "section_contract": {
    "section_id": "6.1",
    "title": "Inputs",
    "checkitems": [
      "list the required user or system inputs"
    ],
    "severity": "medium",
    "expected_format": "- `{Input1}`\n- `{Input2}`"
  }
}
-->

- requirement document
- project directory

## 6.2 Prerequisites

<!--
{
  "section_contract": {
    "section_id": "6.2",
    "title": "Prerequisites",
    "checkitems": [
      "list prerequisites that must already be true before use"
    ],
    "severity": "medium",
    "expected_format": "- `{Prerequisite1}`\n- `{Prerequisite2}`"
  }
}
-->

- the target project is stored in a git repository

## 6.3 Outputs

<!--
{
  "section_contract": {
    "section_id": "6.3",
    "title": "Outputs",
    "checkitems": [
      "list the main artifacts or information produced by the product"
    ],
    "severity": "medium",
    "expected_format": "- `{Output1}`\n- `{Output2}`\n- `{Output3}`"
  }
}
-->

- updated requirement document
- updated design artifacts
- updated code artifacts
- runnable program output for supported scenarios
- validation or test results
- workflow stage information and pending change summaries

# 7 Scope and Non-Goals

<!--
{
  "section_contract": {
    "section_id": "7",
    "title": "Scope and Non-Goals",
    "checkitems": [
      "define scope by version or milestone",
      "make goals and non-goals explicit for each version"
    ],
    "severity": "high"
  }
}
-->

## 7.1 V1: MVP

<!--
{
  "section_contract": {
    "section_id": "7.1",
    "title": "V1: MVP",
    "checkitems": [
      "list V1 goals and non-goals",
      "keep the scope realistic and milestone-oriented"
    ],
    "severity": "medium",
    "expected_format": "- Goals\n  - `{Goal1}`\n  - `{Goal2}`\n- Non-Goals\n  - `{NonGoal1}`\n  - `{NonGoal2}`"
  }
}
-->

- Goals
    - support the standard end-to-end flow from requirement input to runnable demo output
- support workflow resume from intermediate stages through CLI task execution
- show important stage information and pending changes in CLI
- support the validated demo scenario: Travel Planning Agent
- Non-Goals
    - no UI-based review experience
    - No support for multiple project types
    - No requirement for fully reviewable intermediate artifacts at every step

## 7.2 V2: Available

<!--
{
  "section_contract": {
    "section_id": "7.2",
    "title": "V2: Available",
    "checkitems": [
      "list V2 goals and non-goals",
      "show how V2 extends V1 without redefining the whole product"
    ],
    "severity": "medium",
    "expected_format": "- Goals\n  - `{Goal1}`\n  - `{Goal2}`\n- Non-Goals\n  - `{NonGoal1}`\n  - `{NonGoal2}`"
  }
}
-->

- Goals
    - provide a simple UI for viewing workflow stages and basic progress information
    - support workflow resume from selected intermediate stages through UI
    - improve output quality and controllability for the Travel Planning Agent scenario
- Non-Goals
    - no other types of project
    - no complete artifact review workflow in UI

## 7.3 V3: General

<!--
{
  "section_contract": {
    "section_id": "7.3",
    "title": "V3: General",
    "checkitems": [
      "list V3 goals and non-goals",
      "describe the more general product scope at this stage"
    ],
    "severity": "medium",
    "expected_format": "- Goals\n  - `{Goal1}`\n  - `{Goal2}`\n- Non-Goals\n  - `{NonGoal1}`\n  - `{NonGoal2}`"
  }
}
-->

- Goals
    - provide a complete UI for progress tracking, artifact review, and workflow decision-making
    - support review of intermediate artifacts and pending changes directly in UI
    - support 3 project types beyond the initial demo scenario
    - improve consistency across requirement updates, design updates, code updates, and validation
- Non-Goals
    - no guarantee for all project types or all engineering environments
    - no support for highly complex projects in this version

# 8. Success Criteria

<!--
{
  "section_contract": {
    "section_id": "8",
    "title": "Success Criteria",
    "checkitems": [
      "define observable success criteria by version",
      "keep the criteria concrete and testable"
    ],
    "severity": "high"
  }
}
-->

## 8.1 V1

<!--
{
  "section_contract": {
    "section_id": "8.1",
    "title": "V1",
    "checkitems": [
      "list concrete success criteria for V1"
    ],
    "severity": "medium",
    "expected_format": "- `{SuccessCriterion1}`\n- `{SuccessCriterion2}`\n- `{SuccessCriterion3}`"
  }
}
-->

- users can start from a requirement document and complete the standard flow through CLI
- users can start the workflow from selected intermediate stages through CLI
- the platform can generate a runnable Travel Planning Agent demo from supported requirement input
- the platform shows stage progress and pending changes before important modifications are applied


## 8.2 V2

<!--
{
  "section_contract": {
    "section_id": "8.2",
    "title": "V2",
    "checkitems": [
      "list concrete success criteria for V2"
    ],
    "severity": "medium",
    "expected_format": "- `{SuccessCriterion1}`\n- `{SuccessCriterion2}`\n- `{SuccessCriterion3}`"
  }
}
-->

- users can see workflow stages and task progress in UI
- users can view basic output summaries and validation summaries in UI
- users can start or resume selected tasks through UI
- users still rely on CLI or manual review for deeper artifact inspection and final decisions

## 8.3 V3

<!--
{
  "section_contract": {
    "section_id": "8.3",
    "title": "V3",
    "checkitems": [
      "list concrete success criteria for V3"
    ],
    "severity": "medium",
    "expected_format": "- `{SuccessCriterion1}`\n- `{SuccessCriterion2}`\n- `{SuccessCriterion3}`"
  }
}
-->

- users can review key artifacts and pending changes directly in UI
- users can make accept, reject, or revise decisions in UI at important checkpoints
- users can complete the core review workflow in UI without depending on CLI for key review actions
- the platform maintains acceptable consistency across requirement, design, code, and validation outputs
- the platform supports at least three defined project types with the same core workflow

# 9. Risks

<!--
{
  "section_contract": {
    "section_id": "9",
    "title": "Risks",
    "checkitems": [
      "list the main risks that may reduce product value or delivery quality",
      "keep the risks product-relevant"
    ],
    "severity": "medium",
    "expected_format": "- `{Risk1}`\n- `{Risk2}`\n- `{Risk3}`"
  }
}
-->

- poor requirements may reduce output quality
- generated artifacts may still contain important errors
- complex projects may reduce stability


# 10. Constraints

<!--
{
  "section_contract": {
    "section_id": "10",
    "title": "Constraints",
    "checkitems": [
      "list the key constraints that shape product behavior or scope",
      "make mandatory product boundaries explicit"
    ],
    "severity": "high"
  }
}
-->

## 10.1 Requirement document is the primary input

<!--
{
  "section_contract": {
    "section_id": "10.1",
    "title": "Requirement document is the primary input",
    "checkitems": [
      "state one explicit product constraint",
      "describe it in one short paragraph"
    ],
    "severity": "medium",
    "expected_format": "`{ConstraintDescription}`"
  }
}
-->

The system must use the requirement document as the main input.

## 10.2 Important changes must be confirmed by users

<!--
{
  "section_contract": {
    "section_id": "10.2",
    "title": "Important changes must be confirmed by users",
    "checkitems": [
      "state one explicit product constraint",
      "describe it in one short paragraph"
    ],
    "severity": "medium",
    "expected_format": "`{ConstraintDescription}`"
  }
}
-->

Important changes must be reviewable and confirmable by users before they are applied.

## 10.3 Project scope constraint

<!--
{
  "section_contract": {
    "section_id": "10.3",
    "title": "Project scope constraint",
    "checkitems": [
      "state one explicit product constraint",
      "describe it in one short paragraph"
    ],
    "severity": "medium",
    "expected_format": "`{ConstraintDescription}`"
  }
}
-->

The product must be designed primarily for small to medium-sized software projects, not for all project types or engineering environments.

## 10.4 Output reviewability constraint

<!--
{
  "section_contract": {
    "section_id": "10.4",
    "title": "Output reviewability constraint",
    "checkitems": [
      "state one explicit product constraint",
      "describe it in one short paragraph"
    ],
    "severity": "medium",
    "expected_format": "`{ConstraintDescription}`"
  }
}
-->

Generated outputs must be understandable, reviewable, and traceable.

## 10.5 Validation constraint

<!--
{
  "section_contract": {
    "section_id": "10.5",
    "title": "Validation constraint",
    "checkitems": [
      "state one explicit product constraint",
      "describe it in one short paragraph"
    ],
    "severity": "medium",
    "expected_format": "`{ConstraintDescription}`"
  }
}
-->

The AI-RD-PLATFORM should provide basic validation feedback for generated outputs, but generated outputs do not replace human judgment.

## 10.6 Reviewability and controllability

<!--
{
  "section_contract": {
    "section_id": "10.6",
    "title": "Reviewability and controllability",
    "checkitems": [
      "state one explicit product constraint",
      "describe it in one short paragraph"
    ],
    "severity": "medium",
    "expected_format": "`{ConstraintDescription}`"
  }
}
-->

The product must expose pending changes before important modifications are applied.

## 10.7 not fully autonomous

<!--
{
  "section_contract": {
    "section_id": "10.7",
    "title": "not fully autonomous",
    "checkitems": [
      "state one explicit product constraint",
      "describe it in one short paragraph"
    ],
    "severity": "medium",
    "expected_format": "`{ConstraintDescription}`"
  }
}
-->

The product must not assume fully autonomous project delivery and must require user involvement in important review and delivery decisions.
