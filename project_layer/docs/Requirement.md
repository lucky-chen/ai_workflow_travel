<!--
{
  "document_contracts": [
    {
      "check_item": "document_structure_complete",
      "description": "The requirement document should contain the required top-level sections, subsection structure, and process-oriented product requirement content.",
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

An AI-RD-PLATFORM focused on spec document generation and code generation in the AI software development flow, delivered through the Codex plugin in a way that complements existing workflows instead of replacing them.
- focus on spec document generation and code generation in the AI software development flow
- take the V3 scope as the current minimum product goal
- do not pursue a broad all-in-one software development platform position in the current phase
- complement existing Codex plugin usage patterns instead of changing the user's established workflow habits
- reduce the cost of turning requirements into reviewable and maintainable outputs

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

- problem: Users write requirements in natural language, which is often ambiguous and cannot be directly used by downstream processes.
- ability: The AI-RD-PLATFORM structures raw requirements into a clearer and more actionable form so they can be used by downstream processes as stable input.

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

- problem: Users often need to bridge multiple processes, such as clarification, design, coding, review, test, and update, which is costly and inefficient.
- ability: The AI-RD-PLATFORM provides independently runnable execution capabilities, and external callers can combine those capabilities through one unified entry when they want to compose multiple capabilities.

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
      "organize the section into clear functional point categories",
      "make the category split logically coherent and mutually distinguishable",
      "make each functional point precise about its role and boundary"
    ],
    "severity": "high",
    "expected_format": "## `{Category1}`\n- `{FunctionalPoint1}`\n- `{FunctionalPoint2}`\n\n## `{Category2}`\n- `{FunctionalPoint1}`\n\n## `{Category3}`\n- `{FunctionalPoint1}`\n- `{FunctionalPoint2}`"
  }
}
-->

## 5.1 Basic Execution Units

- [requirement_design_generate]: generate the requirement document from input and requirement context
- [requirement_design_update]: update the requirement document from input and requirement context
- [requirement_design_contract]: check the requirement document against requirement rules
- [architecture_design_generate]: generate the architecture document from input and the requirement document
- [architecture_design_update]: update the architecture document from input and the requirement document
- [architecture_design_contract]: check the architecture document against architecture rules
- [item_design_generate]: generate a target item design document from input, the requirement document, and the architecture document
- [item_design_update]: update a target item design document from input, the requirement document, and the architecture document
- [item_design_contract]: check a target item design document against item design rules
- [overall_design_contract]: check the consistency of the requirement document, architecture document, and item design documents together
- [work_plan_generate]: generate the work plan from input, the requirement document, the architecture document, and item design documents
- [work_plan_update]: update the work plan from input, the requirement document, the architecture document, and item design documents
- [work_plan_contract]: check the work plan against planning rules
- [work_execute]: execute the work plan from the requirement document, the architecture document, item design documents, the work plan, and current workspace files
- [work_execute_contract]: run one specific validation script in the work directory, allow the script task set to expand over time, and return one work execute contract result json

## 5.2 External Composition

- [external_composition]: each basic execution unit is the minimal independently composable unit, and external callers can freely choose and combine multiple basic execution units through the unified runtime entry as needed; in the current version, this capability is an explicit reserved runtime boundary rather than a fully implemented multi-step composition flow

## 5.3 Quality Control

- [gate]: make allow or reject decisions only after contract or validation results are available, for downstream continuation or checked change application
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

This standard scenario describes the main long-term path from requirement generation or update to implementation validation. In this scenario, each downstream artifact is produced from upstream artifacts, checked before downstream use, and reviewed at important gate points only after the related contract or validation result is available. The compose-run path that combines multiple basic execution units remains a current-version reserved capability boundary rather than a fully implemented multi-step runtime flow.

### 6.1.1 Requirement Scenario

- The user asks the system to generate or update the requirement document through `[requirement_design_generate]` or `[requirement_design_update]`.
- The system records progress, changes, and step transitions through `[trace]` during the whole requirement scenario.
- After the requirement document is generated or updated, the system checks the requirement document through `[requirement_design_contract]`.
- The user reviews the contract result through `[gate]`.
- If the review passes, the user continues to the next process.
- If the check fails or the review does not pass, the system returns the related result, and the user continues from the current or previous process with that result.

### 6.1.2 Architecture Scenario

- The user asks the system to generate or update the architecture document from the current input and requirement document through `[architecture_design_generate]` or `[architecture_design_update]`.
- The system records progress, changes, and step transitions through `[trace]` during the whole architecture scenario.
- After the architecture document is generated or updated, the system checks the architecture document through `[architecture_design_contract]`.
- The user reviews the contract result through `[gate]`.
- If the review passes, the user continues to the next process.
- If the check fails or the review does not pass, the system returns the related result, and the user continues from the current or previous process with that result.

### 6.1.3 Item Design Scenario

- The user asks the system to generate or update one target item design document from the current input, requirement document, and architecture document through `[item_design_generate]` or `[item_design_update]`.
- The system records progress, changes, and step transitions through `[trace]` during the whole item design scenario.
- After the item design document is generated or updated, the system checks the item design document through `[item_design_contract]`.
- The user reviews the contract result through `[gate]`.
- If the review passes, the user continues to the next process.
- If the check fails or the review does not pass, the system returns the related result, and the user continues from the current or previous process with that result.

### 6.1.4 Overall Design Check Scenario

- The user asks the system to check the consistency of the requirement document, architecture document, and item design documents together through `[overall_design_contract]`.
- The system records progress, changes, and step transitions through `[trace]` during the whole overall design check scenario.
- The system presents the overall design contract result to the user.
- The user reviews the contract result through `[gate]`.
- If the review passes, the user continues to the planning scenario.
- If the review does not pass, the user returns to the related upstream generate or update step with the reported issues.

### 6.1.5 Planning Scenario

- The user asks the system to generate or update the work plan from the current input and upstream design documents through `[work_plan_generate]` or `[work_plan_update]`.
- The system records progress, changes, and step transitions through `[trace]` during the whole planning scenario.
- After the work plan is generated or updated, the system checks the work plan through `[work_plan_contract]`.
- The user reviews the contract result through `[gate]`.
- If the review passes, the user continues to the implementation scenario.
- If the check fails or the review does not pass, the system returns the related result, and the user continues from the current or previous process with that result.

### 6.1.6 Implementation Scenario

- The user asks the system to execute the work plan from the upstream design documents, the work plan, and current workspace files through `[work_execute]`.
- The system records progress, changes, and step transitions through `[trace]` during the whole implementation scenario.
- After the work plan is executed and code changes are produced, the system runs the fixed validation script through `[work_execute_contract]` and returns the contract result.
- The user reviews the validation result and checked change set through `[gate]`.
- If the review passes, the user accepts the result and finishes the scenario.
- If validation fails or the review does not pass, the system returns the related result, and the user continues from the current or previous process with that result.

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

- If `[requirement_design_generate]`, `[requirement_design_update]`, `[architecture_design_generate]`, `[architecture_design_update]`, `[item_design_generate]`, `[item_design_update]`, `[work_plan_generate]`, `[work_plan_update]`, or `[work_execute]` cannot continue, the system should clearly show which functional point failed and what information the user needs to fix.
- If `[requirement_design_contract]`, `[architecture_design_contract]`, `[item_design_contract]`, `[overall_design_contract]`, `[work_plan_contract]`, or `[work_execute_contract]` fails, the related result must not continue downstream.
- If `[gate]` rejects a contract result, validation result, or checked change set, the system should return the related result and let the user decide how to continue the scenario.
- The user should continue from the failed functional point or an earlier related scenario, instead of restarting the whole scenario by default.

# 7. Inputs and Outputs

<!--
{
  "section_contract": {
    "section_id": "7",
    "title": "Inputs and Outputs",
    "checkitems": [
      "define required inputs, prerequisites, and outputs",
      "organize the section in the same chapter structure used under `# 5. Core Functional Points`",
      "within each category, list each functional point separately",
      "keep the descriptions concrete and product-facing"
    ],
    "severity": "high",
    "expected_format": "## `{Category} Inputs And Outputs`\n### [{FunctionalPoint1}]\n- inputs: `{Input1}`\n- outputs: `{Output1}`\n\n### [{FunctionalPoint2}]\n- inputs: `{Input2}`\n- outputs: `{Output2}`"
  }
}
-->

## 7.1 Basic Execution Units Inputs And Outputs

### 7.1.1 [requirement_design_generate]

- inputs: 
  - user_comment
  - requirement_design_template.md
- outputs: 
  - requirement_design.md

### 7.1.2 [requirement_design_update]

- inputs: 
  - user_comment
  - requirement_design.md
- outputs: 
  - requirement_design.md

### 7.1.3 [requirement_design_contract]

- inputs: 
  - user_comment
  - requirement_design.md
  - requirement_design_template.md
- outputs: 
  - requirement_design_contract_result.json

### 7.1.4 [architecture_design_generate]

- inputs: 
  - user_comment
  - requirement_design.md
  - architecture_design_template.md
- outputs:
  - architecture_design.md

### 7.1.5 [architecture_design_update]

- inputs: 
  - user_comment
  - requirement_design.md
  - architecture_design.md
- outputs:
  - architecture_design.md

### 7.1.6 [architecture_design_contract]

- inputs: 
  - user_comment
  - architecture_design.md
  - architecture_design_template.md
- outputs:
  - architecture_design_contract_result.json

### 7.1.7 [item_design_generate]

- inputs: 
  - user_comment
  - requirement_design.md
  - architecture_design.md
  - item_design_template.md
- outputs: 
  - item_name_design.md

### 7.1.8 [item_design_update]

- inputs: 
  - user_comment
  - requirement_design.md
  - architecture_design.md
  - item_name_design.md
- outputs: 
  - item_name_design.md

### 7.1.9 [item_design_contract]

- inputs: 
  - user_comment
  - item_name_design.md
  - item_design_template.md
- outputs: 
  - item_name_design_contract_result.json

### 7.1.10 [overall_design_contract]

- inputs: 
  - user_comment
  - requirement_design.md
  - architecture_design.md
  - list: item_name_design.md
- outputs: 
  - overall_design_contract_result.json

### 7.1.11 [work_plan_generate]

- inputs: 
  - user_comment
  - requirement_design.md
  - architecture_design.md
  - list: item_name_design.md
  - work_plan_template.yaml
- outputs: 
  - work_plan.yaml

### 7.1.12 [work_plan_update]

- inputs: 
  -  user_comment
  - requirement_design.md
  - architecture_design.md
  - list: item_name_design.md
  - work_plan.yaml
- outputs: 
  - work_plan.yaml

### 7.1.13 [work_plan_contract]

- inputs: 
  - user_comment
  - work_plan.yaml
  - work_plan_template.yaml
- outputs: 
  - work_plan_contract_result.json

### 7.1.14 [work_execute]

- inputs: 
  - user_comment
  - requirement_design.md
  - architecture_design.md
  - list: item_name_design.md
  - work_plan.yaml
- outputs: 
  - project_files

### 7.1.15 [work_execute_contract]

- inputs: 
  - user_comment
  - work_dir
- outputs: 
  - work_execute_contract_result.json

## 7.2 External Composition Inputs And Outputs

### 7.2.1 [external_composition]

- inputs: one external composition request that selects one or more basic execution units and provides their required inputs
- outputs: unified-entry calling constraints for how independently composable basic execution units can be combined, with the current version treating this as a reserved runtime capability boundary rather than a fully implemented multi-step composition flow

## 7.3 Quality Control Inputs And Outputs

### 7.3.1 [gate]

- inputs: contract result, validation result, or checked change set after the related contract or validation step
- outputs: gate decision for downstream continuation or change application

### 7.3.2 [trace]

- inputs: execution status, important changes, and decision points during execution
- outputs: trace records and trace summaries

## 7.4 Prerequisites

- have the ability to call an AI API

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

## 8.1 V1: Internal

<!--
{
  "section_contract": {
    "section_id": "8.1",
    "title": "V1: Internal",
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
    - complete the internal implementation of the Basic Execution Units capabilities
    - provide internal Quality Control interfaces
- Non-Goals
    - no external delivery target in this version
    - no CI, MCP, Codex, VSCode, or IDE integration in this version

## 8.2 V2: Internal

<!--
{
  "section_contract": {
    "section_id": "8.2",
    "title": "V2: Internal",
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
    - complete the internal Quality Control capabilities
    - complete internal adaptation for CI calling
    - complete internal adaptation for MCP calling
- Non-Goals
    - no external delivery target in this version
    - no Codex, VSCode, or IDE integration in this version

## 8.3 V3: Current Product Goal

<!--
{
  "section_contract": {
    "section_id": "8.3",
    "title": "V3: Current Product Goal",
    "checkitems": [
      "list V3 goals and non-goals",
      "describe the current product goal at this phase"
    ],
    "severity": "medium",
    "expected_format": "- Goals\n  - `{Goal1}`\n  - `{Goal2}`\n- Non-Goals\n  - `{NonGoal1}`\n  - `{NonGoal2}`"
  }
}
-->

- Goals
    - adapt the product to the Codex plugin
    - use V3 as the current minimum product goal
- Non-Goals
    - no guarantee for all engineering environments in this version
    - no requirement to support every tool integration in this version

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

- the internal implementation covers all Basic Execution Units defined in `# 5.1 Basic Execution Units`
- the internal implementation exposes the required Quality Control interfaces
- internal validation can confirm that the Basic Execution Units produce the expected outputs


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

- the internal implementation covers the complete Quality Control capabilities defined in `# 5.3 Quality Control`
- internal validation can confirm that the CI calling adaptation works for the supported flow
- internal validation can confirm that the MCP calling adaptation works for the supported flow

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

- users can obtain the final delivery result from the supported product flow
- users can call the product through the Codex plugin and complete the supported product flow
- the Codex plugin adaptation provides the required basic product capabilities with acceptable stability

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

- AI-driven document modification may lead to instability in both delivery time and content quality
- the Codex plugin does not expose fully open integration capabilities, so the product may not adapt perfectly, but it should still support the basic required functions


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
