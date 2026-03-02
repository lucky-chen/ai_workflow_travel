# Technical Architecture

## 1. Purpose

<!-- TEMPLATE_GUIDANCE_START
Writing Hints:
- State the purpose of this document in one short sentence.
- List the main readers and why they should read it.
- Keep the content at overall architecture level.
TEMPLATE_GUIDANCE_END -->

Define the overall technical architecture of the AI-RD platform.

- Teammbers: provide a shared high-level baseline for the team.
- Senior engineers: review architecture direction and boundaries.
- Junior engineers: understand system and module structure for later design and implementation.


## 2. Scope

<!-- TEMPLATE_GUIDANCE_START
Goal:
Define the boundary of the architecture so the document stays focused and does not expand into detailed implementation prematurely.

Writing Hints:
- Define what this document covers.
- Define what this document does not cover.
- Clarify the boundary between overall architecture and module design.
TEMPLATE_GUIDANCE_END -->

### 2.1 In Scope
- Overall workflow from requirement input to design generation, implementation generation, review, validation, and acceptance.
- Major modules and their responsibilities at architecture level.
- Collaboration boundaries and dependency direction between major parts of the system.
- Key architecture constraints related to reviewability, controllability, validation, and evolution.

### 2.2 Out of Scope
- Detailed module internals and implementation logic.
- Detailed API contracts, prompt content, and parameter definitions.
- Database schema details and storage-level design.
- UI-level interaction design and visual behavior details.
- Deployment runbooks, environment setup, and operational procedures.

---

## 3. Design Drivers

<!-- TEMPLATE_GUIDANCE_START
Goal:
Capture the major drivers that materially shape the architecture and justify the core design choices.

Writing Hints:
- Focus only on drivers that affect architecture decisions.
- Include both functional and non-functional drivers where relevant.
- Avoid generic statements that do not influence structure.
TEMPLATE_GUIDANCE_END -->

<!-- TEMPLATE_PLACEHOLDER_START
- [Functional driver]
- [Non-functional driver]
- [Operational or delivery constraint]
- [Governance or control requirement]
- [Important assumption that shapes the design]
TEMPLATE_PLACEHOLDER_END -->

---

### 3.1 end-to-end work-flow support
The architecture must supprt the full folw from requirement input to desing generation、implementation generation, review, validation adn acceptance

### 3.2 requirement interpretation as stable upstream input
As raw requirement is written by nature-language which is hard to use by downstream stages as stable input. So the architecture need a requirement interpretation stage and check whether the raw requirement doc is stable

### 3.3 design doc interpretation as stable upstream input

As raw design doc is generate by AI which is hard to use by downstream stages as stable input. So the architecture need a design doc interpretation stage and check whether the design doc is stable

### 3.4 hunman-in-loop control
Important changes must remain human reviewable and require users to confirm. So the architecture needs explict review and apply point

### 3.5 Validation visibility
The system must provide validation or test feedback for generated outputs, so validation needs to be a first-class part of the workflow

### 3.6 Evolation form cli to UI
CLI-first, while later versions add UI-based workflow support, so the architecture should separate core workflow logic from interface-specific layers.

### 3.7 execution transparency and stage traceability
Users need to understand what the platform is doing at each stage, so the architecture should make execution process, stage status, and important changes visible and traceable.

### 3.8 incremental update on requirement changes
requirements change is frequency, so the architecture should support compare the changes between different version and generage new changes to downstream stages.

### 3.9 Stage-level resumability
The architecture should support stage-level resumability as a core capability based on clear stage inputs, outputs, and state, so users can start from a selected intermediate stage when the required inputs are available, and the workflow can recover from stage failure without rerunning the whole workflow.

# 4. Architecture Design

<!-- TEMPLATE_GUIDANCE_START
Goal:
Describe the overall architecture of the system, including its high-level structure, design style, and dependency boundaries.

Writing Hints:
- Start from the overall architectural approach.
- Describe how the system is partitioned or layered.
- Explain dependency direction and structural constraints.
- Include one high-level diagram.
TEMPLATE_GUIDANCE_END -->

### 4.1 Overview
<!-- TEMPLATE_PLACEHOLDER: [Provide a concise summary of the architecture.] -->

### 4.2 Architecture Style
<!-- TEMPLATE_PLACEHOLDER: [Describe the overall architectural style, such as layered, event-driven, modular monolith, service-oriented, or hybrid.] -->

### 4.3 Layers or Partitions
<!-- TEMPLATE_PLACEHOLDER_START
- [Layer / Partition 1]: [Responsibility]
- [Layer / Partition 2]: [Responsibility]
- [Layer / Partition 3]: [Responsibility]
TEMPLATE_PLACEHOLDER_END -->

### 4.4 Dependency Rules
<!-- TEMPLATE_PLACEHOLDER_START
- [Describe allowed dependency direction]
- [Describe forbidden dependency relationships]
- [Describe important structural constraints]
TEMPLATE_PLACEHOLDER_END -->

### 4.5 High-level Diagram
```text
[TEMPLATE_PLACEHOLDER: Insert high-level architecture diagram here]
```

---

## 5. Module Collaboration

<!-- TEMPLATE_GUIDANCE_START
Goal:
Explain how the core modules work together to support the main system flow.

Writing Hints:
- List only the major modules needed to explain the architecture.
- Focus on collaboration and flow, not module internals.
- Make the main execution or request path explicit.
- Identify review, approval, validation, or control points where relevant.
TEMPLATE_GUIDANCE_END -->

### 5.1 Core Modules
<!-- TEMPLATE_PLACEHOLDER_START
- [Module A]: [High-level responsibility]
- [Module B]: [High-level responsibility]
- [Module C]: [High-level responsibility]
- [Module D]: [High-level responsibility]
TEMPLATE_PLACEHOLDER_END -->

### 5.2 Interaction Model
<!-- TEMPLATE_PLACEHOLDER: [Explain how the modules collaborate at a high level.] -->

### 5.3 Main Flow
<!-- TEMPLATE_PLACEHOLDER_START
1. [Step 1]
2. [Step 2]
3. [Step 3]
4. [Step 4]
TEMPLATE_PLACEHOLDER_END -->

### 5.4 Key Control Points
<!-- TEMPLATE_PLACEHOLDER_START
- [Review point]
- [Approval point]
- [State transition point]
- [Validation point]
TEMPLATE_PLACEHOLDER_END -->

---

## 6. Quality Attributes

<!-- TEMPLATE_GUIDANCE_START
Goal:
Describe the quality attributes that materially affect the architecture.

Writing Hints:
- Include only quality attributes that materially shape the design.
- Add or remove subsections as needed.
- For each attribute, state why it matters and how the architecture supports it.
TEMPLATE_GUIDANCE_END -->

<!-- TEMPLATE_GUIDANCE_START
Suggested candidates:
- Reliability
- Availability
- Scalability
- Security
- Observability
- Traceability
- Operability
- Extensibility
TEMPLATE_GUIDANCE_END -->

<!-- TEMPLATE_PLACEHOLDER_START
### 6.x [Quality Attribute Name]
- Why it matters:
- Architectural support:

### 6.x [Quality Attribute Name]
- Why it matters:
- Architectural support:

### 6.x [Quality Attribute Name]
- Why it matters:
- Architectural support:
TEMPLATE_PLACEHOLDER_END -->

---

## 7. Evolution Strategy

<!-- TEMPLATE_GUIDANCE_START
Goal:
Describe how the architecture can evolve over time while preserving core consistency.

Writing Hints:
- Distinguish between stable foundation and future extension points.
- Focus on how the architecture can absorb future change.
- Keep this section at architectural level rather than implementation roadmap detail.
TEMPLATE_GUIDANCE_END -->

### 7.1 Current Baseline
<!-- TEMPLATE_PLACEHOLDER: [Describe the current architectural baseline.] -->

### 7.2 Stable Core
<!-- TEMPLATE_PLACEHOLDER: [Describe what should remain stable as the system evolves.] -->

### 7.3 Extension Points
<!-- TEMPLATE_PLACEHOLDER: [Describe where change or extension is expected.] -->

### 7.4 Evolution Direction
<!-- TEMPLATE_PLACEHOLDER_START
- [Evolution direction 1]
- [Evolution direction 2]
- [Evolution direction 3]
TEMPLATE_PLACEHOLDER_END -->

---

## 8. Module Design Decomposition

<!-- TEMPLATE_GUIDANCE_START
Goal:
Define how the architecture should be broken down into follow-up module design documents.

Writing Hints:
- Keep this section lightweight.
- Focus on decomposition strategy rather than module internals.
- Clarify how later design documents relate back to this architecture.
TEMPLATE_GUIDANCE_END -->

### 8.1 Decomposition Principle
<!-- TEMPLATE_PLACEHOLDER: [Explain how detailed module design documents are divided.] -->

### 8.2 Suggested Module Design Documents
<!-- TEMPLATE_PLACEHOLDER_START
- [Module Design A]: [Scope]
- [Module Design B]: [Scope]
- [Module Design C]: [Scope]
- [Module Design D]: [Scope]
TEMPLATE_PLACEHOLDER_END -->

### 8.3 Relationship to This Document
<!-- TEMPLATE_PLACEHOLDER: [Explain that this document defines overall structure, boundaries, and key design decisions, while module design documents define the detailed solution within those constraints.] -->

---

## 9. Open Issues

<!-- TEMPLATE_GUIDANCE_START
Goal:
Record unresolved questions, risks, or assumptions that still require clarification.

Writing Hints:
- Include only unresolved items that may affect architecture decisions.
- Separate real open issues from minor implementation details.
- Make assumptions explicit where needed.
TEMPLATE_GUIDANCE_END -->

<!-- TEMPLATE_PLACEHOLDER_START
- [Open issue 1]
- [Open issue 2]
- [Risk or assumption 1]
TEMPLATE_PLACEHOLDER_END -->

---

## 10. Summary

<!-- TEMPLATE_GUIDANCE_START
Goal:
Summarize the architecture direction and reaffirm the role of this document.

Writing Hints:
- Keep this section short.
- Restate the architecture direction clearly.
- Explain how this document should guide subsequent design work.

Placeholder:
[Summarize the architecture direction, key structural characteristics, and the role of this document in guiding later module-level design.]
TEMPLATE_GUIDANCE_END -->
