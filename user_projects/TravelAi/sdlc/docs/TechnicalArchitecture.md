# Technical Architecture

## 1. Purpose

定义 `TravelAi` 平台的整体技术架构。

- Team members：为团队提供统一的高层技术基线，帮助理解 TravelAi 如何承接规划、过程支持与后续旅行总结的整体链路。
- Senior engineers：用于评审架构方向、系统边界，以及从 V1 到后续阶段的演进策略是否合理。
- Junior engineers：用于在进入详细设计前理解主要模块、依赖规则和运行时协作关系。

## 2. Scope

### 2.1 In Scope

- 从旅行输入到计划生成、计划细化、action 输出以及后续阶段扩展的整体系统交互与控制流程。
- 架构层面的主要模块与子系统，包括用户入口、流程编排、规划智能、状态存储和外部信息接入适配层。
- 核心平台模块与第三方提供方之间的协作边界与依赖方向。
- 与信息时效性边界、结果可解释性、外部依赖故障韧性以及从 V1 到 V5 分阶段演进相关的关键架构约束。

### 2.2 Out of Scope

- Planner、action 生成模块、summary 生成模块内部的详细实现逻辑。
- 详细 API 合同、消息字段、Prompt 内容、排序公式以及 action schema 的具体定义。
- 数据库 schema、索引策略和存储层优化设计。
- UI 交互细节、视觉表现和页面级信息架构。
- 部署 runbook、环境搭建、CI/CD 流程和运维操作手册。

跨模块交互合同会在独立的设计文档中以轻量共享边界的形式展开，而不会在本架构文档中下沉到模块级实现细节。

---

## 3. Design Drivers

- **功能驱动：V1 以规划闭环为核心**：架构必须优先支持单人自由行的规划阶段闭环，因为 V1 的成败取决于是否能产出可使用的旅行方案，并把方案进一步落地为结构化结果，而不是一开始覆盖全部旅程阶段。
- **功能驱动：连续的旅行上下文**：系统必须能够在生成、细化和后续过程支持之间持续保留 trip context，因为产品价值来自于围绕同一趟旅行提供连续服务，而不是返回彼此割裂的单次答案。
- **功能驱动：外部数据是参考输入而非真值**：航班、酒店、地图、天气和 POI 等信息来自时效性和完整性都不稳定的外部系统，因此架构必须通过 adapter 隔离 provider 接入，并将这些返回结果视为带时效边界的参考输入，而不是权威真值。
- **功能驱动：需要结构化 action 输出**：规划结果需要被转换成可供执行层消费的结构化 action，因此架构必须明确区分“对话式生成结果”和“归一化后的 action 投影结果”这两个边界。
- **非功能驱动：结果必须可解释、可审阅**：旅行计划会直接影响用户真实的时间和花费，因此架构必须保留中间上下文、决策依据以及关键过程事件，以支持用户审阅当前结果并理解本次调整的主要变化。
- **非功能驱动：产品按阶段演进**：V2、V3、V4 和 V5 都是在同一条旅行生命周期上扩展能力，因此架构必须支持逐步加入过程支持、总结、意向推荐和多人协作，而不是过早拆散系统。
- **非功能驱动：规模适中但集成不确定性高**：早期流量有限，但 provider 不稳定和 AI 调用延迟都是真实风险，因此架构应优先选择 modular monolith，并在需要的地方引入选择性的异步处理，而不是过早微服务化。

---

# 4. Architecture Design

### 4.1 Architecture Style

系统采用 **modular monolith + capability-oriented application services + adapter-based external integrations** 的架构风格。

### 4.2 Layers or Partitions

- **Experience Layer**：负责提供 Web 与移动端友好的用户入口，承接旅行输入、计划查看、计划细化以及后续旅行过程中的使用界面。
- **Application Layer**：负责请求接入、能力路由、权限校验，以及 use case 级别的轻量协调；整体计划、日程调整和 action 更新分别由独立能力负责。
- **Intelligence Layer**：负责“想方案”和“出结果”，例如生成行程草案、细化已有计划、给出替代建议，并把自然语言结果整理成可继续处理的候选输出。
- **Domain Layer**：负责定义核心业务对象，并判断结果在业务上是否成立，例如 Trip、Plan、DaySchedule、BudgetSnapshot、ActionItem、ChangeRequest 和 SummaryRecord 分别是什么，以及一个计划是否满足预算、节奏、顺路性和可执行性等规则。
- **Integration Layer**：通过显式 adapter 接入 LLM provider、旅行信息 provider、地图与地理位置 provider、天气 provider、通知渠道和认证服务。
- **Data Layer**：负责持久化 trip context、当前生效计划、provider snapshot、action projection、TripRecord 数据，以及面向审计的事件日志。

### 4.3 Allowed Dependencies

ALLOW:
- `Experience Layer` -> `Application Layer`
- `Application Layer` -> `Intelligence Layer`
- `Application Layer` -> `Domain Layer`
- `Application Layer` -> `Integration Layer`
- `Application Layer` -> `Data Layer`
- `Intelligence Layer` -> `Domain Layer`
- `Intelligence Layer` -> `Integration Layer`
- `Intelligence Layer` -> `Data Layer`
- `Integration Layer` -> external provider systems
- `Data Layer` -> managed storage infrastructure

所有未明确声明的依赖默认禁止。尤其是 Experience Layer 不能直接访问 provider adapter 或底层存储，provider adapter 也不能反向依赖 UI 或应用层路由逻辑。

### 4.4 High-level Diagram

```text
                 [User]
                    |
                    v
        +---------------------------+
        |      Experience Layer     |
        | Web App / Mobile Web UI   |
        +---------------------------+
                    |
                    v
        +---------------------------+
        |      Application Layer    |
        | TripApplicationService    |
        | Access Ctrl / Routing     |
        +---------------------------+
             |            |
             |            v
             |   +-------------------+
             |   |  Integration Layer|
             |   | LLM / Flight /    |
             |   | Hotel / Map / Wx  |
             |   +-------------------+
             v
        +---------------------------+
        |     Intelligence Layer    |
        | PlanService /             |
        | ScheduleService /         |
        | ActionService / Summary   |
        +---------------------------+
             |            |
             v            v
        +---------------------------+
        |       Domain Layer        |
        | Trip / Plan / Action /    |
        | Change / Summary Models   |
        +---------------------------+
                    |
                    v
        +---------------------------+
        |         Data Layer        |
        | Postgres / Cache / Queue  |
        | Snapshot & Event Storage  |
        +---------------------------+
```

### 4.5 Runtime Topology

- **Web Client Runtime**：承载用户侧体验，包括旅行输入、计划查看、计划细化，以及后续过程支持视图。V1 以桌面 Web 为主，移动 Web 作为兼容入口。
- **API Runtime**：运行 modular monolith 后端，承载 trip API、认证控制、能力路由、当前计划状态管理和同步规划请求。
- **Worker Runtime**：处理耗时或可重试任务，例如 provider aggregation、plan regeneration、action 重新投影、TripRecord 写入，以及后续 summary generation。在 V1 可以与 API Runtime 同部署，但在逻辑上应保持可分离。
- **Shared Infrastructure**：包括用于持久 trip state 和当前计划状态的关系型存储、用于暂态协调的 cache/queue，以及用于日志、trace 和 metrics 的可观测性基础设施。

### 4.6 Technology Choices

- **Experience Layer**：`Next.js + TypeScript`，用于支持 Web 交付、共享组件开发，以及从桌面规划平滑扩展到移动端过程支持。
- **Application Layer**：`Node.js + TypeScript`，配合结构化服务端框架如 `NestJS`，用于实现清晰的模块边界、依赖注入，以及面向能力的 API 路由与轻量协调。
- **Intelligence Layer**：基于 `Node.js + TypeScript` 的智能编排模块，结合 LLM orchestration、规则校验和确定性后处理，把生成内容归一化为稳定的 plan 与 action 结构。
- **Domain Layer**：使用 TypeScript 领域模型和服务契约，确保 trip 核心概念明确，避免 provider 格式或 UI 表达直接渗透到核心业务状态。
- **Integration Layer**：通过 adapter pattern 封装基于 HTTP 的 provider SDK 或 API，对接 LLM、航班、酒店、地图、天气、通知和认证系统，并集中处理 retry 与 fallback 策略。
- **Data Layer**：`PostgreSQL` 用于持久 trip 与 plan 状态，`Redis` 用于 cache 和 job queue 支撑，必要时引入 object storage 存放导出产物或轻量派生文件，但不用于保存原始媒体素材。
- **Observability**：使用结构化日志、metrics 和 distributed tracing，定位高延迟规划链路与 provider 故障问题。

---

## 5. System Interactions

### 5.1 Primary Interaction Path

```text
User
 -> ExperienceLayer
 -> TripApplicationAPI
 -> TripApplicationService
 -> PlanService or ScheduleService
 -> ContextAssembler
 -> ProviderAdapters
 -> PlanNormalizer
 -> ActionService
 -> PlanStore
 -> ExperienceLayer
 -> User
```

1. 用户通过 Experience Layer 提交目的地、日期、预算、偏好以及其他约束信息。
2. Application Layer 校验最小必需输入，创建或加载 trip context，并根据用户意图把请求路由到对应能力，例如整体计划更新走 `PlanService`，日程局部调整走 `ScheduleService`。
3. 被调用的能力模块通过 `ContextAssembler` 和 Integration Layer 聚合内部 trip state 与外部 provider snapshot，例如交通、住宿、地图和参考信息。
4. 对应能力模块生成候选结果，对结果执行领域级归一化和一致性检查；如有需要，再由 `ActionService` 刷新结构化 action。
5. Application Layer 将能力结果写回当前生效计划，同时保存相关 provider snapshot、action projection，并调用 `TripRecordService` 沉淀 TripRecord 所需的本次变化信息，然后把可审阅结果返回给用户。
6. 当用户继续细化或发起行中调整时，Application Layer 只负责把请求分发到正确能力，而不承担重业务决策。

`Flow Summary`：TravelAi 使用“能力独立化 + 薄应用层路由”的处理方式，以当前生效计划为中心，把整体计划更新、单日日程调整和 action 刷新拆给各自能力处理，而不是集中放进一个重 workflow 模块。

### 5.2 Core Modules

- `TripApplicationService`：接收外部请求，管理认证上下文，并把不同场景路由到对应能力模块，本身只做轻量协调。
- `ContextAssembler`：把用户输入、持久 trip state、provider snapshot 和当前生效计划组合成稳定的 planning context。
- `PlanService`：负责整趟旅行层面的计划生成和整体更新，例如总览、节奏、住宿区域、预算框架和多天安排重算；它可以改动整份计划，但不直接负责单日局部编辑入口和 action 刷新。
- `ScheduleService`：负责按天或局部范围的行程生成与调整，例如替换景点、压缩路线、调整顺序和更新单日安排；它只处理局部日程，不负责重做整份计划的全局结构。
- `PlanNormalizer`：把生成内容转换为稳定的领域结构，并检查缺失项、冲突项和不可执行项。
- `ActionService`：根据当前 plan 生成或刷新结构化 action，例如提醒、待办、预订节点和执行层消费结果；它不决定计划内容，只消费最新计划结果并产出执行层数据。
- `TripRecordService`：负责沉淀旅行过程中的关键记录与用户可感知变化，生成供 V3 总结消费的 `TripRecord` 数据，但不保存可回退的计划版本历史，也不直接暴露原始技术事件流给用户。
- `ProviderHub`：统一路由对外部航班、酒店、地图、天气、POI、通知和认证 adapter 的访问。
- `TripRepository`：持久化 trip aggregate、当前生效计划、provider reference 和 action set。

能力边界补充说明：
- `PlanService` 的输入通常是 trip 级目标与约束，例如目的地、天数、预算、住宿偏好和整体风格；输出是整份当前计划的候选结果。
- `ScheduleService` 的输入通常是当前计划中的某一天或某几天，以及明确的局部变更要求；输出是局部更新后的日程结果，再合并回当前计划。
- `ActionService` 的输入始终是已经归一化的 plan 结果；输出是与当前计划同步的 action 集合，而不是新的计划建议。
- `TripRecordService` 的输入是本次规划、调整或执行过程中发生的关键变化，以及与之关联的计划结果和素材索引；输出是面向后续总结与回看的 `TripRecord` 数据。

### 5.3 Interaction Model

本节描述高层级的跨模块交互。具体公共 API 或接口合同定义在 `sdlc/design/cross-module/trip_application_contract.md`。

1. **请求接入与能力分发**：`TripApplicationService` 接收带认证上下文的用户意图，通过 `TripRepository` 加载当前 trip，然后判断这次请求应交给 `PlanService`、`ScheduleService` 还是 `ActionService` 处理。
2. **规划上下文组装**：被调用的能力模块通过 `ContextAssembler` 生成归一化输入，过程中可能同时从 `TripRepository` 读取持久状态，并通过 `ProviderHub` 获取当前 provider reference。
3. **能力内生成与稳定化**：`PlanService` 或 `ScheduleService` 基于稳定后的 context 生成候选结果，随后统一流入 `PlanNormalizer`，把计划结构、预算逻辑、路线顺序和关键准备事项转换为一致的领域对象。
4. **Action 刷新、TripRecord 沉淀与持久化**：当 plan 结果发生变化时，`ActionService` 基于最新 plan 刷新结构化 action，随后由 `TripRepository` 更新当前生效计划、action set 和 provider snapshot reference；`TripRecordService` 同时沉淀本次处理的关键变化，生成可供后续总结消费的 `TripRecord` 数据。
5. **后续阶段扩展路径**：V2 的 execution support 继续复用 `ActionService` 与当前 plan 状态；V3 的 summary generation 消费 `TripRecordService` 产出的 `TripRecord` 与 `TripRepository`，输出面向用户的旅行总结结果，例如已完成行程回看、关键变化摘要、消费汇总、素材索引和简短旅行复盘；V4 在 planning 之前增加 recommendation 能力；V5 在同一个 trip aggregate 外围增加 participant 与 shared-decision context。

典型调用方式：
- **新建或整体重算**：`TripApplicationService` -> `PlanService` -> `PlanNormalizer` -> `ActionService` -> `TripRepository`
- **单日或局部调整**：`TripApplicationService` -> `ScheduleService` -> `PlanNormalizer` -> `ActionService` -> `TripRepository`
- **仅刷新执行数据**：`TripApplicationService` -> `ActionService` -> `TripRepository`

### 5.4 Key Considerations

- **当前计划优先的状态管理**：当前阶段始终只维护一个当前生效计划；每次关键生成、细化和行中调整都直接更新这份计划，同时只沉淀 TripRecord 所需的必要变化信息，不保留可比较、可回退的计划版本历史。
- **能力边界先于流程边界**：整体计划更新、单日日程调整和 action 刷新必须分别落在对应能力中，应用层只能做路由和轻量协调，不能重新收敛成一个“总管服务”。
- **参考数据的时效性边界**：外部 provider 数据必须带着获取时间等元数据一起保存，并作为有时效边界的参考输入使用，因为 TravelAi 无法承诺价格、库存或营业信息的实时正确性。
- **自由生成之后必须做确定性后处理**：LLM 输出不能直接返回给用户或下游模块，必须经过归一化和领域检查，否则后续 action projection 和过程支持会失稳。
- **Provider 故障时优雅降级**：当部分 provider 不可用时，只要核心规划仍可继续，系统就应返回部分结果，同时明确告知哪些信息缺失、失败或已过时。
- **生成与执行分离**：TravelAi 负责生成和更新 action，但不直接执行 action；与日历、提醒、地图、浏览器跳转等执行能力的连接仍然保持为 adapter 扩展点。

---

## 6. Non-Functional Considerations

### 6.1 High Availability

- Why it matters:
  - 用户可能在出发前的窄时间窗口内集中完成规划，也可能在旅行途中依赖系统调整安排，因此平台整体不可用会直接中断核心使用链路。
- Architectural support:
  - modular monolith 让 V1 的关键能力集中在一个可控的后端部署单元中，降低跨服务故障面和运维复杂度。
  - 耗时或可重试任务被隔离到 worker 风格的处理路径中，减少外部 provider 波动对主 API 路径的直接阻塞。
  - provider adapter 都通过 `ProviderHub` 统一隔离，可集中实现 timeout、retry、fallback 和 partial-result response，而不是出现单点故障导致整条请求完全失败。

### 6.2 High Scalability

- Why it matters:
  - 早期用户量虽然不大，但 planning 和 refinement 会带来突发访问、provider fan-out 和昂贵的 AI 调用，即便是小规模用户也可能放大后端压力。
- Architectural support:
  - 无状态 API 实例可以水平扩展，而不需要改变现有领域边界。
  - 重型聚合与生成任务可以逐步迁移到 worker 处理，保持用户请求入口足够轻量。
  - provider snapshot 缓存和 trip context 持久化可以减少同一 trip 在多次 refinement 和继续规划过程中反复向外部 provider 扇出请求。

### 6.3 High Performance

- Why it matters:
  - 如果首次生成或细化等待时间过长，用户会认为规划流程不可用，尤其是在反复比较预算、路线和住宿方案时更明显。
- Architectural support:
  - `ContextAssembler` 会复用已保存的 trip context 与 provider reference，而不是每次都从零组装规划输入。
  - 架构允许轻量 refinement 走同步 fast path，重型重算走异步 regeneration path，从而兼顾体验与资源利用率。
  - 确定性归一化和 action projection 都在后端边界内完成，减少客户端二次拼装成本，并让返回结构保持稳定。

---

## 7. Design Documents

### 7.1 Design Document Categories

不同设计文档有不同关注点，但都必须遵守本架构文档中定义的模块边界、依赖规则和共享架构约束。

- **Capability Design**：描述整体计划更新、单日日程调整、action 刷新等独立能力的职责边界和协作方式。
- **Module Design**：描述上下文组装、normalization、provider integration、persistence 和 TripRecordService 等支撑模块的设计。
- **Interaction Contract Design**：描述 API 边界、provider adapter 合同，以及跨模块共享数据契约。

### 7.2 Design Document Breakdown

- `sdlc/design/capabilities/plan_service.md`：覆盖 `PlanService` 的设计，包括整体计划生成和整体更新。
- `sdlc/design/capabilities/schedule_service.md`：覆盖 `ScheduleService` 的设计，包括单日日程生成与局部调整。
- `sdlc/design/capabilities/action_service.md`：覆盖 `ActionService` 的设计，包括 action 生成与刷新。
- `sdlc/design/capabilities/trip_record_service.md`：覆盖 `TripRecordService` 的设计，包括 TripRecord 数据沉淀与总结输入组织。
- `sdlc/design/modules/planning_support.md`：覆盖 `ContextAssembler`、`PlanNormalizer` 和共享规划支撑能力的设计。
- `sdlc/design/modules/provider_hub.md`：覆盖 `ProviderHub` 以及外部信息系统 adapter 边界的设计。
- `sdlc/design/modules/trip_repository.md`：覆盖 durable trip state、current plan persistence 和 TripRecord storage boundary 的设计。
- `sdlc/design/modules/execution_support_extension.md`：覆盖 V2 如何在不破坏 V1 边界的前提下读取和使用 plan 与 action 输出。
- `sdlc/design/cross-module/trip_application_contract.md`：覆盖 `TripApplicationService`、各能力模块、provider integration 和 persistence 模块之间的共享合同设计。

文档目录应与架构文档中明确列出的模块与关键交互保持一致。

---

## 8. Open Issues

- 外部 provider 策略仍未定稿：V1 应优先接入哪些航班、酒店、地图、天气和 POI 数据源，以及当某个数据源不可用或被限流时可接受的 fallback 策略是什么。
- Requirement 文档刻意没有展开 action contract，但 V1 实现仍然需要一个最小共享 schema 边界，用于表达提醒、待办、预订节点和外部跳转链接。
- Requirement 文档尚未明确认证与账号体系边界，而 trip ownership、跨设备连续性以及后续多人协作都依赖这个前提。
- V1 是否要支持 partial planning result streaming 仍未决定，这会影响用户感知延迟和接口形态。
- provider snapshot、导出产物和总结结果的长期存储策略仍需进一步澄清，以确保成本、合规边界和后续旅行记录能力保持一致。
