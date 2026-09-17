# AI 律师项目详细需求文档

> 版本：2026-09
>
> 依据：`/Users/iriskong/Downloads/ai-lawyer-agent-main (1).zip`
>
> 说明：本文档根据 2026-09-07 代码包中的前端、后端、治理模块、数据模型、数据库迁移和项目说明整理。它描述的是当前代码反映出的产品需求和行为契约，不替代接口文档或部署手册。

## 1. 项目概述

### 1.1 产品定位

AI 律师是一套面向法律项目的 AI 工作平台。它将项目、案卷材料、知识资源、数字员工和可执行工作流程放在同一个系统中，让律师能够：

- 创建并持续维护一个法律项目；
- 上传、查看和检索项目案卷；
- 与项目级 Copilot 对话；
- 使用全局法律知识和受控知识库；
- 让数字员工按照固定职责和执行路线完成任务；
- 通过 SOP Workflow 执行可复现的法律工作流程；
- 追踪一次执行使用了什么模型、Skill、知识库、Connector 和 SOP。

产品不是一次性问答机器人，而是“项目工作台 + 法律知识检索 + 数字员工治理 + 可执行工作流”的组合。

### 1.2 产品边界

系统分为三个应用：

| 应用 | 职责 |
| --- | --- |
| `apps/web` | 普通用户工作台和 `/admin/*` 治理控制面 |
| `apps/server` | 唯一在线后端，负责鉴权、业务 API、Mastra Agent、Workflow、治理运行时 |
| `apps/rag` | 全局法律 RAG 的离线文档处理、Embedding 和 pgvector 索引 |

全局 RAG、治理 KnowledgeBase、项目案卷和会话附件是四类不同的数据来源，不能混为一个权限域。

## 2. 用户角色与权限

### 2.1 普通用户

普通用户可以：

- 登录和退出；
- 创建和管理自己拥有的项目；
- 在项目中创建会话、上传案卷并使用 Copilot；
- 查看自己项目的会话、运行状态和产物。

普通用户不能直接调用裸 Mastra Runtime，也不能访问治理控制面。

### 2.2 治理用户

治理用户负责维护自身租户范围内的 AI 资源和数字员工，典型权限包括：

- `governance.read`：读取治理对象；
- `governance.resources.edit`：创建、编辑、测试和发布资源、员工；
- `governance.manage_all`：管理跨 owner 对象和员工组。

治理权限与平台用户管理权限分离，拥有平台账号管理权不代表自动拥有治理资源管理权。

### 2.3 平台用户管理员

平台管理员通过独立 capability 管理用户：

- 查看、创建和编辑用户；
- 分配角色和作用域；
- 启用或禁用用户；
- 重置密码；
- 查看和撤销活跃 Session；
- 查看登录审计和管理员操作审计。

管理员不能修改当前会话自己的角色和作用域，以避免自我提权或误锁死。

### 2.4 强制改密与会话安全

当用户被标记为必须修改密码时，治理入口必须先重定向到强制改密页面。密码重置、临时密码展示、Session 撤销和禁用用户都必须写入审计，并立即使相应会话失效。

## 3. 普通用户工作台

### 3.1 新建入口

页面：`/_app/new`

需求：

- 提供一个主输入区，用户可以直接描述案件问题、材料任务或交付目标；
- 支持 Enter 发送、Shift + Enter 换行；
- 可切换“使用知识库”或“仅基于输入”；
- 支持快捷起手模板，包括法律检索、合同审查、尽调、时间线、证据目录和交付物框架；
- 提交后创建项目，并将首个问题带入项目会话；
- 项目名称默认取首条问题的前若干字，保证可检索；
- 创建失败时必须显示明确错误，不得静默丢失问题。

### 3.2 项目列表

页面：`/_app/_authed/projects`

需求：

- 展示当前用户有权访问的项目；
- 支持卡片视图和表格视图；
- 支持按名称、创建时间、更新时间排序；
- 支持创建、重命名、删除项目；
- 删除默认进入项目回收站，而不是立即物理删除；
- 支持恢复、彻底删除和清空回收站；
- 删除项目时必须清理关联会话、运行记录、产物、记忆线程和项目文件；
- 项目模板可以作为快捷入口，但未实现的模板必须显式提示，不得伪装成已完成能力。

### 3.3 项目详情工作台

页面：`/_fullscreen/projects/$projectId`

工作台采用三栏结构：

1. 左栏：项目会话列表；
2. 中栏：项目 Copilot 对话；
3. 右栏：项目案卷、运行状态、Workflow、Observational Memory 和产物。

需求：

- 左右栏可收起、展开和拖拽调宽；
- 布局状态可以在浏览器中保持；
- 会话支持新建、重命名、软删除、恢复和彻底删除；
- 会话列表显示生成中、等待输入、等待确认、运行中和产物等状态；
- 页面切换期间后端可以继续生成；
- 返回会话时可以恢复未完成的流；
- 用户可以显式停止当前生成；
- 重新生成必须替换旧答案，不能重复追加同一轮内容；
- 运行状态、步骤和产物必须可以被查看。

### 3.4 项目案卷

项目案卷是项目私有材料，当前主要支持 Markdown 和 TXT。

需求：

- 上传单文件或逐个上传多个文件；
- 校验扩展名、UTF-8 编码、文件大小、文件数量和重名；
- 支持中文文件名，并清洗路径穿越、控制字符和隐藏文件名；
- 展示文件名、上传时间、大小和媒体类型；
- 支持原文预览和删除；
- Agent 只能通过只读 Workspace 读取案卷；
- 项目文件不应自动进入全局 RAG；
- 文件被删除或项目被彻底删除后，不得继续被 Agent 读取。

### 3.5 项目会话附件

会话附件用于当前会话的临时上下文，支持文本、Markdown 和来源 URL 等结构化来源。文件和图片上传只有在对应解析能力真正接入后才能开放，前端不得提前展示为可用能力。

## 4. 项目 Copilot 与证据路由

### 4.1 Supervisor 职责

项目 Copilot Supervisor 是普通用户对话的统一入口。它负责理解当前问题并选择执行路线，但不应绕过服务端业务权限。

### 4.2 三条回答路线

#### 路线 A：Direct

只适用于：

- 问候和元对话；
- 对已有对话进行追问；
- 对用户已提供文本做改写、摘要和格式转换；
- 不需要外部证据的问题。

Direct 路线不得声称读取了项目文件、法律知识库或外部法律服务。

#### 路线 B：Agentic

适用于需要检索、判断或工具调用的问题：

- 先判断是否需要读取项目案卷；
- 必要时调用全局法律 RAG；
- 如果配置了北大法宝 Connector，可以调用对应的外部工具；
- 根据检索结果改写查询并继续检索；
- 输出来源标题、文档标识和覆盖度说明；
- 明确区分有证据支撑的结论和“常识补充”。

#### 路线 C：Workflow

固定业务流程由 SOP 驱动：

- Router 选择绑定的 SOP；
- 按 SOP 的输入 Schema 构造 Workflow 输入；
- 由 Mastra Dynamic Workflow 执行；
- 记录流程状态、节点和错误；
- 暂停时必须等待明确的恢复数据；
- 失败时返回显式错误，不允许偷偷降级为普通聊天。

### 4.3 证据来源边界

系统需要区分以下来源：

| 来源 | 归属 | 适用场景 |
| --- | --- | --- |
| 项目案卷 | 项目 | 项目事实、合同、项目材料 |
| 全局 RAG | 平台 | 通用法律法规、案例、FAQ、演示语料 |
| 治理 KnowledgeBase | 租户/治理资源 | 员工绑定的可控知识材料 |
| Connector | 租户/治理资源 | 外部 MCP 或 HTTP 服务 |
| 会话附件 | 会话 | 当前对话的临时上下文 |

不同来源必须单独记录检索尝试、命中和引用，不能把全局资料描述成当前项目私有证据。

## 5. 全局 RAG 需求

### 5.1 离线索引链路

`apps/rag` 负责：

1. 读取 Markdown 或生产资料库导出；
2. 根据目录和 frontmatter 判断领域与文档类型；
3. 对法条、案例、FAQ、项目材料做类型化清洗；
4. 使用语义 Markdown 或递归策略切块；
5. 提取证据 anchor；
6. 加入标题、摘要、领域、法域、标签等上下文；
7. 调用 Embedding 模型；
8. 将向量和元数据写入 pgvector。

### 5.2 在线检索

在线查询由 Server 的 Knowledge Lab 和 `legalKnowledgeQueryTool` 完成。

需求：

- 查询前可先进行法律问题意图分类；
- 支持领域、文档类型、法域、行业、标签和 Top K 等元数据过滤；
- 查询必须保留用户原始语言，中文问题不得翻译成英文后再嵌入；
- 检索轮次必须有硬上限；
- 检索结果为空或不足时必须明确说明；
- 不能把项目 ID、用户 ID、会话 ID 等权限字段传入全局 RAG 过滤器；
- 真实生产语料需要经过索引和回归测试后才能被视为可用。

## 6. 治理中心

入口：`/admin/*`

治理中心是独立于普通用户工作台的控制面，用于维护可复用的法律 AI 能力和数字员工。

### 6.1 资源市场

资源市场统一管理五类资源：

1. KnowledgeBase；
2. Skill；
3. Connector；
4. SOP；
5. Model。

资源要求：

- 资源拥有稳定的资源 ID 和不可变业务 key；
- 资源列表、详情、创建、编辑、测试、发布和取消发布必须受 capability 保护；
- 资源生命周期以 `unpublished | published` 为主；
- 发布和取消发布必须携带 revision，防止并发编辑覆盖；
- 已被员工或员工组引用的资源不能直接删除；
- 资源配置错误必须 fail loud，不能返回一组“看似可用”的部分配置。

### 6.2 KnowledgeBase 资源

KnowledgeBase 是治理侧可复用的知识资料，不等同于全局 RAG。

需求：

- 创建知识库并维护名称、说明和租户归属；
- 上传、删除、预览当前文件；
- 文件实时从 MinIO 列举，不依赖过时的结构投影；
- 提供只读 Workspace 给测试 Agent 和员工 Agent；
- 通过真实的 `grep/read_file` 工具调用生成文件证据；
- 文件问答不得发起隐藏的第二次模型请求；
- 删除知识库时清理对应对象和 Workspace 缓存。

### 6.3 Skill 资源

Skill 用于描述法律任务的方法、判断规则、输入输出约束和证据要求。

需求：

- 提供文件树和内容编辑能力；
- 支持 AI 辅助创作，但 AI 生成结果只能进入草稿；
- 支持结构和内容校验；
- 支持独立测试运行；
- 测试时使用当前保存的 Skill 版本；
- 未发布 Skill 不得被生产数字员工使用。

### 6.4 Connector 资源

Connector 用于连接外部服务，类型为 `mcp` 或 `http`。

MCP 需求：

- 配置 URL 和 Headers JSON；
- 保存后才能测试连通性；
- 支持 MCP 握手测试；
- 通过专用测试 Agent 按需调用工具；
- 运行时按当前 revision 动态生成工具；
- Connector 更新后使旧 MCP Client 失效；
- 未配置或未发布的 Connector 不得进入员工执行。

HTTP 需求：

- 配置请求方法、输入 Schema 和响应映射；
- 对配置进行结构校验；
- 支持测试请求；
- 失败时返回明确的连接、Schema 或响应映射错误。

Connector 不提供人工工具目录编辑器，也不把调用账本、凭据状态或旧 Tool 表作为当前产品能力。

### 6.5 SOP 资源

SOP 是可执行的标准工作流程。

需求：

- 使用 Mastra 原生 Dynamic Workflow Graph；
- 提供节点画布和 Graph 编辑器；
- 支持 Agent、Tool、Workflow 等组件引用；
- 保存时校验 Graph、引用闭包和输入输出 Schema；
- 引用的 SOP 必须使用稳定资源身份，不能根据节点名称猜测；
- 支持 AI 辅助创作，但 AI 不得直接修改生产配置；
- 提供独立测试面板；
- 测试使用当前保存的 SOP 和精确依赖闭包；
- 生产执行必须调用绑定的 SOP 一次；
- 不允许使用旧 DSL、旧编译器或隐藏 fallback；
- SOP 未发布时不得被生产员工绑定。

### 6.6 Model 资源

Model 资源用于管理系统模型和 BYOK 模型连接。

需求：

- 支持 OpenAI-compatible Base URL、API Key 和 Model ID；
- 支持从 `/v1/models` 发现模型；
- 一条连接可以包含多个模型 ID；
- 必须指定唯一默认模型；
- 支持连接测试和模型能力测试；
- API Key 必须加密保存；
- 自定义 Endpoint Host 必须通过允许列表校验；
- 模型连接变更必须使用 revision/CAS；
- 生产运行读取当前有效模型连接，不得隐式切换备用模型。

## 7. 数字员工

### 7.1 员工身份

数字员工是一个可发布的 AI 执行身份，不是常驻服务进程。

每个员工至少包含：

- 名称和说明；
- 稳定内部 key；
- 当前状态；
- 路由配置；
- 三条执行路线的 Prompt；
- 绑定资源 ID；
- 模型槽位；
- 运行时 Agent 身份。

员工状态为：

- `draft`：可编辑、可删除、不可用于生产；
- `active`：已发布、可执行，配置修改必须经过完整校验。

### 7.2 员工资源绑定

员工可以绑定：

- Model；
- Skill；
- KnowledgeBase；
- Connector；
- SOP。

绑定规则：

- 普通资源必须已发布，系统托管默认模型除外；
- 绑定只保存资源身份，不保存已删除的旧版本选择；
- 按路线过滤可用 Skill 和 Connector；
- 绑定资源被删除前必须检查员工和员工组引用；
- 员工配置、资源绑定和执行计划应一次事务提交，并使用 revision 校验。

### 7.3 员工调试

员工详情页必须提供真实运行时调试：

- 复用正式员工的 Supervisor、Router 和 Profile 配置；
- 使用 `author_preview` 上下文，不创建项目记忆；
- 显示原生 Agent stream；
- 显示工具调用和错误；
- 不把测试会话写入正式项目会话；
- 不提供一套与生产执行逻辑不同的模拟器。

## 8. 员工组

员工组由多个数字员工组成，并由 Team Supervisor 统一调度。

需求：

- 创建、编辑、查看和删除员工组；
- 选择已启用的数字员工成员；
- 配置团队名称、说明和成员职责；
- 配置团队主管模型和可用资源；
- 配置委派、并行和结果汇总策略；
- 由 Team Supervisor 选择成员，不允许用户直接绕过团队调度；
- 成员分工可以为空，但成员必须存在且可用；
- 每个租户最多启用一个员工组；
- 启用前必须完整校验成员、主管模型和资源绑定；
- 员工组调试必须复用 C 端团队执行逻辑；
- 删除员工组只删除组自身配置，不删除员工和资源。

## 9. 治理运行时

### 9.1 运行装配

一次员工执行需要形成确定的运行 Bundle，至少包含：

- 选中的员工或员工组；
- 执行路线；
- 模型；
- Skill；
- KnowledgeBase；
- Connector ID；
- SOP 及其依赖闭包；
- 项目案卷权限；
- 租户、owner 和用户作用域。

模型、工具、Workspace 或委派动作不得在 Bundle 校验成功前执行。

### 9.2 Router 规则

Router 只能从冻结目录中选择：

- `executionMode`：`direct | agentic | workflow`；
- `normalizedInput`：规范化后的任务；
- `profileKey`：精确执行 Profile；
- `reason`：选择理由；
- `sopResourceId`：只有 Workflow 路线允许填写。

Router 不得自行执行任务、调用工具、创建 Workflow 或选择目录外的资源。

### 9.3 快照与可追溯

正式执行需要持久化运行身份和必要的 Snapshot，至少能够回答：

- 使用了哪个员工或团队；
- 使用了哪个执行路线；
- 使用了哪个模型和连接；
- 使用了哪些 Skill、KnowledgeBase、Connector、SOP；
- 当前配置的 hash/revision；
- 运行期间是否发生错误、取消或恢复。

相同执行请求应幂等复用已有 Snapshot，不能因为重试而偷偷换配置。

## 10. 评估数据集

评估数据集用于维护可重复的测试样本，不承担资源发布审批。

需求：

- 创建和归档 Dataset；
- 创建不可变 Dataset Version；
- 导入 Evaluation Case；
- 规范化 Case 来源 UUID；
- 记录当前员工或全局目标；
- 生成版本 Manifest 和 hash；
- 使用租户范围安全的分页游标；
- 防止跨租户、跨筛选条件复用游标；
- Case 来源需要关联完整的运行 Snapshot/hash。

最新版本不再把标注、审核、变更建议、复盘、灰度或固定 Recovery 作为当前质量流程的一部分。若未来重新引入，必须重新定义权限、数据模型和发布边界，不能恢复旧链路。

## 11. 平台级 API 需求

### 11.1 公共后端边界

后端入口包括：

- `/api/auth`：认证和 Session；
- `/api/admin/users`：平台用户管理；
- `/api/governance`：治理资源、员工、员工组、运行和数据集；
- `/api/projects`：项目、会话、案卷、聊天和运行记录；
- `/health`：基础健康检查。

裸 `/api/agents`、`/api/memory`、`/api/tools`、`/api/vectors`、`/api/workflows` 不能作为前端业务入口，必须由服务端业务 API 进行权限和上下文装配。

### 11.2 错误处理

- 输入使用严格 Schema 校验；
- 权限错误必须返回明确的 401/403；
- 资源不存在、版本冲突、依赖引用和运行失败必须区分错误类型；
- 外部模型、MCP、HTTP、数据库或对象存储失败不得被吞掉；
- 不返回部分成功的治理运行时工具集合；
- 长任务必须支持可观察状态，不得永久停留在“运行中”。

## 12. 数据与存储需求

### 12.1 PostgreSQL

用于保存：

- 用户、角色、作用域和审计；
- 项目、会话和会话附件；
- 治理资源、员工、员工组和绑定关系；
- Dataset、Version、Case；
- 运行身份、Snapshot、执行记录和产物索引；
- Mastra Runtime 存储。

### 12.2 MinIO / 对象存储

用于保存：

- 项目案卷；
- 治理 KnowledgeBase 文件；
- Skill 文件包；
- 其他大体积交付物。

对象存储路径必须按项目、租户或资源身份隔离，删除时要处理对象和数据库引用的一致性。

### 12.3 Redis

用于保存：

- Auth Session；
- 可恢复聊天流；
- 生成状态和必要的运行协调信息。

## 13. 非功能需求

### 13.1 安全

- 所有 `/api/*` 业务接口默认需要认证；
- 服务端是最终权限边界，前端隐藏按钮不能替代权限校验；
- 资源、员工、团队和数据集必须执行 tenant/owner scope 校验；
- API Key、Session 和临时密码不能写入日志或普通响应；
- 外部 Endpoint 需要 Host allowlist，防止 SSRF；
- 项目私有案卷不得泄露到全局 RAG 或不必要的外部 Connector。

### 13.2 可审计

- 资源创建、编辑、发布、取消发布和删除应可追踪；
- 用户安全操作和管理员操作应写审计；
- 运行要保存执行身份、资源引用和错误；
- 证据检索要保留 query、来源、命中和引用信息；
- 测试和调试与生产运行要有清晰的上下文标记。

### 13.3 可恢复性

- 聊天流断开后可重连；
- Workflow 暂停后只能使用真实恢复数据继续；
- 运行取消要有明确终态；
- 进程重启后要清理无法继续的生成状态；
- 不允许通过隐式重试掩盖外部依赖失败。

### 13.4 性能和成本

- Knowledge Lab 检索轮次必须硬上限；
- Router 只进行一次结构化选择；
- Workflow、Connector 和模型测试要有超时；
- 外部 MCP/HTTP 调用不得无限等待；
- Embedding 批量处理和索引写入需要可观测统计；
- 长任务页面要显示状态，避免用户重复提交。

### 13.5 可观测性

需要能够观察：

- Agent Run、LLM Generation、Tool Call；
- RAG 查询和相似度结果；
- Connector 握手、调用和失败；
- Workflow 节点状态；
- 资源 revision、配置 hash 和运行 Snapshot；
- 用户登录、权限和管理审计。

## 14. 当前实现状态与验收重点

### 14.1 当前已经具备的主要能力

- 项目、会话、案卷和回收站；
- 项目级 Copilot 和多路线执行；
- 全局 RAG 离线索引与在线检索；
- 治理资源市场；
- KnowledgeBase、Skill、Connector、SOP、Model 五类资源；
- 数字员工和员工组；
- Direct、Agentic、Workflow 三种执行路线；
- MCP/HTTP Connector 测试和动态工具装配；
- Model BYOK 和模型能力测试；
- SOP Dynamic Workflow 编辑、校验、测试和运行；
- Dataset、Version、Case 管理；
- 平台用户、Session 和审计管理；
- 运行时配置校验、快照和错误边界。

### 14.2 验收必须覆盖的场景

1. 未登录用户访问业务 API 必须被拒绝；
2. 无治理 capability 的用户不能进入治理页面或调用治理 API；
3. 已发布资源被员工引用后不能直接删除；
4. 未发布资源不能进入生产员工；
5. Connector 配置变更后旧 revision 的测试和运行必须被拒绝；
6. SOP 引用缺失时保存、发布和运行必须显式失败；
7. Team 启用时必须保证每租户最多一个启用组；
8. Direct 路线不能调用子 Agent 或 Workflow；
9. Workflow 路线必须真正调用绑定 SOP，不能直接生成替代答案；
10. 知识库文件删除后 Agent 不能继续读取；
11. 项目文件、全局 RAG、KnowledgeBase 和 Connector 的证据来源必须区分；
12. 聊天流断开后可以恢复，停止后进入明确终态；
13. 用户禁用、密码重置和 Session 撤销必须立即生效并写审计；
14. 模型 API Key 不得出现在列表和普通响应中；
15. Dataset 分页游标不能跨 scope、父集合或筛选条件复用。

## 15. 当前明确不应恢复的旧能力

以下能力在最新版本中已经删除或收敛，不应仅因为历史代码或旧文档存在就重新接回：

- 内置独立 Deep Research 运行链；
- 旧 `research-run` Agent/Workflow；
- 旧 Tool 资源模型；
- 独立的资源变更建议流程；
- 标注、审核、复盘和旧质量门；
- 旧 Release Candidate、Rollout、Pointer 和固定 Recovery 控制面；
- 旧 SOP DSL、编译器、解释器和隐藏 fallback；
- 独立的运行模拟路由；
- 通过环境变量注入的系统 Connector 运行路径。

## 16. 需求优先级建议

### P0：生产可用底座

- 认证、权限和租户隔离；
- 项目 Copilot 基本对话；
- 项目案卷读写和只读 Workspace；
- 五类资源的核心 CRUD、发布保护和引用校验；
- 数字员工三路线运行；
- SOP Dynamic Workflow 的保存、测试和生产执行；
- 运行错误、取消和审计。

### P1：效率和质量

- Skill/KnowledgeBase AI 辅助创作；
- Connector 测试 Agent；
- Model 发现和能力测试；
- 员工组委派、并行和汇总；
- Dataset 版本和 Case 导入；
- RAG 检索回归集和运行可观测性。

### P2：增强体验

- 更丰富的项目模板；
- 更完整的交付物预览和下载；
- 治理首页指标；
- 运行历史对比；
- 更细的证据链可视化；
- 多人协作和更复杂的组织权限。

## 17. 参考代码位置

- 最新源码包：`/Users/iriskong/Downloads/ai-lawyer-agent-main (1).zip`
- 治理后端：`ai-lawyer-agent-main/apps/server/src/modules/governance/`
- 治理运行时：`ai-lawyer-agent-main/apps/server/src/modules/governance/runtime/`
- 治理资源：`ai-lawyer-agent-main/apps/server/src/modules/governance/resources/`
- 数字员工：`ai-lawyer-agent-main/apps/server/src/modules/governance/employees/`
- 员工组：`ai-lawyer-agent-main/apps/server/src/modules/governance/teams/`
- 评估数据集：`ai-lawyer-agent-main/apps/server/src/modules/governance/datasets/`
- Mastra Agent：`ai-lawyer-agent-main/apps/server/src/mastra/`
- 项目业务模块：`ai-lawyer-agent-main/apps/server/src/modules/projects/`
- 普通用户前端：`ai-lawyer-agent-main/apps/web/src/pages/_app/` 和 `ai-lawyer-agent-main/apps/web/src/pages/_fullscreen/`
- 治理前端：`ai-lawyer-agent-main/apps/web/src/pages/_admin/`
- 全局 RAG：`ai-lawyer-agent-main/apps/rag/src/`
