# AI Meta-Agent 项目

## 背景

多数情况下，一个产品想法很难直接、低成本地落地为可运行程序。

如果能够以更低的人力和时间成本，借助 AI 从需求持续生成并维护关键产物，就可以更快验证产品想法，并在需求变化时继续迭代系统。

这个项目的目标不是单点生成代码，而是构建一个从需求出发、可持续演进、可审查、可验证的 `AI-RD-PLATFORM`。

## 产品定位

`AI-RD-PLATFORM` 用于把需求逐步转化为各阶段产物，并在需求变化后持续维护这些产物。

核心目标：

1. 降低从需求到产品产物的成本
2. 支持需求变更后的迭代更新
3. 提供可审查、可维护、可追踪的输出结果

## 目标用户

- 技术型创业者：快速验证产品想法，编写、更新、确认需求与技术产物，并最终获得程序
- 独立开发者：低成本开发和维护个人产品，在需求变化后持续更新产物
- 小型产品团队（3-5 人）：PM 负责需求编写和产品视角审查，工程师负责技术产物审查、关键代码变更确认，以及运行和测试结果把关

## 核心问题与产品能力

1. 需求通常是自然语言，存在歧义，不能直接驱动后续阶段
   - 平台将原始需求结构化为更清晰、可执行的输入
2. 从需求到设计、实现、验证的链路往往割裂
   - 平台提供端到端的连续生成工作流
3. 需求变化频繁，手工维护多阶段产物成本高
   - 平台支持基于已有产物做增量更新，而不是每次全部重建
4. AI 输出不易信任
   - 平台展示执行过程、待变更内容，并在关键修改前要求用户确认
5. 生成结果难以快速判断是否可接受
   - 平台提供基础验证与测试反馈，辅助用户继续审查或迭代

## 用户工作流

标准流程如下：

1. PM 创建或更新需求文档，并启动任务
2. 平台解析需求并准备待变更内容
3. PM 审查需求解释结果，决定继续、修改或停止
4. 平台生成或更新设计产物
5. 工程师审查设计变更，并确认是否应用
6. 平台生成或更新实现代码
7. 工程师审查代码变更，并决定接受或拒绝
8. 平台执行验证或测试，并展示结果摘要
9. PM 与工程师共同验收结果

支持从中间阶段恢复：

- 设计生成/更新
- 实现生成/更新
- 验证

失败处理原则：

- 某阶段失败后，工作流停在当前阶段
- 不自动回滚到更早阶段
- 用户需先修复当前阶段问题
- 修复后从当前阶段重试

## 输入与输出

输入：

- 需求文档
- 项目目录

前置条件：

- 目标项目存放在 Git 仓库中

主要输出：

- 更新后的需求文档
- 更新后的设计产物
- 更新后的代码产物
- 支持场景下的可运行程序
- 验证或测试结果
- 工作流阶段信息与待变更摘要

## 项目结构

- `meta_layer`
  - `docs/design_docs/`
    - 架构、工作流、Execution、Contract、Interface、SDK 等设计文档
  - `resources/template/`
    - 各阶段生成模板
  - `resources/contract/`
    - 各阶段 contract / 模板约束
- `project_layer`
  - `projects/sdlc/`
    - 当前主要实现工程
  - `docs/`
    - 协作规范、执行计划

## 当前实现范围

当前版本对应 `Requirement.md` 中的 `V1: MVP` 目标，聚焦通过 CLI 跑通从需求到可运行 Demo 的标准流程。

当前 `project_layer/projects/sdlc` 已实现的主线阶段：

1. `requirement_interpretation`
2. `architecture_design`
3. `module_design`
4. `implementation_plan`
5. `validation`

当前范围特征：

- 通过 CLI 执行任务与阶段恢复
- 展示关键阶段信息和待变更内容
- 支持已验证 Demo 场景：Travel Planning Agent

当前非目标：

- 不提供 UI 化审查体验
- 不支持多种项目类型
- 不保证每一步都有完整、可直接审查的中间产物

## 测试组织

`project_layer/projects/sdlc/tests/` 已按功能和 stage 分组：

- `shared/`
- `workflow/`
- `requirement/`
- `architecture/`
- `module-design/`
- `implementation-plan/`
- `implementation-execution/`
- `validation/`

根目录只保留：

- `run-tests.ts`
- `cli.test.ts`

## 运行测试

在 `project_layer/projects/sdlc` 下执行：

```bash
npm test
```

该命令会先构建：

- `project_layer/projects/sdlc`
- `project_layer/projects/agent_runtime`

然后执行 `tests/run-tests.ts` 聚合测试入口。

## 关键文档

- 中文执行计划：
  - [project_layer/docs/CodeGenerationExecutionPlan.md](./project_layer/docs/CodeGenerationExecutionPlan.md)
- 协作规范：
  - [project_layer/docs/COLLABORATION_STANDARD.md](./project_layer/docs/COLLABORATION_STANDARD.md)
- 工作流设计：
  - [meta_layer/docs/design_docs/Workflow/Pipeline.md](./meta_layer/docs/design_docs/Workflow/Pipeline.md)
  - [meta_layer/docs/design_docs/Workflow/StageRunners.md](./meta_layer/docs/design_docs/Workflow/StageRunners.md)
