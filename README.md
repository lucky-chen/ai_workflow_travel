# AI Meta-Agent Project

## Core Collaboration Documents

Read these documents first before any requirement analysis, architecture work, module design work, or code generation:

- [Requirement document](./meta_layer/docs/Requirement.md):
  - product requirement baseline, scope, user workflow, and target capability definition
- [Architecture document](./meta_layer/docs/TechnicalArchitecture.md):
  - end-to-end technical architecture, stage flow, module responsibilities, and runtime collaboration model
- [Module design documents](./meta_layer/docs/design_docs/):
  - `module_desig` in discussions refers to the current design-doc directory
  - module-level design set covering workflow, execution, contract, interface, SDK, data, and quality-gate details
- [Code generation execution plan](./project_layer/docs/CodeGenerationExecutionPlan.md):
  - implementation delivery plan, batch breakdown, execution status, and completion tracking
- [Collaboration standard](./project_layer/docs/COLLABORATION_STANDARD.md):
  - collaboration rules for change plans, batch boundaries, validation, and commit requirements

## Background

In most cases, it is difficult to turn a product idea into a runnable program directly and at low cost.

If AI can continuously generate and maintain key artifacts from requirements with lower time and staffing cost, product ideas can be validated faster and systems can keep evolving as requirements change.

This project is not just about code generation. It is an `AI-RD-PLATFORM` built to start from requirements and produce outputs that are evolvable, reviewable, and verifiable.

## Product Positioning

The `AI-RD-PLATFORM` turns requirements into stage-based artifacts and keeps those artifacts updated when requirements change.

Core goals:

1. Reduce the cost of turning requirements into product artifacts
2. Support iterative updates after requirement changes
3. Provide outputs that are reviewable, maintainable, and traceable

## Target Users

- Technical founders: validate ideas quickly, write and update requirements and technical artifacts, and get a final program
- Indie developers: build and maintain personal products at low cost, and keep artifacts updated as requirements evolve
- Small product teams (3-5 people): PMs handle requirement authoring and product-side review, while engineers review technical artifacts, confirm key code changes, and validate runtime and test results

## Core Problems and Product Abilities

1. Requirements are usually written in natural language and are not directly actionable
   - The platform structures raw requirements into clearer, more executable inputs
2. The path from requirement to design, implementation, and validation is often disconnected
   - The platform provides an end-to-end generation workflow
3. Requirement changes are frequent, and manually maintaining multi-stage artifacts is expensive
   - The platform supports incremental updates based on existing artifacts instead of rebuilding everything
4. AI output is hard to trust
   - The platform exposes execution progress and pending changes, and requires confirmation before important modifications are applied
5. Generated results are hard to evaluate quickly
   - The platform provides basic validation and test feedback to support further review and iteration

## User Workflow

Standard flow:

1. A **PM** creates or updates a requirement document and starts a task
2. The **Platform** interprets the requirement and prepares intended changes
3. The **PM** reviews the interpreted requirement result and decides whether to continue, revise, or stop
4. The **Platform** generates or updates design artifacts
5. An **Engineer** reviews design changes and confirms whether they should be applied
6. The **Platform** generates or updates implementation artifacts
7. An **Engineer** reviews code changes and decides whether to accept or reject them
8. The **Platform** runs validation or test steps and presents a result summary
9. The **PM** and **Engineer** accept the result together

## Inputs and Outputs

Inputs:

- requirement document
- project directory

Prerequisite:

- the target project must be stored in a Git repository

Main outputs:

- updated requirement document
- updated design artifacts
- updated code artifacts
- runnable program output for supported scenarios
- validation or test results
- workflow stage information and pending change summaries

## Project Structure

- `meta_layer`
  - `docs/`: requirement, architecture, and module design documents
  - `resources/`: templates and contract resources
- `project_layer`
  - `projects/sdlc/`: current primary implementation project
  - `projects/agent_runtime/`: shared agent runtime project
  - `docs/`: collaboration standards and execution plans

## Roadmap

- `project_layer/projects/sdlc`
  - [x] Workflow stage flow
  - [x] CLI-based stage launch and task execution
  - [x] Requirement, architecture, module design, implementation plan, implementation execution, and validation stages
  - [ ] richer CLI interaction flow
- `project_layer/projects/agent_runtime`
  - [x] AgentRuntime V1 single-turn execution foundation
  - [x] Agent abstraction, runtime execution loop, and trace integration
  - [ ] AgentRuntime V2 memory support
  - [ ] AgentRuntime-managed multi-turn continuation
- `AI Travel`
  - [ ] AI Travel end-to-end delivery goal
  - [ ] AI Travel output quality and controllability improvement
  - [ ] AI Travel CLI interaction improvement

## Run Tests

Run the following in `project_layer/projects/sdlc`:

```bash
npm test
```

## Usage

CLI entry: `project_layer/projects/sdlc/src/interface/cli/cli.ts`

Example command:

```bash
generate --module <stage_id> --input <input_file> --workspace <workspace_path>
```

Arguments:

- `--module`: target stage id
- `--input`: stage input file
- `--workspace`: workspace root path
