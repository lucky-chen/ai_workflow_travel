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
    "severity": "high",
    "expected_format": "- `{BackgroundPoint1}`\n- `{BackgroundPoint2}`\n- `{BackgroundPoint3}`"
  }
}
-->

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
    "severity": "high"
  }
}
-->

## 2.1 `{UserScenarioA}`

<!--
{
  "section_contract": {
    "section_id": "2.1",
    "title": "{UserScenarioA}",
    "checkitems": [
      "describe one concrete user group",
      "state the core outcome this user group expects"
    ],
    "severity": "medium",
    "expected_format": "`{UserScenarioADescription}`"
  }
}
-->

## 2.2 `{UserScenarioB}`

<!--
{
  "section_contract": {
    "section_id": "2.2",
    "title": "{UserScenarioB}",
    "checkitems": [
      "describe one concrete user group",
      "state the core outcome this user group expects"
    ],
    "severity": "medium",
    "expected_format": "`{UserScenarioBDescription}`"
  }
}
-->

## 2.3 `{UserScenarioC}`

<!--
{
  "section_contract": {
    "section_id": "2.3",
    "title": "{UserScenarioC}",
    "checkitems": [
      "describe one concrete user group",
      "include role-level responsibilities when the user group contains multiple roles"
    ],
    "severity": "medium",
    "expected_format": "`{UserScenarioCDescription}`\n\n- `{RoleA}`\n  - `{ResponsibilityA1}`\n  - `{ResponsibilityA2}`\n- `{RoleB}`\n  - `{ResponsibilityB1}`\n  - `{ResponsibilityB2}`"
  }
}
-->

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

## 4.1 `{ProblemAreaA}`

<!--
{
  "section_contract": {
    "section_id": "4.1",
    "title": "{ProblemAreaA}",
    "checkitems": [
      "state one core problem clearly",
      "describe the product ability that addresses that problem"
    ],
    "severity": "high",
    "expected_format": "- problem: `{ProblemStatement}`\n- ability: `{ProductAbility}`"
  }
}
-->

## 4.2 `{ProblemAreaB}`

<!--
{
  "section_contract": {
    "section_id": "4.2",
    "title": "{ProblemAreaB}",
    "checkitems": [
      "state one core problem clearly",
      "describe the product ability that addresses that problem"
    ],
    "severity": "high",
    "expected_format": "- problem: `{ProblemStatement}`\n- ability: `{ProductAbility}`"
  }
}
-->

## 4.3 `{ProblemAreaC}`

<!--
{
  "section_contract": {
    "section_id": "4.3",
    "title": "{ProblemAreaC}",
    "checkitems": [
      "state one core problem clearly",
      "describe the product ability that addresses that problem"
    ],
    "severity": "high",
    "expected_format": "- problem: `{ProblemStatement}`\n- ability: `{ProductAbility}`"
  }
}
-->

## 4.4 `{ProblemAreaD}`

<!--
{
  "section_contract": {
    "section_id": "4.4",
    "title": "{ProblemAreaD}",
    "checkitems": [
      "state one core problem clearly",
      "describe the product ability that addresses that problem"
    ],
    "severity": "medium",
    "expected_format": "- problem: `{ProblemStatement}`\n- ability: `{ProductAbility}`"
  }
}
-->

## 4.5 `{ProblemAreaE}`

<!--
{
  "section_contract": {
    "section_id": "4.5",
    "title": "{ProblemAreaE}",
    "checkitems": [
      "state one core problem clearly",
      "describe the product ability that addresses that problem"
    ],
    "severity": "medium",
    "expected_format": "- problem: `{ProblemStatement}`\n- ability: `{ProductAbility}`"
  }
}
-->

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

### 5.1.1 `{StageA}`

<!--
{
  "section_contract": {
    "section_id": "5.1.1",
    "title": "{StageA}",
    "checkitems": [
      "describe one workflow stage clearly",
      "focus on what the user or system does at this stage"
    ],
    "severity": "medium",
    "expected_format": "`{StageADescription}`"
  }
}
-->

### 5.1.2 `{StageB}`

<!--
{
  "section_contract": {
    "section_id": "5.1.2",
    "title": "{StageB}",
    "checkitems": [
      "describe one workflow stage clearly",
      "focus on what the user or system does at this stage"
    ],
    "severity": "medium",
    "expected_format": "`{StageBDescription}`"
  }
}
-->

### 5.1.3 `{StageC}`

<!--
{
  "section_contract": {
    "section_id": "5.1.3",
    "title": "{StageC}",
    "checkitems": [
      "describe one workflow stage clearly",
      "focus on what the user or system does at this stage"
    ],
    "severity": "medium",
    "expected_format": "`{StageCDescription}`"
  }
}
-->

### 5.1.4 `{StageD}`

<!--
{
  "section_contract": {
    "section_id": "5.1.4",
    "title": "{StageD}",
    "checkitems": [
      "describe one workflow stage clearly",
      "focus on what the user or system does at this stage"
    ],
    "severity": "medium",
    "expected_format": "`{StageDDescription}`"
  }
}
-->

### 5.1.5 `{StageE}`

<!--
{
  "section_contract": {
    "section_id": "5.1.5",
    "title": "{StageE}",
    "checkitems": [
      "describe one workflow stage clearly",
      "focus on what the user or system does at this stage"
    ],
    "severity": "medium",
    "expected_format": "`{StageEDescription}`"
  }
}
-->

### 5.1.6 `{StageF}`

<!--
{
  "section_contract": {
    "section_id": "5.1.6",
    "title": "{StageF}",
    "checkitems": [
      "describe one workflow stage clearly",
      "focus on what the user or system does at this stage"
    ],
    "severity": "medium",
    "expected_format": "`{StageFDescription}`"
  }
}
-->

### 5.1.7 `{StageG}`

<!--
{
  "section_contract": {
    "section_id": "5.1.7",
    "title": "{StageG}",
    "checkitems": [
      "describe one workflow stage clearly",
      "focus on what the user or system does at this stage"
    ],
    "severity": "medium",
    "expected_format": "`{StageGDescription}`"
  }
}
-->

### 5.1.8 `{StageH}`

<!--
{
  "section_contract": {
    "section_id": "5.1.8",
    "title": "{StageH}",
    "checkitems": [
      "describe one workflow stage clearly",
      "focus on what the user or system does at this stage"
    ],
    "severity": "medium",
    "expected_format": "`{StageHDescription}`"
  }
}
-->

### 5.1.9 `{StageI}`

<!--
{
  "section_contract": {
    "section_id": "5.1.9",
    "title": "{StageI}",
    "checkitems": [
      "describe one workflow stage clearly",
      "focus on what the user or system does at this stage"
    ],
    "severity": "medium",
    "expected_format": "`{StageIDescription}`"
  }
}
-->

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

## 10.1 `{ConstraintTitleA}`

<!--
{
  "section_contract": {
    "section_id": "10.1",
    "title": "{ConstraintTitleA}",
    "checkitems": [
      "state one explicit product constraint",
      "describe it in one short paragraph"
    ],
    "severity": "medium",
    "expected_format": "`{ConstraintDescription}`"
  }
}
-->

## 10.2 `{ConstraintTitleB}`

<!--
{
  "section_contract": {
    "section_id": "10.2",
    "title": "{ConstraintTitleB}",
    "checkitems": [
      "state one explicit product constraint",
      "describe it in one short paragraph"
    ],
    "severity": "medium",
    "expected_format": "`{ConstraintDescription}`"
  }
}
-->

## 10.3 `{ConstraintTitleC}`

<!--
{
  "section_contract": {
    "section_id": "10.3",
    "title": "{ConstraintTitleC}",
    "checkitems": [
      "state one explicit product constraint",
      "describe it in one short paragraph"
    ],
    "severity": "medium",
    "expected_format": "`{ConstraintDescription}`"
  }
}
-->

## 10.4 `{ConstraintTitleD}`

<!--
{
  "section_contract": {
    "section_id": "10.4",
    "title": "{ConstraintTitleD}",
    "checkitems": [
      "state one explicit product constraint",
      "describe it in one short paragraph"
    ],
    "severity": "medium",
    "expected_format": "`{ConstraintDescription}`"
  }
}
-->

## 10.5 `{ConstraintTitleE}`

<!--
{
  "section_contract": {
    "section_id": "10.5",
    "title": "{ConstraintTitleE}",
    "checkitems": [
      "state one explicit product constraint",
      "describe it in one short paragraph"
    ],
    "severity": "medium",
    "expected_format": "`{ConstraintDescription}`"
  }
}
-->

## 10.6 `{ConstraintTitleF}`

<!--
{
  "section_contract": {
    "section_id": "10.6",
    "title": "{ConstraintTitleF}",
    "checkitems": [
      "state one explicit product constraint",
      "describe it in one short paragraph"
    ],
    "severity": "medium",
    "expected_format": "`{ConstraintDescription}`"
  }
}
-->

## 10.7 `{ConstraintTitleG}`

<!--
{
  "section_contract": {
    "section_id": "10.7",
    "title": "{ConstraintTitleG}",
    "checkitems": [
      "state one explicit product constraint",
      "describe it in one short paragraph"
    ],
    "severity": "medium",
    "expected_format": "`{ConstraintDescription}`"
  }
}
-->
