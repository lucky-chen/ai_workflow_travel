# AI_META Project

# Purpose

1. Exploring and understanding what AI is

   1.1 Explore AI principles and capability boundaries: AI is fundamentally a probabilistic model. It is powerful, but it also produces hallucinations.

   1.2 Understand the practical engineering capabilities around AI, including prompt, agent, context, and mcp.

   1.3 Understand industry practice and experience in real-world AI adoption.

2. Inferring how to collaborate with AI based on its characteristics

   2.1 At a high level, the key is improving the ability to recognize needs and break problems down, which means turning uncertain needs into more concrete and deterministic problems step by step. AI performs very well on small deterministic problems, but when facing large highly uncertain problems, it often lacks clear direction and the process and outcome can easily go out of control.

   2.2 Taking software engineers as an example, the center of gravity should shift more toward exploring product needs and turning them into architecture design, module design, and executable task breakdowns. For the smaller concrete tasks after decomposition, AI can often generate good code, while engineers focus on review and quality control.

3. Validating the theory and exploration in practice

   3.1 Use the software development lifecycle project `sdlc` to validate the methodological inference in 2.2, and continue turning the verified norms into tools.

   3.2 Use a user-oriented Travel product to validate the importance of identifying uncertain needs. High-ROI needs are often hidden in places with many people, complex scenarios, dense problems, and high uncertainty at the start, which is also where AI currently fails most easily.

> Summary: AI is more like a group of very capable but not fully controllable racehorses. The key is not to rely on it blindly, but to first define the goal, path, and constraints, then direct it toward the result.

## What This Repository Contains

This repository is the working space used to explore and validate the three purposes above.

The projects in this repository should not be read as isolated products with unrelated goals. They are practical carriers used to validate Purpose 3 from different angles:

- `sdlc`: the main workflow project used to validate whether AI can support a staged delivery workflow from requirement to design, implementation, and validation.
- `AI Travel`: the main real product exploration project used to validate whether the collaboration model and engineering approach can work in a real product scenario.
- `AgentRuntime`: the shared runtime foundation used to validate the reusable runtime capabilities needed by agent-style projects.
- `hello-service`: the lightweight validation project used to check whether the workflow can run end to end on a smaller and easier-to-debug sample.

The detailed project descriptions below keep the current structure as a working reference while making the repository easier to understand for new readers.

## Start Here

Choose your entry point based on what you want to understand first:

- If you want to understand the workflow and engineering method first, start with `sdlc`.
- If you want to understand how the method is applied in a real product scenario, start with `AI Travel`.

If you prefer a recommended reading order, read:

1. This `README.md`: understand the purpose of the repository and the role of each project.
2. [Requirement document](./meta_layer/docs/Requirement.md): understand the target problem, workflow, and expected capability boundary.
3. [Architecture document](./meta_layer/docs/TechnicalArchitecture.md): understand the technical structure and stage flow.
4. [Code generation execution plan](./infra_projects/docs/CodeGenerationExecutionPlan.md): understand the current implementation scope and progress.

# Roadmap

- `infra_projects/projects/sdlc`
  - [x] Workflow stage flow
  - [x] CLI-based stage launch and task execution
  - [x] Requirement, architecture, module design, implementation plan, implementation execution, and validation stages
  - [x] richer CLI interaction flow
- `infra_projects/projects/agent_runtime`
  - [x] AgentRuntime V1 single-turn execution foundation
  - [x] Agent abstraction, runtime execution loop, and trace integration
  - [ ] AgentRuntime V2 memory support
  - [ ] AgentRuntime-managed multi-turn continuation
- `hello-service`
  - [x] baseline capability black-box test
  - [x] llm call chain black-box test
  - [ ] validate complete SDLC capability with hello-service
- `AI Travel`
  - [x] document authoring, generation, and review
  - [ ] code generation
  - [ ] functionality verification

# Projects

## sdlc

### Overview

- Role: the main workflow project in the repository.
- Purpose: explore whether AI can carry work across staged engineering artifacts, from requirement analysis to architecture, module design, implementation planning, implementation, and validation.
- Primary users:
  - Product builders who want to validate ideas quickly and continuously maintain requirements and technical artifacts.
  - Indie developers who want to develop and maintain products while keeping requirements and technical artifacts updated.
  - Small product teams that need collaboration across PM and engineering roles for requirement writing, design review, code review, and final acceptance.
- Repository context: one of the main practice carriers for Purpose 3, focusing on validating the delivery workflow itself.

### Problems and Capabilities

- [Requirements are not directly actionable]
  - Problem: users write requirements in natural language, which is often ambiguous and cannot directly drive downstream stages.
  - Capability: structure raw requirements into clearer and more actionable inputs for downstream stages.

- [The path from requirement to outputs is disconnected]
  - Problem: users have to bridge requirements, design, coding, review, testing, and updates by themselves, which is costly and inefficient.
  - Capability: provide a staged workflow from requirements to design, implementation, and validation so key artifacts are carried forward continuously.

- [Requirement changes are costly]
  - Problem: once requirements change, users often have to manually update artifacts across multiple stages, which is slow and error-prone.
  - Capability: support incremental updates on top of existing artifacts instead of rebuilding the whole chain from scratch.

- [AI assistance is hard to trust]
  - Problem: users often cannot clearly tell what the AI is doing, what it plans to change, or whether the result is safe to apply.
  - Capability: show execution progress, generated outputs, and pending changes, and wait for user confirmation before important modifications are applied.

- [Generated results are hard to evaluate]
  - Problem: even with outputs in hand, users cannot quickly judge whether the result is acceptable, maintainable, or ready for further iteration.
  - Capability: produce outputs that are more reviewable, maintainable, and traceable.

### Core Docs

- Read these first before requirement analysis, architecture work, module design work, or code generation.
- [Requirement document](./meta_layer/docs/Requirement.md): product requirement baseline, scope, user workflow, and target capability definition.
- [Architecture document](./meta_layer/docs/TechnicalArchitecture.md): end-to-end technical architecture, stage flow, module responsibilities, and runtime collaboration model.
- [Module design documents](./meta_layer/docs/design_docs/): current design-doc directory referenced as `module_desig` in discussions, covering workflow, execution, contract, interface, SDK, data, and quality-gate details.
- [Code generation execution plan](./infra_projects/docs/CodeGenerationExecutionPlan.md): implementation delivery plan, batch breakdown, execution status, and completion tracking.
- [Collaboration standard](./meta_layer/resources/COLLABORATION_STANDARD.md): collaboration rules for change plans, batch boundaries, validation, and commit requirements.

### Usage Entry

- CLI entry: `infra_projects/projects/sdlc/src/interface/cli/cli.ts`
- Quick start:

```bash
init --workspace /path/to/workspace
generate --stage architecture_design --workspace /path/to/workspace
generate --stage module_design --workspace /path/to/workspace --target-module Workflow
```

## AgentRuntime

### Overview

- Role: the shared runtime foundation for agent-based projects in the repository.
- Purpose: support reusable execution flow, runtime abstractions, state handling, and test support so each project does not need to rebuild the same runtime base.
- Primary users:
  - Runtime developers who implement and maintain the shared execution foundation.
  - Project teams using AgentRuntime who want to reuse runtime capabilities instead of rebuilding infrastructure.
- Repository context: a supporting practice carrier for Purpose 3, focused on reusable runtime foundations needed by agent-style projects.

### Problems and Capabilities

- [Repeated foundation work]
  - Problem: different agent projects often reimplement execution loops, runtime abstractions, and test support from scratch.
  - Capability: provide shared single-turn execution foundations so projects do not have to rebuild the runtime base repeatedly.

- [Inconsistent runtime behavior]
  - Problem: without a shared runtime, execution models, interface constraints, and test patterns drift across projects.
  - Capability: provide common agent abstractions, runtime loops, and interface constraints so projects evolve on the same runtime model.

- [High evolution cost]
  - Problem: once runtime capabilities need to change, multiple projects have to be updated separately.
  - Capability: centralize runtime capabilities and test support so multiple projects can evolve with lower maintenance cost.

### Core Docs

- No standalone design-doc set is listed for AgentRuntime in the current repository root README.
- Primary workspace: [infra_projects/projects/agent_runtime/](./infra_projects/projects/agent_runtime/)

### Usage Entry

- Workspace: `infra_projects/projects/agent_runtime/`
- Run tests: `npm test`
- Build: `npm run build`

## AI Travel

### Overview

- Role: the main real product exploration project in the repository.
- Purpose: validate whether the collaboration model, artifact structure, and engineering process explored in this repository can work in a real product scenario.
- Primary users:
  - Independent travelers who already know their destination but still lack a complete usable itinerary.
  - Travelers who already have a plan but want continuous assistance during the trip.
  - Users who want a lightweight summary and record organization after the trip.
  - Small-group travelers in an extended 2-to-4-person scenario.
- Repository context: one of the main practice carriers for Purpose 3, focused on validating the method in an actual product context.

### Problems and Capabilities

- [Scattered information]
  - Problem: destination, transport, lodging, dining, booking, records, and media are spread across different tools, so users have to reconnect them manually.
  - Capability: organize planning, in-trip, and record-related information around the same trip so users do not have to keep switching tools.

- [High planning cost]
  - Problem: users need to combine scattered information into a route that is practical, well-paced, and budget-aware, which is costly and easy to miss details.
  - Capability: turn vague travel needs into usable outputs such as daily itineraries, budget guidance, to-dos, and booking suggestions.

- [Weak in-trip continuity]
  - Problem: once the trip starts, the original plan often remains a static artifact and does not carry changes, records, and execution entry points well.
  - Capability: show the current plan, record changes, provide suggestions, and organize execution entry points during the trip around one current effective plan.

- [Poor post-trip organization]
  - Problem: after the trip, spending, visited places, plan changes, and media references remain scattered across apps and are hard to review.
  - Capability: aggregate key records, spending, places, and media references into a lightweight summary that can be reviewed later.

### Core Docs

- Requirement document: [user_projects/TravelAi/sdlc/docs/Requirement.md](./user_projects/TravelAi/sdlc/docs/Requirement.md)
- Primary workspaces: [user_projects/TravelAi/](./user_projects/TravelAi/), [user_projects/ai_travel/](./user_projects/ai_travel/)
- Current visible project files are mainly under the TravelAi `sdlc/` workspace.

### Usage Entry

- Workspaces: `user_projects/TravelAi/`, `user_projects/ai_travel/`
- Current usage is requirement, architecture, and module design work under the TravelAi `sdlc/` workspace
- No unified runnable entry is defined yet

## hello-service

### Overview

- Role: the lightweight validation sample project in the repository.
- Purpose: check whether the SDLC workflow can actually run end to end on a small and understandable target before relying on more complex real projects.
- Primary users:
  - SDLC capability validators who want to verify whether the workflow is usable.
  - Engineers who use it for black-box tests, scripted checks, and end-to-end validation.
- Repository context: a supporting practice carrier for Purpose 3, focused on smaller-scope validation and easier issue isolation.

### Problems and Capabilities

- [Validation target too heavy]
  - Problem: using only complex projects makes workflow debugging and issue isolation expensive.
  - Capability: provide a lightweight sample project so workflow capabilities can be checked in a smaller and faster loop.

- [Insufficient black-box validation]
  - Problem: without a stable sample project, it is hard to repeatedly verify whether the workflow can produce runnable outputs.
  - Capability: provide baseline black-box tests, LLM call-chain tests, and scripted validation entry points.

- [Difficult issue isolation]
  - Problem: problems across requirements, design, implementation, and runtime can get mixed together and become hard to diagnose.
  - Capability: use a smaller project and explicit scripts to narrow down whether issues come from workflow, generation, or runtime behavior.

### Core Docs

- No standalone root-level design-doc set is defined for this sample project.
- Primary workspace: [user_projects/hello-service/](./user_projects/hello-service/)

### Usage Entry

- Workspace: `user_projects/hello-service/`
- Run tests: `npm test`
- Test scripts live under `user_projects/hello-service/scripts/`

# Core Collaboration Documents

- Read these documents first before requirement analysis, architecture work, module design work, or code generation.
- [Requirement document](./meta_layer/docs/Requirement.md): product requirement baseline, scope, user workflow, and target capability definition.
- [Architecture document](./meta_layer/docs/TechnicalArchitecture.md): end-to-end technical architecture, stage flow, module responsibilities, and runtime collaboration model.
- [Module design documents](./meta_layer/docs/design_docs/): current design-doc directory referenced as `module_desig` in discussions, covering workflow, execution, contract, interface, SDK, data, and quality-gate details.
- [Code generation execution plan](./infra_projects/docs/CodeGenerationExecutionPlan.md): implementation delivery plan, batch breakdown, execution status, and completion tracking.
- [Collaboration standard](./meta_layer/resources/COLLABORATION_STANDARD.md): collaboration rules for change plans, batch boundaries, validation, and commit requirements.

# Inputs and Outputs

Inputs:
- requirement document
- project directory

Prerequisite:
- the target project must be stored in a Git repository

Outputs:
- updated requirement document
- updated design artifacts
- updated code artifacts
- runnable program output for supported scenarios
- validation or test results
- workflow stage information and pending change summaries

# Run Tests

- Run the following in `infra_projects/projects/sdlc`:

```bash
npm test
```
