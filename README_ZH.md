# AI_META项目

# 项目目的

1. 探索和了解 AI 是什么

   1.1 探索 AI 的原理和能力边界：AI 本质上是概率模型，能力很强，但也会产生幻觉。

   1.2 了解 AI 相关的实际工程能力，包括 prompt、agent、context、mcp 等。

   1.3 了解业界在 AI 落地上的实践情况和经验。

2. 根据 AI 特点，推论如何与 AI 协作做事

   2.1 从大方向上看，重点是提升识别需求和拆解问题的能力，也就是把不确定性需求逐步拆解为确定性问题。AI 在解决确定性的小问题上表现非常好，但在处理高不确定性的大问题时，往往方向不清，过程和结果也容易失控。

   2.2 以软件工程师为例，工作的重点应更多放在探索产品需求，以及把产品需求转化为架构设计、模块设计和可执行任务拆分上。对于拆分后的具体小任务，AI 往往能生成质量不错的代码，工程师重点做 review 和把关。

3. 在实践中验证上述理论和探索

   3.1 通过软件开发生命周期流程 `sdlc` 工程，验证 2.2 中的方法论推论，并把验证后的规范继续沉淀为工具。

   3.2 通过一个偏用户视角的 Travel 产品，验证不确定需求识别的重要性。因为高 ROI 的需求，往往就藏在人多、场景复杂、问题密集但一开始又高度未知的地方，而这也正是 AI 当前最容易失效的区域。

> 总结：AI 更像一批能力很强但不完全受控的汗血宝马。重点不是单纯依赖它，而是先明确目标、路径和约束，再去驾驭它，最终拿到结果。

## 这个仓库包含什么

这个仓库用于围绕上述三个目的持续探索和验证。

这些项目不应被理解为彼此无关的孤立产品。它们是围绕 `Purpose 3` 从不同角度展开验证的实践载体，当前目录结构与项目职责如下：

- `infra_projects/`：共享基础设施与工作流工程。
  - `sdlc`
    - 功能说明：主工作流项目，用来验证 AI 是否能支持从需求到设计、实现、验证的阶段化交付工作流。
    - 相关文档：[需求文档](./infra_projects/docs/Requirement.md)、[架构文档](./infra_projects/docs/TechnicalArchitecture.md)、[模块设计目录](./infra_projects/docs/breakdown_docs/)、[work_plan](./infra_projects/docs/work_plan.yaml)
  - `agent_runtime`
    - 功能说明：共享运行时基础项目，用来验证 agent 类项目所需的可复用运行时能力。
    - 相关文档：[agent_runtime_design](./infra_projects/docs/breakdown_docs/agent_runtime_design.md)
- `user_projects/`：面向用户或具体场景的项目。
  - `TravelAi`
    - 功能说明：主真实产品探索项目，用来验证这套协作方式和工程方法是否能在真实产品场景中成立。
    - 相关文档：[需求文档](./user_projects/TravelAi/sdlc/docs/Requirement.md)、[架构文档](./user_projects/TravelAi/sdlc/docs/TechnicalArchitecture.md)、[模块设计目录](./user_projects/TravelAi/sdlc/docs/module_design/)
  - `travel-planner`
    - 功能说明：基于 skill 执行的轻量版 AI Travel 能力探索项目，用来验证旅行数据查询、行程拼装和约束校验。
  - `hello-service`
    - 功能说明：轻量验证项目，用来检查这套工作流是否能在更小、更容易定位问题的样例项目上跑通。
- `meta_layer/`：仓库级需求、架构和协作规范文档。

下面会继续展开各项目的具体说明。

# 里程碑

- `infra_projects/projects/sdlc`
  - [x] 输出 PRD，并支持基于已有 PRD 做增量更新
  - [x] 输出系统设计与模块设计文档，并维护文档一致性
  - [x] 生成可执行代码、脚本与工程改动，并落到目标工作区
  - [x] 执行测试、校验结果并生成验证结论
- `infra_projects/projects/agent_runtime`
  - [x] AgentRuntime V1 单轮执行基础能力
  - [x] Agent 抽象、runtime 执行循环与 trace 集成
  - [ ] AgentRuntime V2 memory support
  - [ ] AgentRuntime-managed multi-turn continuation
- `user_projects/hello-service`
  - [x] 基线能力黑盒测试
  - [x] LLM 调用链路黑盒测试
  - [ ] 用 hello-service 验证完备的 SDLC 能力
- `user_projects/travel-planner`
  - [x] skill 编写
  - [x] MCP 接入
  - [x] 能力验证
- `user_projects/TravelAi`
  - [x] 文档编写、生成与 review
  - [ ] 代码生成
  - [ ] 功能验证

# 项目

## sdlc
### Overview

- 角色：仓库中的主工作流项目。
- 目标：探索 AI 是否能承接从需求分析到架构设计、模块设计、实现计划、实现与验证的阶段化工程产物。
- 主要用户：
  - 希望快速验证产品想法，并持续维护需求和技术产物的产品探索者。
  - 希望持续更新需求与技术产物并完成程序交付的独立开发者。
  - 需要在 PM 与工程协作下完成需求编写、设计评审、代码评审和结果验收的小型产品团队。
- 仓库定位：`Purpose 3` 下的主要实践载体之一，重点验证交付工作流本身是否成立。

### Problems and Capabilities

- [需求不可直接执行]
  - Problem：用户写出的需求通常是自然语言，存在歧义，不能直接驱动后续设计、实现和验证阶段。
  - Capability：将原始需求结构化为更清晰、可执行的输入，供下游阶段稳定使用。

- [需求到产出链路断开]
  - Problem：用户需要自己在需求、设计、编码、审查、测试和更新之间来回衔接，整体成本高、效率低。
  - Capability：提供从需求到设计、实现、验证的阶段化工作流，把关键产物组织成连续承接的链路。

- [需求变化代价高]
  - Problem：需求一旦变化，用户往往要手工修改多阶段产物，过程慢且容易出错。
  - Capability：在需求变化后，基于已有产物做增量更新，而不是每次从头重建整条链路。

- [AI协助难以信任]
  - Problem：用户很难清楚知道 AI 在做什么、准备改什么、结果是否安全可用。
  - Capability：展示执行过程、生成结果和待变更内容，并在重要修改前等待用户确认。

- [生成结果难判断]
  - Problem：即使拿到产物，用户也不容易快速判断结果是否可接受、可维护、可继续演进。
  - Capability：提供更可审查、可维护、可追踪的输出结果，降低判断和接手成本。

### 核心文档

- 在进行需求分析、架构设计、模块设计或代码生成之前，请优先阅读以下文档。
- [需求文档](./meta_layer/docs/Requirement.md)：定义产品需求基线、范围、用户工作流和目标能力。
- [架构文档](./meta_layer/docs/TechnicalArchitecture.md)：定义端到端技术架构、阶段流转、模块职责和运行时协作模型。
- [模块设计文档](./meta_layer/docs/design_docs/)：讨论中的 `module_desig` 当前对应设计文档目录，包含 workflow、execution、contract、interface、SDK、data、quality-gate 等模块级设计。
- [work_plan](./infra_projects/docs/work_plan.yaml)：定义实现交付计划、batch 拆分、执行状态和完成跟踪。
- [协作文档](./meta_layer/resources/COLLABORATION_STANDARD.md)：定义变更计划、batch 边界、验证要求和 commit 规则。

### 使用入口

- CLI 入口：`infra_projects/projects/sdlc/src/interface/cli/cli.ts`
- 快速开始：

```bash
init --workspace /path/to/workspace
generate --stage architecture_design --workspace /path/to/workspace
generate --stage module_design --workspace /path/to/workspace --target-module Workflow
```

## AgentRuntime

### Overview

- 角色：仓库中面向 agent 类项目的共享运行时基础项目。
- 目标：承接可复用的执行流、运行时抽象、状态处理和测试支撑，减少各项目重复建设同类底座。
- 主要用户：
  - 实现和维护共享执行基础层的运行时能力开发者。
  - 希望直接复用运行时能力、而不是重复建设基础设施的项目团队。
- 仓库定位：`Purpose 3` 下的支撑型实践载体，重点验证 agent 类项目所需的可复用运行时基础是否成立。

### Problems and Capabilities

- [基础能力重复建设]
  - Problem：不同 agent 项目经常重复实现执行循环、运行时抽象和测试支撑，投入大且复用差。
  - Capability：提供共享的单轮执行基础能力，减少不同项目重复建设运行时底座的成本。

- [运行时行为难统一]
  - Problem：如果没有共享 runtime，各项目的执行方式、接口约束和测试方式容易各自为政。
  - Capability：提供统一的 agent 抽象、runtime 循环和接口约束，帮助项目在同一套运行时模型上演进。

- [演进成本高]
  - Problem：运行时能力一旦需要调整，多个项目往往要分别修改，整体维护成本高。
  - Capability：通过集中维护 runtime 能力和测试支撑，降低多个项目分别演进的成本。

### 核心文档

- 当前仓库根 README 中未单列 AgentRuntime 的独立设计文档集合。
- 主工作区：[infra_projects/projects/agent_runtime/](./infra_projects/projects/agent_runtime/)

### 使用入口

- 工作区：`infra_projects/projects/agent_runtime/`
- 运行测试：`npm test`
- 构建：`npm run build`

## AI Travel

### Overview

- 角色：仓库中的主真实产品探索项目。
- 目标：验证这个仓库中探索出的协作方式、产物结构和工程流程，是否能在真实产品场景中成立。
- 主要用户：
  - 已确定目的地但缺少完整行程的自由行用户。
  - 已有行程但希望旅行过程中持续获得协助的用户。
  - 希望在旅程结束后获得轻量总结和记录沉淀的用户。
  - 扩展场景下的 2 到 4 人小团队出游用户。
- 仓库定位：`Purpose 3` 下的主要实践载体之一，重点验证这套方法在真实产品上下文中的可用性。

### Problems and Capabilities

- [信息分散]
  - Problem：地点、交通、住宿、餐饮、票务、记录和素材分散在不同工具里，用户需要自己来回整理。
  - Capability：围绕同一趟旅行聚合并组织规划、过程和记录相关信息，减少用户在多个工具之间切换。

- [规划成本高]
  - Problem：用户要把分散信息组合成顺路、节奏合理、预算可控的完整行程，整体规划成本高且容易遗漏。
  - Capability：把模糊需求转化为可使用的旅行方案，输出按天行程、预算、待办和预订建议等结构化结果。

- [过程承接弱]
  - Problem：旅行开始后，原有计划往往停留在静态内容里，难以承接变化、记录和执行入口。
  - Capability：在旅行过程中展示当前计划、记录变化、提供建议并组织执行入口，持续承接同一份当前计划。

- [结束后难沉淀]
  - Problem：旅行结束后，消费、地点、计划变更和素材索引分散在不同应用中，难以整理和回顾。
  - Capability：聚合过程中的关键记录、消费、地点和素材索引，形成轻量总结与可回顾结果。

### 核心文档

- 需求文档：[user_projects/TravelAi/sdlc/docs/Requirement.md](./user_projects/TravelAi/sdlc/docs/Requirement.md)
- 主工作区：[user_projects/TravelAi/](./user_projects/TravelAi/)、[user_projects/ai_travel/](./user_projects/ai_travel/)、[user_projects/travel-planner/](./user_projects/travel-planner/)
- 当前可见的产品设计和文档产物主要集中在 TravelAi 的 `sdlc/` 工作区下。
- 面向 provider 的 MCP 规划与外部旅行数据集成当前放在 `user_projects/travel-planner/`。

### 使用入口

- 工作区：`user_projects/TravelAi/`、`user_projects/ai_travel/`、`user_projects/travel-planner/`
- 当前主要使用方式：围绕 TravelAi 的 `sdlc/` 工作区进行需求、架构和模块设计工作
- 基于 MCP 的 provider 查询、旅行规划和行程拼装实验位于 `user_projects/travel-planner/`
- 暂无统一的可运行入口

## travel-planner

### Overview

- 角色：仓库中基于 skill 执行的轻量版 AI Travel 能力探索项目。
- 目标：通过 skill 与 MCP 暴露的 provider 数据，完成围绕航班、住宿、天气、路线、景点和行程拼装的轻量版 AI Travel 能力探索。
- 主要用户：
  - 验证基于 skill 的旅行规划执行方式的开发者。
  - 需要轻量可执行 AI Travel 能力验证而不是纯文档输出的产品探索工作。
  - 关注 provider 可用性、错误处理和行程构造约束的工程研发者。
- 仓库定位：`AI Travel` 产品方向下的支撑型实践载体，重点验证如何通过 skill 执行探索一个轻量但可运行的 AI Travel 能力子集。

### Problems and Capabilities

- [旅行数据分散在多个 provider]
  - Problem：航班、酒店、天气和地图数据来自不同 provider，需要统一编排。
  - Capability：暴露 provider-facing MCP tools，并把它们组织进一个受约束的规划流程。

- [旅行方案需要事实校验]
  - Problem：如果不对交通、住宿和本地移动做实时校验，行程推荐的可信度不足。
  - Capability：在选定方案前，通过 MCP 查询校验目的地可行性、航班、住宿、天气和本地交通。

- [Provider 失败本身就是产品现实]
  - Problem：旅行 provider 经常因为权限、配额、覆盖范围或接口不匹配失败，这会直接影响规划是否可行。
  - Capability：记录 provider 错误，保留结构化响应，并在硬约束无法验证时停止规划。

### 核心文档

- Skill 入口：[user_projects/travel-planner/SKILL.md](./user_projects/travel-planner/SKILL.md)
- MCP 能力说明：[user_projects/travel-planner/references/mcp-tools.md](./user_projects/travel-planner/references/mcp-tools.md)
- 规划输入契约：[user_projects/travel-planner/references/plan.schema.json](./user_projects/travel-planner/references/plan.schema.json)
- 示例规划输入：[user_projects/travel-planner/references/plan.json](./user_projects/travel-planner/references/plan.json)
- Provider MCP server 入口：[user_projects/travel-planner/server/server.ts](./user_projects/travel-planner/server/server.ts)

### 使用入口

- 工作区：`user_projects/travel-planner/`
- Skill 驱动入口：`user_projects/travel-planner/SKILL.md`
- Provider MCP server 工作区：`user_projects/travel-planner/server/`
- 当前主要用途：基于 MCP 的 provider 查询和结构化旅行方案生成实验

## hello-service

### Overview

- 角色：仓库中的轻量验证样例项目。
- 目标：在依赖更复杂真实项目之前，先检查 SDLC 工作流是否能在一个足够小、足够清晰的目标上跑通。
- 主要用户：
  - 希望快速验证工作流是否可用的 SDLC 能力验证者。
  - 用它做黑盒测试、脚本测试和端到端验证的工程研发者。
- 仓库定位：`Purpose 3` 下的支撑型实践载体，重点承担小范围验证和更容易的问题定位。

### Problems and Capabilities

- [验证样本过重]
  - Problem：如果直接用复杂项目验证流程，调试和定位成本很高。
  - Capability：提供一个轻量样例项目，让工作流能力可以在较小范围内快速验证。

- [黑盒验证不足]
  - Problem：没有稳定样例项目时，很难持续检查工作流是否真的能产出可运行结果。
  - Capability：提供基线黑盒测试、LLM 调用链路测试和脚本化验证入口。

- [链路问题难定位]
  - Problem：需求、设计、实现、运行中的问题容易混在一起，难以快速判断是哪一环出了问题。
  - Capability：通过较小项目和明确脚本把问题范围收窄，方便判断问题出在流程、生成还是运行阶段。

### 核心文档

- 当前未定义独立的根级设计文档集合。
- 主工作区：[user_projects/hello-service/](./user_projects/hello-service/)

### 使用入口

- 工作区：`user_projects/hello-service/`
- 运行测试：`npm test`
- 测试脚本目录：`user_projects/hello-service/scripts/`
