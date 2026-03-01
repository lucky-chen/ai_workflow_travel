# 1. Background

- In most cases, it's hard to get runnable programs from an idea.
- If we could get programs developed by AI at low cost (time, staff),
- we could verify our ideas in a short time and maintain programs with AI as user requirements change.

# 2. User Scenarios

## 2.1 Technical Founders

Validate product ideas quickly, write/update/confirm requirements/technical artifacts, and get the final program.

## 2.2 Indie Developers

Develop and maintain an indie program, write/update/confirm requirements/technical artifacts, and get the final program.

## 2.3 Small Product Teams (3-5 persons)

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
An AI-RD-PLATFORM that turns requirements into artifacts, supporting users to continuously maintain outputs when requirements change.
- reduce cost of turning requirements into product outputs
- support iterative updates after requirement changes
- provide reviewable and maintainable outputs

# 4. Core Problems and Product Abilities

## 4.1 Requirements are not directly actionable
- problem: Users write requirements in natural language, which is often ambiguous and cannot be directly used by downstream stages.
- ability: The AI-RD-PLATFORM structures raw requirements into a clearer and more actionable form so they can be used by downstream stages as stable input.

## 4.2 The path from requirement to outputs is disconnected
- problem: Users often need to bridge multiple stages, such as clarification, design, coding, review, test, and update, which is costly and inefficient.
- ability: The AI-RD-PLATFORM provides an end-to-end generation flow that turns requirements into key project artifacts in a more continuous workflow.

## 4.3 Requirement changes are frequent and costly

- problem: Usually requirements change frequently. Users need to manually update multiple artifacts, which is slow and error-prone.
- ability: The AI-RD-PLATFORM supports incremental updates of important existing artifacts based on requirement changes, instead of recreating everything from scratch.

## 4.4 AI outputs are hard to trust

- problem: Sometimes AI hallucinates. Sometimes users cannot clearly understand what the AI-RD-PLATFORM is doing, how AI is thinking, what the AI-RD-PLATFORM plans to change, or whether the result is safe to apply.
- ability: The AI-RD-PLATFORM shows the execution process, generated outputs, and pending changes, and waits for users to confirm before important changes are applied.

## 4.5 Generated results are hard to evaluate

- problem: Even after final artifacts are generated, users still need a basic way to judge whether the results are acceptable.
- ability: The AI-RD-PLATFORM provides basic validation feedback so users can quickly assess whether outputs are ready for review or further iteration.

# 5. User Workflow

## 5.1 Standard Flow

### 5.1.1 Start

PM creates or updates a requirement document and launches a task in the AI-RD-PLATFORM.

### 5.1.2 Requirement Interpretation

The AI-RD-PLATFORM analyzes the requirement and prepares intended changes.

### 5.1.3. Requirement Review

PM reviews the intended changes and decides whether to continue, revise the requirement, or stop the task.

### 5.1.4. Design Generate/Update

After PM confirmation, the AI-RD-PLATFORM generates next-stage design outputs.

### 5.1.5 Design Review/Update

The engineer reviews the design changes and updates them if needed.
The AI-RD-PLATFORM applies changes after engineer confirmation.

### 5.1.6. Implementation Generation/Update

The AI-RD-PLATFORM generates or updates code artifacts based on upstream design outputs.

### 5.1.7. Change Review

The engineer reviews the generated changes and decides whether to apply or reject them.

### 5.1.8. Validation

The AI-RD-PLATFORM runs validation or test steps and presents the result summary.

### 5.1.9. Acceptance

The PM and engineer accept the result.

## 5.2 Resume Support Entry Points

Users can resume from selected intermediate stages when there is already enough confirmed context.

Supported resume entry points:
- Design Generation or Update
  Used when requirement interpretation has already been confirmed and the user wants to continue from design generation.
- Implementation Generation or Update
  Used when design outputs are already confirmed and the user wants to continue from implementation.
- Validation
  Used when code changes are already generated and the user wants to rerun validation or test steps.


## 5.3 Failure Handling

- If a workflow stage fails, the platform stops at the current stage.
- The platform does not automatically roll back to an earlier stage.
- Users should fix the issue at the current stage.
- After the issue is fixed, the workflow should retry from that stage.

# 6. Inputs and Outputs

## 6.1 Inputs

- requirement document
- project directory

## 6.2 Prerequisites
- the target project is stored in a git repository

## 6.3 Outputs

- updated requirement document
- updated design artifacts
- updated code artifacts
- runnable program output for supported scenarios
- validation or test results
- workflow stage information and pending change summaries

# 7 Scope and Non-Goals

## 7.1 V1: MVP

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

- Goals
    - provide a simple UI for viewing workflow stages and basic progress information
    - support workflow resume from selected intermediate stages through UI
    - improve output quality and controllability for the Travel Planning Agent scenario
- Non-Goals
    - no other types of project
    - no complete artifact review workflow in UI

## 7.3 V3: General
- Goals
    - provide a complete UI for progress tracking, artifact review, and workflow decision-making
    - support review of intermediate artifacts and pending changes directly in UI
    - support 3 project types beyond the initial demo scenario
    - improve consistency across requirement updates, design updates, code updates, and validation
- Non-Goals
    - no guarantee for all project types or all engineering environments
    - no support for highly complex projects in this version

#  8. Success Criteria

## 8.1 V1 

- users can start from a requirement document and complete the standard flow through CLI
- users can start the workflow from selected intermediate stages through CLI
- the platform can generate a runnable Travel Planning Agent demo from supported requirement input
- the platform shows stage progress and pending changes before important modifications are applied


## 8.2 V2
- users can see workflow stages and task progress in UI
- users can view basic output summaries and validation summaries in UI
- users can start or resume selected tasks through UI
- users still rely on CLI or manual review for deeper artifact inspection and final decisions

## 8.3 V3
- users can review key artifacts and pending changes directly in UI
- users can make accept, reject, or revise decisions in UI at important checkpoints
- users can complete the core review workflow in UI without depending on CLI for key review actions
- the platform maintains acceptable consistency across requirement, design, code, and validation outputs
- the platform supports at least three defined project types with the same core workflow

# 9. Risks

- poor requirements may reduce output quality
- generated artifacts may still contain important errors
- complex projects may reduce stability


# 10. Constraints

## 10.1 Requirement document is the primary input

The system must use the requirement document as the main input.

## 10.2 Important changes must be confirmed by users

Important changes must be reviewable and confirmable by users before they are applied.

## 10.3 Project scope constraint

The product must be designed primarily for small to medium-sized software projects, not for all project types or engineering environments.

## 10.4 Output reviewability constraint

Generated outputs must be understandable, reviewable, and traceable.

## 10.5 Validation constraint

The AI-RD-PLATFORM should provide basic validation feedback for generated outputs, but generated outputs do not replace human judgment.

## 10.6 Reviewability and controllability 

The product must expose pending changes before important modifications are applied.

## 10.7 not fully autonomous

The product must not assume fully autonomous project delivery and must require user involvement in important review and delivery decisions.
