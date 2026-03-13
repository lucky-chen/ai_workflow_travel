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
      "description": "The document should stay at product requirement level and remain consistent across user scenarios, journey, scope, constraints, and success criteria.",
      "severity": "high"
    },
    {
      "check_item": "workflow_and_goal_alignment",
      "description": "Product goals, core problems, journey, outputs, scope, and success criteria should remain logically aligned.",
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
- ability: The AI-RD-PLATFORM provides independently runnable stage capabilities and can also combine them through runtime composition modes when users want continuous execution.

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

# 5. Core Functional Points

<!--
{
  "section_contract": {
    "section_id": "5",
    "title": "Core Functional Points",
    "checkitems": [
      "list the core product-facing capabilities before journey design",
      "separate basic execution units from runtime composition modes",
      "make each functional point precise about its role in the product"
    ],
    "severity": "high"
  }
}
-->

## 5.1 Basic Execution Units

<!--
{
  "section_contract": {
    "section_id": "5.1",
    "title": "Basic Execution Units",
    "checkitems": [
      "list the minimum independently runnable execution capabilities",
      "make each execution unit precise about input, output, and downstream effect",
      "keep runtime composition modes out of this section"
    ],
    "severity": "high",
    "expected_format": "- `{ExecutionUnit1}`\n- `{ExecutionUnit2}`\n- `{ExecutionUnit3}`"
  }
}
-->

- [requirement_update]: update the requirement document from input and requirement context
- [requirement_contract]: check the requirement document against requirement rules
- [architecture_update]: update the architecture document from input and the requirement document
- [architecture_contract]: check the architecture document against architecture rules
- [child_design_update]: update a target child design document from input, the requirement document, and the architecture document
- [child_design_contract]: check a target child design document against child design rules
- [overall_design_contract]: check the consistency of the requirement document, architecture document, and child design documents together
- [planning_update]: update the implementation plan document from input, the requirement document, the architecture document, and child design documents
- [planning_contract]: check the implementation plan document against planning rules
- [implementation_update]: generate or update code from the implementation plan document, the requirement document, the architecture document, child design documents, and current workspace files
- [implementation_contract]: validate the generated code or project output

## 5.2 Runtime Composition Modes

<!--
{
  "section_contract": {
    "section_id": "5.2",
    "title": "Runtime Composition Modes",
    "checkitems": [
      "list the supported runtime composition modes",
      "state how execution units are composed in each mode",
      "keep business capabilities out of this section"
    ],
    "severity": "high",
    "expected_format": "- `{Mode1}`\n- `{Mode2}`"
  }
}
-->

- [single_unit_run]: run one basic execution unit independently when its required inputs are available
- [stage_run]: run one stage as a fixed execution order of multiple basic execution units for one target artifact or one target goal

## 5.3 Quality Control

<!--
{
  "section_contract": {
    "section_id": "5.3",
    "title": "Quality Control",
    "checkitems": [
      "list the control and visibility capabilities that apply across execution units and stages",
      "separate gate control from business artifact processing",
      "make process visibility explicit"
    ],
    "severity": "high",
    "expected_format": "- `{Capability1}`\n- `{Capability2}`"
  }
}
-->

- [gate]: make allow, reject, or hold decisions for downstream continuation or change application
- [trace]: record and expose execution status, important changes, and decision points during execution

# 6. User Scenarios

<!--
{
  "section_contract": {
    "section_id": "6",
    "title": "User Scenarios",
    "checkitems": [
      "describe the end-to-end user scenario and important control points",
      "make main flow, resume support, and failure handling explicit",
      "keep the scenario at product behavior level"
    ],
    "severity": "high"
  }
}
-->

## 6.1 Standard Scenario

<!--
{
    "section_contract": {
      "section_id": "6.1",
      "title": "Standard Scenario",
      "checkitems": [
        "describe the main scenario in ordered steps",
        "make the main user control points explicit",
        "keep the content at product behavior level",
        "for each `6.1.x` scenario, describe one clear user scenario",
        "for each `6.1.x` scenario, focus on what the user does and what the system presents",
        "for each `6.1.x` scenario, use functional point names that strictly come from `# 5. Core Functional Points`"
      ],
      "severity": "high",
    "expected_format": "`{ScenarioSummary}`\n\n### 6.1.1 `{ScenarioStep1}`\n- `{ScenarioDetail1}`\n- `{ScenarioDetail2}`\n\n### 6.1.2 `{ScenarioStep2}`\n- `{ScenarioDetail1}`\n- `{ScenarioDetail2}`\n\n### 6.1.3 `{ScenarioStep3}`\n- `{ScenarioDetail1}`\n- `{ScenarioDetail2}`"
  }
}
-->

This standard scenario describes the main path from requirement update to implementation validation. In this scenario, each downstream artifact is produced from upstream artifacts, checked before downstream use, and reviewed at important gate points.

### 6.1.1 Requirement Scenario

- The user asks the system to update the requirement document.
- The system records progress, changes, and step transitions through `[trace]` during the whole requirement scenario.
- After the requirement document is updated, the user reviews it through `[gate]`.
- If the review passes, the system checks the requirement document through `[requirement_contract]`.
- If the check succeeds, the user continues to the next process.
- If the check fails, the system returns the check errors, and the user continues from the current or previous process with those errors.

### 6.1.2 Architecture Scenario

- The user asks the system to update the architecture document from the current input and requirement document.
- The system records progress, changes, and step transitions through `[trace]` during the whole architecture scenario.
- After the architecture document is updated, the user reviews it through `[gate]`.
- If the review passes, the system checks the architecture document through `[architecture_contract]`.
- If the check succeeds, the user continues to the next process.
- If the check fails, the system returns the check errors, and the user continues from the current or previous process with those errors.

### 6.1.3 Child Design Scenario

- The user asks the system to update one target child design document from the current input, requirement document, and architecture document.
- The system records progress, changes, and step transitions through `[trace]` during the whole child design scenario.
- After the child design document is updated, the user reviews it through `[gate]`.
- If the review passes, the system checks the child design document through `[child_design_contract]`.
- If the check succeeds, the user continues to the next process.
- If the check fails, the system returns the check errors, and the user continues from the current or previous process with those errors.

### 6.1.4 Overall Design Check Scenario

- The user asks the system to check the consistency of the requirement document, architecture document, and child design documents together through `[overall_design_contract]`.
- The system records progress, changes, and step transitions through `[trace]` during the whole overall design check scenario.
- The system presents the overall design check result to the user.
- The user reviews the result through `[gate]`.
- If the review passes, the user continues to the planning scenario.
- If the review does not pass, the user returns to the related upstream update step with the reported issues.

### 6.1.5 Planning Scenario

- The user asks the system to update the implementation plan document from the current input and upstream design documents.
- The system records progress, changes, and step transitions through `[trace]` during the whole planning scenario.
- After the implementation plan document is updated, the user reviews it through `[gate]`.
- If the review passes, the system checks the implementation plan document through `[planning_contract]`.
- If the check succeeds, the user continues to the implementation scenario.
- If the check fails, the system returns the check errors, and the user continues from the current or previous process with those errors.

### 6.1.6 Implementation Scenario

- The user asks the system to update code from the implementation plan document, upstream design documents, and current workspace files.
- The system records progress, changes, and step transitions through `[trace]` during the whole implementation scenario.
- After the code is updated, the user reviews the code changes through `[gate]`.
- If the review passes, the system validates the result through `[implementation_contract]`.
- If validation succeeds, the user accepts the result and finishes the scenario.
- If validation fails, the system returns the validation result, and the user continues from the current or previous process with that result.

## 6.2 Scenario Failure Handling

<!--
{
    "section_contract": {
      "section_id": "6.2",
      "title": "Scenario Failure Handling",
      "checkitems": [
        "describe what happens in the user scenario when execution cannot continue",
        "keep the description at user scenario level and avoid internal runtime detail",
        "use functional point names that strictly come from `# 5. Core Functional Points`"
      ],
    "severity": "medium",
    "expected_format": "- `{FailureRule1}`\n- `{FailureRule2}`\n- `{FailureRule3}`\n- `{FailureRule4}`"
  }
}
-->

- If `[requirement_update]`, `[architecture_update]`, `[child_design_update]`, `[planning_update]`, or `[implementation_update]` cannot continue, the system should clearly show which functional point failed and what information the user needs to fix.
- If `[requirement_contract]`, `[architecture_contract]`, `[child_design_contract]`, `[overall_design_contract]`, `[planning_contract]`, or `[implementation_contract]` fails, the related result must not continue downstream.
- If `[gate]` rejects an updated artifact, a check result, or code changes, the system should return the related result and let the user decide how to continue the scenario.
- The user should continue from the failed functional point or an earlier related scenario, instead of restarting the whole scenario by default.

# 7. Inputs and Outputs

<!--
{
  "section_contract": {
    "section_id": "7",
    "title": "Inputs and Outputs",
    "checkitems": [
      "define required inputs, prerequisites, and outputs",
      "keep the descriptions concrete and product-facing"
    ],
    "severity": "high"
  }
}
-->

## 7.1 Execution Unit Inputs And Outputs

<!--
{
  "section_contract": {
    "section_id": "7.1",
    "title": "Execution Unit Inputs And Outputs",
    "checkitems": [
      "list the main inputs and outputs for each basic execution unit",
      "organize the content by basic execution unit"
    ],
    "severity": "medium",
    "expected_format": "### 7.1.1 `{ExecutionUnit1}`\n- inputs: `{Input1}`\n- outputs: `{Output1}`\n\n### 7.1.2 `{ExecutionUnit2}`\n- inputs: `{Input2}`\n- outputs: `{Output2}`"
  }
}
-->

### 7.1.1 `[requirement_update]`

- inputs: 
  - user_comment
  - requirement.md(option)
  - requirement_template.md
  - requirement_contract.json
- outputs: 
  - requirement.md

### 7.1.2 `[requirement_contract]`

- inputs: 
  - requirement.md.md
  - requirement_contract.json
- outputs: 
  - requirement_contract_result.json

### 7.1.3 `[architecture_update]`

- inputs: 
  - user_comment
  - requirement.md
  - architecture_template.md
  - architecture_contract.json
- outputs:
  - architecture.md

### 7.1.4 `[architecture_contract]`

- inputs: architecture document
- outputs: architecture contract result

### 7.1.5 `[child_design_update]`

- inputs: user input, requirement document, architecture document
- outputs: updated child design document

### 7.1.6 `[child_design_contract]`

- inputs: child design document
- outputs: child design contract result

### 7.1.7 `[overall_design_contract]`

- inputs: requirement document, architecture document, child design documents
- outputs: overall design contract result

### 7.1.8 `[planning_update]`

- inputs: user input, requirement document, architecture document, child design documents
- outputs: updated implementation plan document

### 7.1.9 `[planning_contract]`

- inputs: implementation plan document
- outputs: planning contract result

### 7.1.10 `[implementation_update]`

- inputs: implementation plan document, requirement document, architecture document, child design documents, current workspace files
- outputs: updated code files, pending change summaries

### 7.1.11 `[implementation_contract]`

- inputs: generated code or project output
- outputs: implementation contract result or validation result

### 7.1.12 `[gate]`

- inputs: updated artifact, contract result, generated change, or validation result
- outputs: gate decision for downstream continuation or change application

### 7.1.13 `[trace]`

- inputs: execution status, important changes, and decision points during execution
- outputs: trace records and trace summaries

## 7.2 Prerequisites

<!--
{
  "section_contract": {
    "section_id": "7.2",
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

# 8 Scope and Non-Goals

<!--
{
  "section_contract": {
    "section_id": "8",
    "title": "Scope and Non-Goals",
    "checkitems": [
      "define scope by version or milestone",
      "make goals and non-goals explicit for each version"
    ],
    "severity": "high"
  }
}
-->

## 8.1 V1: MVP

<!--
{
  "section_contract": {
    "section_id": "8.1",
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
- support resume from intermediate processes through CLI task execution
- show important stage information and pending changes in CLI
- support the validated demo scenario: Travel Planning Agent
- Non-Goals
    - no UI-based review experience
    - No support for multiple project types
    - No requirement for fully reviewable intermediate artifacts at every step

## 8.2 V2: Available

<!--
{
  "section_contract": {
    "section_id": "8.2",
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
    - provide a simple UI for viewing journey processes and basic progress information
    - support resume from selected intermediate processes through UI
    - improve output quality and controllability for the Travel Planning Agent scenario
- Non-Goals
    - no other types of project
    - no complete artifact review journey in UI

## 8.3 V3: General

<!--
{
  "section_contract": {
    "section_id": "8.3",
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
    - provide a complete UI for progress tracking, artifact review, and journey decision-making
    - support review of intermediate artifacts and pending changes directly in UI
    - support 3 project types beyond the initial demo scenario
    - improve consistency across requirement updates, design updates, code updates, and validation
- Non-Goals
    - no guarantee for all project types or all engineering environments
    - no support for highly complex projects in this version

# 9. Success Criteria

<!--
{
  "section_contract": {
    "section_id": "9",
    "title": "Success Criteria",
    "checkitems": [
      "define observable success criteria by version",
      "keep the criteria concrete and testable"
    ],
    "severity": "high"
  }
}
-->

## 9.1 V1

<!--
{
  "section_contract": {
    "section_id": "9.1",
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
- users can start from selected intermediate processes through CLI
- the platform can generate a runnable Travel Planning Agent demo from supported requirement input
- the platform shows stage progress and pending changes before important modifications are applied


## 9.2 V2

<!--
{
  "section_contract": {
    "section_id": "9.2",
    "title": "V2",
    "checkitems": [
      "list concrete success criteria for V2"
    ],
    "severity": "medium",
    "expected_format": "- `{SuccessCriterion1}`\n- `{SuccessCriterion2}`\n- `{SuccessCriterion3}`"
  }
}
-->

- users can see journey processes and task progress in UI
- users can view basic output summaries and validation summaries in UI
- users can start or resume selected tasks through UI
- users still rely on CLI or manual review for deeper artifact inspection and final decisions

## 9.3 V3

<!--
{
  "section_contract": {
    "section_id": "9.3",
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
- users can complete the core review journey in UI without depending on CLI for key review actions
- the platform maintains acceptable consistency across requirement, design, code, and validation outputs
- the platform supports at least three defined project types with the same core journey

# 10. Risks

<!--
{
  "section_contract": {
    "section_id": "10",
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


# 11. Constraints

<!--
{
  "section_contract": {
    "section_id": "11",
    "title": "Constraints",
    "checkitems": [
      "list the key constraints that shape product behavior or scope",
      "make mandatory product boundaries explicit"
    ],
    "severity": "high"
  }
}
-->

## 11.1 Requirement document is the primary input

<!--
{
  "section_contract": {
    "section_id": "11.1",
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

## 11.2 Important changes must be confirmed by users

<!--
{
  "section_contract": {
    "section_id": "11.2",
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

## 11.3 Project scope constraint

<!--
{
  "section_contract": {
    "section_id": "11.3",
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

## 11.4 Output reviewability constraint

<!--
{
  "section_contract": {
    "section_id": "11.4",
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

## 11.5 Validation constraint

<!--
{
  "section_contract": {
    "section_id": "11.5",
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

## 11.6 Reviewability and controllability

<!--
{
  "section_contract": {
    "section_id": "11.6",
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

## 11.7 not fully autonomous

<!--
{
  "section_contract": {
    "section_id": "11.7",
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
