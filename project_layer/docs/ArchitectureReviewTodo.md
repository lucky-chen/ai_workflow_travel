# Architecture Review Todo

## 1. Compose-run Scope And Current-Version Boundary

- status: decided
- priority: high
- problem:
  - `compose-run` 已经作为正式 runtime mode 出现在需求文档、架构文档和 `runtime_design.md` 中。
  - 但当前版本实际只明确了 `Runtime -> Orchestrator` 的轻量入口和简单调度，并没有完成复杂编排设计。
  - 现有文档仍容易让读者理解成“标准 compose-run 主链路已经属于当前实现范围”。
- affected documents:
  - [Requirement.md](/Users/chen/Documents/workspace/ai/mvp/project_layer/docs/Requirement.md)
  - [TechnicalArchitecture.md](/Users/chen/Documents/workspace/ai/mvp/project_layer/docs/TechnicalArchitecture.md)
  - [runtime_design.md](/Users/chen/Documents/workspace/ai/mvp/project_layer/docs/breakdown_docs/runtime_design.md)
- impact:
  - 计划生成容易把完整 compose-run 当成当前实现目标。
  - 代码生成容易直接落整条 orchestration 主链路。
- review decision:
  - `compose-run` 当前明确为“入口和能力预留”。
  - 当前版本只实现 `Runtime -> Orchestrator` 的轻量 dispatch 和 continuation 边界。
  - 完整多步 orchestration 仍是未来工作，不应在当前版本文档中被表述为已完整实现。

## 2. RuntimeContext Source And Assembly Path

- status: decided
- priority: high
- problem:
  - `RuntimeContext` 已定义 `runId`、`workDir`、`templateRoot`、`specRoot`、`artifactRoot`、`recordRoot` 等字段。
  - 但文档没有明确这些字段由谁构造、何时注入、从哪里读取。
  - 也没有明确 `CliEntry`、`init`、环境变量、配置文件之间的职责分配。
- affected documents:
  - [runtime_design.md](/Users/chen/Documents/workspace/ai/mvp/project_layer/docs/breakdown_docs/runtime_design.md)
  - [cli_entry_design.md](/Users/chen/Documents/workspace/ai/mvp/project_layer/docs/breakdown_docs/cli_entry_design.md)
- impact:
  - 计划生成缺运行前置配置步骤。
  - 代码生成不知道 runtime config 应落在哪个模块。
- review decision:
  - `workDir` 必须通过 CLI/runtime 参数传入。
  - `runId` 优先使用 CLI/runtime 参数；若未提供，则由 `CliEntry` 在入口阶段生成。
  - 其它运行字段从 `workDir/sdlc/local_env.json` 读取。
  - `RuntimeContext` 必须在入口阶段装配完成，然后再交给 `Runtime`。

## 3. ArtifactStore Ownership Boundary

- status: decided
- priority: high
- problem:
  - 文档目前已统一写成“每个 unit 在结束阶段把自己的输出写入 `ArtifactStore`”。
  - 但 unit 的主时序图、store 协作边界、API 返回边界还没有完全闭合。
  - 当前仍不够清楚：
    - 是 unit 内直接调用 `ArtifactStore`
    - 还是 runtime wrapper 在 unit 返回后统一调用 `ArtifactStore`
- affected documents:
  - [requirement_design.md](/Users/chen/Documents/workspace/ai/mvp/project_layer/docs/breakdown_docs/requirement_design.md)
  - [architecture_design.md](/Users/chen/Documents/workspace/ai/mvp/project_layer/docs/breakdown_docs/architecture_design.md)
  - [item_design.md](/Users/chen/Documents/workspace/ai/mvp/project_layer/docs/breakdown_docs/item_design.md)
  - [overall_design_contract_design.md](/Users/chen/Documents/workspace/ai/mvp/project_layer/docs/breakdown_docs/overall_design_contract_design.md)
  - [work_design.md](/Users/chen/Documents/workspace/ai/mvp/project_layer/docs/breakdown_docs/work_design.md)
  - [work_execute.md](/Users/chen/Documents/workspace/ai/mvp/project_layer/docs/breakdown_docs/work_execute.md)
  - [data_store_design.md](/Users/chen/Documents/workspace/ai/mvp/project_layer/docs/breakdown_docs/data_store_design.md)
- impact:
  - 代码生成会在持久化边界上分叉。
  - 容易出现重复写入或漏写入。
- review decision:
  - 唯一 ownership 固定为“unit 内直接调用 `ArtifactStore`”。
  - `Runtime` / `Orchestrator` 不负责在 unit 返回后再补做 artifact 落库。
  - generated artifact、update prompt/action、contract result、execution-related artifact 都按同一 ownership 规则处理。

## 4. External Action Protocol For Update And WorkExecute

- status: decided
- priority: high
- problem:
  - `requirement/architecture/item/work_plan update` 与 `work_execute` 都采用 `prompt + action` 模式。
  - 但目前没有统一的 external action protocol。
  - 缺少共享边界：
    - action 最小字段
    - 外部执行结果格式
    - 外部失败结果格式
    - 外部返回内容如何再次进入 contract/gate/store
- affected documents:
  - [requirement_design.md](/Users/chen/Documents/workspace/ai/mvp/project_layer/docs/breakdown_docs/requirement_design.md)
  - [architecture_design.md](/Users/chen/Documents/workspace/ai/mvp/project_layer/docs/breakdown_docs/architecture_design.md)
  - [item_design.md](/Users/chen/Documents/workspace/ai/mvp/project_layer/docs/breakdown_docs/item_design.md)
  - [work_design.md](/Users/chen/Documents/workspace/ai/mvp/project_layer/docs/breakdown_docs/work_design.md)
  - [work_execute.md](/Users/chen/Documents/workspace/ai/mvp/project_layer/docs/breakdown_docs/work_execute.md)
  - [runtime_design.md](/Users/chen/Documents/workspace/ai/mvp/project_layer/docs/breakdown_docs/runtime_design.md)
- impact:
  - 计划生成和代码生成会各自定义 action schema。
  - 外部能力接入点容易不一致。
- review decision:
  - 统一的 external action protocol 写入 `runtime_design.md`。
  - `update` 与 `work_execute` 共用一套 `ExternalAction` / `ExternalActionResult` 边界。
  - 共享最小字段固定为 `tool`、`operation`、`targetPath`，并允许附加 `payload`。
  - 外部执行完成后必须返回统一 `ExternalActionResult`，再进入后续 contract、gate、store 或 continuation 逻辑。

## 5. Gate Review Input Schema

- status: decided
- priority: medium
- problem:
  - `checked_change_set` 已经有较明确的 `changes/diff/old/new` 结构。
  - 但 `contract_result` 和 `validation_result` 的 review 内容仍较弱。
  - 当前 `GateInput.reviewSubject` 对不同 review 类型的输入结构不够统一。
- affected documents:
  - [quality_control_design.md](/Users/chen/Documents/workspace/ai/mvp/project_layer/docs/breakdown_docs/quality_control_design.md)
- impact:
  - Gate 实现时容易出现大量临时拼装。
  - 代码生成时很难形成统一 review input schema。
- review decision:
  - `GateInput.reviewSubject` 统一为一套 shared review schema。
  - 共享字段为 `type`、`summary`、`entries`。
  - `entries` 作为统一 review 内容数组：
    - `contract_result` 使用 `summary` 和可选 `payload`
    - `validation_result` 使用 `summary` 和可选 `payload`
    - `checked_change_set` 使用 `path`、`diff`、可选 `old/new`
  - `Gate` 一律基于 `reviewSubject.entries` 做 review，不再为不同 review 类型维护分裂输入结构。

## Review Decision Suggestion

- First pass:
  - item 1
  - item 2
  - item 3
- Second pass:
  - item 4
  - item 5
