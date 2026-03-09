# AI Meta-Agent 项目

## 核心协作文档

在进行需求分析、架构设计、模块设计或代码生成之前，请优先阅读以下文档：

- [需求文档](./meta_layer/docs/Requirement.md)：
  - 定义产品需求基线、范围、用户工作流和目标能力
- [架构文档](./meta_layer/docs/TechnicalArchitecture.md)：
  - 定义端到端技术架构、阶段流转、模块职责和运行时协作模型
- [模块设计文档](./meta_layer/docs/design_docs/)：
  - 讨论中的 `module_desig` 当前对应设计文档目录
  - 包含 workflow、execution、contract、interface、SDK、data、quality-gate 等模块级设计
- [代码生成计划](./project_layer/docs/CodeGenerationExecutionPlan.md)：
  - 定义实现交付计划、batch 拆分、执行状态和完成跟踪
- [协作文档](./project_layer/docs/COLLABORATION_STANDARD.md)：
  - 定义变更计划、batch 边界、验证要求和 commit 规则

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

1. **PM** 创建或更新需求文档，并启动任务
2. **Platform** 解析需求并准备待变更内容
3. **PM** 审查需求解释结果，决定继续、修改或停止
4. **Platform** 生成或更新设计产物
5. **Engineer** 审查设计变更，并确认是否应用
6. **Platform** 生成或更新实现代码
7. **Engineer** 审查代码变更，并决定接受或拒绝
8. **Platform** 执行验证或测试，并展示结果摘要
9. **PM** 与 **Engineer** 共同验收结果

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
  - `docs/`：需求、架构、模块设计文档
  - `resources/`：模板与 contract 资源
- `project_layer`
  - `projects/sdlc/`：当前主实现工程
  - `projects/agent_runtime/`：共享 agent runtime 工程
  - `docs/`：协作规范与执行计划

## 里程碑

- `project_layer/projects/sdlc`
  - [x] Workflow 主线阶段流转
  - [x] 基于 CLI 的阶段启动与任务执行
  - [x] Requirement、Architecture、Module Design、Implementation Plan、Implementation Execution、Validation 阶段
  - [ ] 更丰富的 CLI 交互流程
- `project_layer/projects/agent_runtime`
  - [x] AgentRuntime V1 单轮执行基础能力
  - [x] Agent 抽象、runtime 执行循环与 trace 集成
  - [ ] AgentRuntime V2 memory support
  - [ ] AgentRuntime-managed multi-turn continuation
- `AI Travel`
  - [ ] AI Travel 端到端交付目标
  - [ ] AI Travel 输出质量与可控性提升
  - [ ] AI Travel CLI 交互优化

## 运行测试

在 `project_layer/projects/sdlc` 下执行：

```bash
npm test
```

## 使用方式

CLI 入口：`project_layer/projects/sdlc/src/interface/cli/cli.ts`

示例命令：

```bash
generate --module <stage_id> --input <input_file> --workspace <workspace_path>
```

参数说明：

- `--module`：目标 stage id
- `--input`：阶段输入文件
- `--workspace`：工作目录根路径
