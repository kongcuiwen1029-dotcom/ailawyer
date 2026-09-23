import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

/* ────────────────────────────────────────────────────────────────────────────
   Demo state for the whole workspace.

   One owner for every list the prototype can change, so actions in one view
   are visible in another (publishing a resource makes it bindable, activating
   a team deactivates its siblings, and so on). The data mirrors the behaviour
   contracts in ai-docs/AI-Lawyer-Requirements-2026-09.md; it is demo data, not
   a backend client.
   ──────────────────────────────────────────────────────────────────────────── */

export type ResourceKind = 'kb' | 'skill' | 'connector' | 'sop' | 'model'

export interface ResourceFile {
  name: string
  size: string
  uploadedAt: string
  parsed: boolean
  /* 正文。真实应用按文件名回 MinIO 取原文，原型没有对象存储，所以正文只能随
     数据一起来：上传的文件用 `File.text()` 读进来，种子文件取 KB_FILE_CONTENT。
     没这个字段就表示这份文件没有可预览的正文，预览面板显示空态而不是瞎猜。 */
  content?: string
}

export interface ConnectorTool {
  name: string
  description: string
  write: boolean
}

export type SopNodeKind = 'start' | 'agent' | 'tool' | 'workflow' | 'condition' | 'loop' | 'end'

export interface SopNode {
  id: string
  kind: SopNodeKind
  title: string
  ref?: string
  note?: string
  wired: boolean
}

export interface SopEdge {
  from: string
  to: string
}

export interface GovernanceResource {
  id: string
  kind: ResourceKind
  name: string
  key: string
  summary: string
  published: boolean
  revision: number
  owner: string
  updated: string
  /** kb */
  files?: ResourceFile[]
  /** connector */
  connectorType?: 'mcp' | 'http'
  endpoint?: string
  httpMethod?: string
  tools?: ConnectorTool[]
  handshakeAt?: string
  /** sop */
  nodes?: SopNode[]
  edges?: SopEdge[]
  validationErrors?: string[]
  dependencies?: string[]
  /** model */
  baseUrl?: string
  models?: string[]
  defaultModel?: string
  keyMasked?: string
  capability?: { status: 'ok' | 'warn' | 'pending'; latencyMs?: number; note: string }
}

export interface EmployeeBinding {
  resourceId: string
  purpose: string
  enabled: boolean
}

export interface Employee {
  id: string
  name: string
  key: string
  description: string
  instructions: string
  status: 'draft' | 'active'
  revision: number
  bindings: EmployeeBinding[]
  updated: string
}

export interface TeamMember {
  employeeId: string
  duty: string
}

export interface Team {
  id: string
  name: string
  description: string
  status: 'draft' | 'active'
  modelResourceId: string
  members: TeamMember[]
  maxDelegations: number
  maxParallel: number
  revision: number
  updated: string
}

export interface ScopeGrant {
  type: 'platform' | 'tenant' | 'project'
  target: string
}

export interface AdminUser {
  id: string
  name: string
  email: string
  roles: string[]
  scopes: ScopeGrant[]
  status: 'active' | 'disabled'
  mustChangePassword: boolean
  lastLogin: string
  lastSeen: string
  sessions: { id: string; device: string; ip: string; lastSeen: string }[]
}

export interface AuditEntry {
  id: string
  time: string
  actor: string
  action: string
  target: string
  detail: string
}

export interface Project {
  id: string
  name: string
  desc: string
  sessions: number
  updated: string
  tenant: string
  status: { kind: 'ok' | 'run' | 'draft' | 'warn'; label: string }
  deletedAt?: string
  /* 案件类型，对应服务端 `Project.caseType`（自由文本）。新建与编辑表单都不收
     这个字段（对齐真实应用），所以只有种子项目带它。 */
  caseType?: string
}

export const ROLE_CAPABILITIES: Record<string, string[]> = {
  super_admin: ['admin.users.manage', 'admin.users.roles.manage', 'admin.users.scopes.manage', 'admin.passwords.reset', 'admin.sessions.read', 'admin.sessions.revoke', 'admin.login_audit.read', 'admin.audit.read', 'admin.super_admin.manage', 'governance.read'],
  admin: ['admin.users.manage', 'admin.users.create', 'admin.users.update', 'admin.users.disable', 'admin.passwords.reset', 'admin.sessions.read', 'admin.sessions.revoke', 'admin.login_audit.read', 'admin.audit.read', 'governance.read'],
  lawyer_admin: ['governance.read', 'governance.resources.edit'],
  governance_super_admin: ['governance.read', 'governance.resources.edit', 'governance.manage_all'],
  user: [],
}

export const KNOWN_CAPABILITIES = [
  'admin.users.manage', 'admin.users.read', 'admin.users.create', 'admin.users.update', 'admin.users.disable',
  'admin.users.roles.manage', 'admin.users.scopes.manage', 'admin.passwords.reset', 'admin.sessions.read',
  'admin.sessions.revoke', 'admin.login_audit.read', 'admin.audit.read', 'admin.super_admin.manage',
  'governance.read', 'governance.manage_all', 'governance.resources.edit',
]

export const TENANTS = ['律所本部', '上海分所', '深圳分所']
export const CURRENT_USER_ID = 'u-zhang'

/* ── seed data ── */

/* 知识库文件的正文。真实应用从对象存储读原文，原型没有那一层，所以预览面板要显示
   什么只能写在种子数据里。每份都是文件的**纲要**（收录范围、章节结构、使用提示），
   不逐字抄条文：原型没有校对过法律文本，抄进去就等于伪造法条。章节名与施行日期
   是公开事实，可以照写。 */
const KB_FILE_CONTENT: Record<string, string> = {
  '民法典-合同编.md': `# 民法典·合同编（现行有效）

- 法域：中国大陆
- 收录范围：民法典第三编「合同」全文，以及合同编通则部分的适用要点
- 版本：2020 年通过 · 2021 年 1 月 1 日施行
- 最后校对：2026-09-12

## 第一分编 通则

### 第一章 一般规定
- 调整范围：因合同产生的民事关系
- 婚姻、收养、监护等身份关系的协议，适用其他法律规定
- 非因合同产生的债权债务关系，没有特别规定的，适用本编通则

### 第二章 合同的订立
- 合同形式：书面、口头或者其他形式
- 要约与承诺：构成要件、生效时点、撤回与撤销
- 格式条款：提示说明义务、不合理免责条款的效力、不利解释规则
- 缔约过失责任

### 第三章 合同的效力
- 生效时点与附条件、附期限
- 无效、可撤销、效力待定三类情形
- 无权代理与表见代理

### 第四章 合同的履行
- 全面履行原则与诚信原则
- 履行主体、地点、期限、方式约定不明时的补充规则
- 同时履行抗辩、先履行抗辩、不安抗辩

### 第五章 合同的保全
- 债权人代位权
- 债权人撤销权

### 第六章 合同的变更和转让
### 第七章 合同的权利义务终止
- 清偿、抵销、提存、免除、混同
- 法定解除与约定解除的条件与后果

### 第八章 违约责任
- 继续履行、采取补救措施、赔偿损失
- 违约金与定金规则
- 不可抗力与情势变更

## 第二分编 典型合同
买卖 · 供用电水气热力 · 赠与 · 借款 · 保证 · 租赁 · 融资租赁 · 保理 ·
承揽 · 建设工程 · 运输 · 技术 · 保管 · 仓储 · 委托 · 物业服务 · 合伙 ·
无因管理`,

  '公司法-2023修订.md': `# 公司法（2023 年修订）

- 法域：中国大陆
- 版本：2023 年修订 · 2024 年 7 月 1 日施行
- 最后校对：2026-09-12

## 本次修订的主要变化
- 有限责任公司股东认缴出资：自公司成立之日起五年内缴足
- 出资加速到期：公司不能清偿到期债务时，公司或已到期债权人可要求提前缴纳
- 法定代表人由代表公司执行事务的董事或者经理担任，辞任规则明确
- 股东会与董事会职权调整，审计委员会可以替代监事会
- 新增简易注销与强制注销程序

## 章节结构
1. 总则
2. 公司登记
3. 有限责任公司的设立和组织机构
4. 有限责任公司的股权转让
5. 股份有限公司的设立和组织机构
6. 股份有限公司的股份发行和转让
7. 国家出资公司组织机构的特别规定
8. 公司董事、监事、高级管理人员的资格和义务
9. 公司债券
10. 公司财务、会计
11. 公司合并、分立、增资、减资
12. 公司解散和清算
13. 外国公司的分支机构
14. 法律责任
15. 附则

## 使用提示
- 文件保留 2023 年修订文本的章节层级，旧版条文以批注形式附在各章末尾
- 检索「五年」「加速到期」「审计委员会」可以直接定位到本次修订的变化点
- 董事、监事、高级管理人员的忠实义务与勤勉义务集中在本文件第 8 章`,

  '合同编通则司法解释.txt': `合同编通则司法解释 · 条文与适用要点
========================================

法域：中国大陆
版本：2023 年 12 月 5 日施行
最后校对：2026-09-12
排版：纯文本，不做 Markdown 渲染

----------------------------------------------------------------
一、一般规定
----------------------------------------------------------------

1. 合同条款的解释
   按照词句的通常含义、相关条款、合同目的、交易习惯以及诚信原则确定。

2. 预约合同
   认定标准、违反预约的赔偿责任范围。

3. 格式条款的提示说明义务
   以通常足以引起对方注意的方式提示；未履行的，对方可以主张该条款
   不成为合同的内容。

----------------------------------------------------------------
二、合同的订立
----------------------------------------------------------------

4. 要约与承诺的生效时点
5. 电子合同的成立与交付时间
6. 悬赏广告

----------------------------------------------------------------
三、合同的效力
----------------------------------------------------------------

7. 强制性规定的识别
8. 越权代表与表见代表
9. 印章与合同效力

----------------------------------------------------------------
四、合同的履行
----------------------------------------------------------------

10. 以物抵债协议的效力与履行
11. 情势变更的认定与后果
12. 债权人代位权的行使范围

----------------------------------------------------------------
五、违约责任
----------------------------------------------------------------

13. 违约金过高的调整标准
14. 定金与违约金的并用
15. 损失赔偿的可预见规则`,

  '担保制度解释-批注.txt': `担保制度解释 · 批注版
======================

法域：中国大陆
来源：最高人民法院关于适用民法典有关担保制度的解释
状态：等待解析
排版：纯文本

----------------------------------------------------------------
批注说明
----------------------------------------------------------------
本版在每组要点后以「▲」标记承办律师的批注，记录适用时的注意点与
本地法院的裁判倾向。批注不构成平台意见，仅供所内检索参考。

----------------------------------------------------------------
一、关于一般规定
----------------------------------------------------------------
▲ 担保的从属性：主合同无效时担保合同的效力认定，各法院口径不一致，
  建议在起诉时同时主张备位请求。

----------------------------------------------------------------
二、关于保证合同
----------------------------------------------------------------
▲ 一般保证与连带责任保证的推定规则已改变，约定不明时按一般保证
  处理。

----------------------------------------------------------------
三、关于担保物权
----------------------------------------------------------------
▲ 动产抵押未登记的对抗效力。
▲ 正常经营买受人的认定。

----------------------------------------------------------------
四、关于非典型担保
----------------------------------------------------------------
▲ 所有权保留、融资租赁、保理在功能主义下的适用边界。`,

  '股权转让协议-范本.txt': `股权转让协议（范本）
====================

本范本由律所内部整理，供承办律师起草时参考；条款中的方括号为待填项。
范本不构成对具体交易的结论性意见，签署前须完成尽职调查与冲突检索。

----------------------------------------------------------------
第一条 转让标的
----------------------------------------------------------------
1.1 转让方持有目标公司 [  ]% 的股权，对应认缴出资额人民币 [  ] 万元。
1.2 标的股权不存在质押、冻结或者其他权利负担。

第二条 转让价款与支付
2.1 转让价款为人民币 [  ] 元。
2.2 支付节点：本协议生效后 [  ] 个工作日内支付 [  ]%，工商变更登记
    完成后支付余款。

第三条 交割与工商变更
第四条 陈述与保证
第五条 过渡期安排
第六条 违约责任
第七条 争议解决

----------------------------------------------------------------
起草提示
----------------------------------------------------------------
- 公司法 2023 年修订后，其他股东优先购买权的通知程序与答复期须按
  新法重写
- 分期付款的股权转让，注意分期付款买卖解除规则的适用
- 价款与债务承担分离时，明确目标公司债务的承担主体`,
}

const seedResources: GovernanceResource[] = [
  {
    id: 'r-kb-civil', kind: 'kb', name: '民商法法规库', key: 'kb.civil-commercial',
    summary: '民法典、公司法与司法解释的现行有效版本，按领域与法域标注。',
    published: true, revision: 14, owner: '张律', updated: '2 天前',
    files: [
      { name: '民法典-合同编.md', size: '412 KB', uploadedAt: '2 天前', parsed: true, content: KB_FILE_CONTENT['民法典-合同编.md'] },
      { name: '公司法-2023修订.md', size: '286 KB', uploadedAt: '3 天前', parsed: true, content: KB_FILE_CONTENT['公司法-2023修订.md'] },
      { name: '合同编通则司法解释.txt', size: '96 KB', uploadedAt: '上周', parsed: true, content: KB_FILE_CONTENT['合同编通则司法解释.txt'] },
      { name: '担保制度解释-批注.txt', size: '58 KB', uploadedAt: '上周', parsed: false, content: KB_FILE_CONTENT['担保制度解释-批注.txt'] },
    ],
  },
  {
    id: 'r-kb-tpl', kind: 'kb', name: '内部合同模板', key: 'kb.contract-tpl',
    summary: '律所自有的交易文件范本，仅本租户可用。',
    published: false, revision: 2, owner: '张律', updated: '昨天',
    files: [{ name: '股权转让协议-范本.txt', size: '74 KB', uploadedAt: '昨天', parsed: true, content: KB_FILE_CONTENT['股权转让协议-范本.txt'] }],
  },
  {
    id: 'r-skill-risk', kind: 'skill', name: '合同条款风险评估', key: 'skill.contract-risk',
    summary: '逐条比对范本与目标合同，标注风险条款、偏离项与谈判建议，输出结构化清单。',
    published: true, revision: 9, owner: '张律', updated: '3 天前',
    files: [
      { name: 'SKILL.md', size: '6 KB', uploadedAt: '3 天前', parsed: true },
      { name: 'rules/payment.md', size: '4 KB', uploadedAt: '3 天前', parsed: true },
      { name: 'rules/liability.md', size: '5 KB', uploadedAt: '3 天前', parsed: true },
      { name: 'schema/output.json', size: '2 KB', uploadedAt: '3 天前', parsed: true },
    ],
  },
  {
    id: 'r-conn-pkulaw', kind: 'connector', name: '北大法宝 MCP', key: 'conn.pkulaw',
    summary: '法律法规与案例检索，按需加载工具，普通问答不连接远端。',
    published: true, revision: 3, owner: '张律', updated: '4 天前',
    connectorType: 'mcp', endpoint: 'https://mcp.example-pkulaw.cn/sse', handshakeAt: '4 天前 · 握手成功',
    tools: [
      { name: 'search_law', description: '按关键词检索法律法规', write: false },
      { name: 'get_law_detail', description: '读取法条全文与时效状态', write: false },
      { name: 'search_case', description: '检索裁判文书与要旨', write: false },
    ],
  },
  {
    id: 'r-conn-corp', kind: 'connector', name: '企业信息 HTTP', key: 'conn.corp-info',
    summary: '工商登记信息查询，单个工具，输入输出都按 Schema 校验。',
    published: true, revision: 6, owner: '李律', updated: '上周',
    connectorType: 'http', endpoint: 'https://api.example-corp.com/v1/company', httpMethod: 'GET',
    tools: [{ name: 'company_profile', description: '按统一社会信用代码返回工商登记信息', write: false }],
  },
  {
    id: 'r-conn-judgment', kind: 'connector', name: '裁判文书检索', key: 'conn.judgments',
    summary: '待配置请求头与输入 Schema，尚未通过连通性测试。',
    published: false, revision: 1, owner: '李律', updated: '昨天',
    connectorType: 'mcp', endpoint: 'https://mcp.example-judgment.cn/sse',
    tools: [],
  },
  {
    id: 'r-sop-contract', kind: 'sop', name: '合同审查工作流', key: 'sop.contract-review',
    summary: '读取项目案卷，按条款类型分批审查，输出风险清单与谈判建议。',
    published: true, revision: 11, owner: '张律', updated: '今天',
    dependencies: ['skill.contract-risk', 'kb.civil-commercial'],
    nodes: [
      { id: 'n1', kind: 'start', title: '开始', wired: true },
      { id: 'n2', kind: 'agent', title: '条款切分', ref: '合同审查员', wired: true },
      { id: 'n3', kind: 'condition', title: '是否含付款条款', note: '业务语言：合同里出现过付款、账期或结算安排', wired: true },
      { id: 'n4', kind: 'agent', title: '付款条款风险判断', ref: '合同审查员', wired: true },
      { id: 'n5', kind: 'agent', title: '其他条款风险判断', ref: '合同审查员', wired: true },
      { id: 'n6', kind: 'workflow', title: '证据目录编排', ref: 'sop.evidence-index', wired: true },
      { id: 'n7', kind: 'agent', title: '输出风险清单', ref: '合同审查员', wired: true },
      { id: 'n8', kind: 'end', title: '结束', wired: true },
      { id: 'n9', kind: 'tool', title: '企业信息核验', ref: 'conn.corp-info', note: '游离节点：未接入主流程，不参与保存', wired: false },
    ],
    edges: [
      { from: 'n1', to: 'n2' }, { from: 'n2', to: 'n3' },
      { from: 'n3', to: 'n4' }, { from: 'n3', to: 'n5' },
      { from: 'n4', to: 'n6' }, { from: 'n5', to: 'n6' },
      { from: 'n6', to: 'n7' }, { from: 'n7', to: 'n8' },
    ],
  },
  {
    id: 'r-sop-dd', kind: 'sop', name: '尽职调查流程', key: 'sop.due-diligence',
    summary: '股权、历史沿革与合规风险三条并行分支，汇合后生成尽调报告框架。',
    published: true, revision: 8, owner: '张律', updated: '5 天前',
    dependencies: ['kb.civil-commercial'],
    nodes: [
      { id: 'd1', kind: 'start', title: '开始', wired: true },
      { id: 'd2', kind: 'loop', title: '逐个股东核查', note: '业务语言：还有未核查的股东时继续', wired: true },
      { id: 'd3', kind: 'agent', title: '股权结构核验', ref: '尽调助理', wired: true },
      { id: 'd4', kind: 'agent', title: '历史沿革核验', ref: '尽调助理', wired: true },
      { id: 'd5', kind: 'agent', title: '合规风险核验', ref: '尽调助理', wired: true },
      { id: 'd6', kind: 'agent', title: '生成报告框架', ref: '尽调助理', wired: true },
      { id: 'd7', kind: 'end', title: '结束', wired: true },
    ],
    edges: [
      { from: 'd1', to: 'd2' }, { from: 'd2', to: 'd3' },
      { from: 'd2', to: 'd4' }, { from: 'd2', to: 'd5' },
      { from: 'd3', to: 'd6' }, { from: 'd4', to: 'd6' }, { from: 'd5', to: 'd6' },
      { from: 'd6', to: 'd7' },
    ],
  },
  {
    id: 'r-sop-evidence', kind: 'sop', name: '证据目录编排', key: 'sop.evidence-index',
    summary: '按争点归集证据并生成目录，输出未接好，保存与发布被阻止。',
    published: false, revision: 2, owner: '李律', updated: '昨天',
    validationErrors: ['节点「生成证据目录」的输出未连接到结束节点。'],
    nodes: [
      { id: 'e1', kind: 'start', title: '开始', wired: true },
      { id: 'e2', kind: 'agent', title: '按争点归集证据', ref: '法律检索员', wired: true },
      { id: 'e3', kind: 'agent', title: '生成证据目录', ref: '法律检索员', wired: true },
      { id: 'e4', kind: 'end', title: '结束', wired: true },
    ],
    edges: [{ from: 'e1', to: 'e2' }, { from: 'e2', to: 'e3' }],
  },
  {
    id: 'r-model-opus', kind: 'model', name: 'Claude Opus（系统托管）', key: 'model.sys-opus',
    summary: '平台托管的默认模型，无需自带密钥。',
    published: true, revision: 1, owner: '平台', updated: '长期有效',
    baseUrl: 'https://gateway.example-nomos.cn/v1', models: ['claude-opus-5', 'claude-sonnet-5'],
    defaultModel: 'claude-opus-5', keyMasked: '平台托管 · 无密钥',
    capability: { status: 'ok', latencyMs: 820, note: '能力测试通过 · 流式与工具调用可用' },
  },
  {
    id: 'r-model-byok', kind: 'model', name: 'BYOK · GPT 兼容端点', key: 'model.byok-oai',
    summary: '本租户自带的 OpenAI 兼容端点，凭证加密保存。',
    published: true, revision: 4, owner: '张律', updated: '3 天前',
    baseUrl: 'https://api.example-gateway.cn/v1', models: ['gpt-5.2', 'gpt-5.2-mini', 'o5'],
    defaultModel: 'gpt-5.2', keyMasked: 'sk-••••••••••••8f2a',
    capability: { status: 'ok', latencyMs: 1140, note: '能力测试通过 · 3 个 Model ID 均已登记' },
  },
  {
    id: 'r-model-local', kind: 'model', name: 'BYOK · 本地推理', key: 'model.byok-local',
    summary: '内网推理端点，Endpoint Host 尚未通过允许列表校验。',
    published: false, revision: 1, owner: '张律', updated: '昨天',
    baseUrl: 'http://10.0.3.11:8000/v1', models: ['qwen3-32b'], defaultModel: 'qwen3-32b',
    keyMasked: 'sk-••••••••••••11c4',
    capability: { status: 'warn', note: 'Host 未在允许列表中，无法保存连接' },
  },
]

const seedEmployees: Employee[] = [
  {
    id: 'e-contract', name: '合同审查员', key: 'emp.contract-reviewer', status: 'active', revision: 12, updated: '今天',
    description: '审查交易文件条款，输出风险清单与谈判建议。',
    instructions: '保持合同审查任务的范围；逐条比对范本与目标合同；证据足以支撑结论后直接给出风险清单与建议，并注明条款位置；不自行扩展研究要求，不隐式重试。',
    bindings: [
      { resourceId: 'r-model-opus', purpose: '主模型', enabled: true },
      { resourceId: 'r-skill-risk', purpose: '条款风险判断方法', enabled: true },
      { resourceId: 'r-sop-contract', purpose: '固定审查流程', enabled: true },
      { resourceId: 'r-kb-civil', purpose: '法条与司法解释依据', enabled: true },
    ],
  },
  {
    id: 'e-researcher', name: '法律检索员', key: 'emp.legal-researcher', status: 'active', revision: 7, updated: '2 天前',
    description: '把问题改写成检索式，在法规库与判例库中查证并标注来源。',
    instructions: '保留用户原始语言检索；标注每条依据的来源、时效与适用条件；检索结果不足时直接说明缺口，不用常识补足。',
    bindings: [
      { resourceId: 'r-model-byok', purpose: '主模型', enabled: true },
      { resourceId: 'r-conn-pkulaw', purpose: '法规与案例检索', enabled: true },
      { resourceId: 'r-kb-civil', purpose: '法规库', enabled: true },
    ],
  },
  {
    id: 'e-dd', name: '尽调助理', key: 'emp.dd-assistant', status: 'draft', revision: 3, updated: '昨天',
    description: '按股权、沿革与合规三条线梳理尽调事实。',
    instructions: '按项目案卷登记事实；标出材料缺失项；(待补充)',
    bindings: [
      { resourceId: 'r-model-opus', purpose: '主模型', enabled: true },
      { resourceId: 'r-sop-dd', purpose: '尽调流程', enabled: true },
      { resourceId: 'r-conn-corp', purpose: '工商登记核验', enabled: true },
    ],
  },
  {
    id: 'e-ip', name: '知识产权专员', key: 'emp.ip-specialist', status: 'active', revision: 4, updated: '上周',
    description: '梳理商标、著作权与专利的权利状态，评估冲突与侵权风险。',
    instructions: '先确认权利类型与权利状态，再判断冲突风险；权利状态不确定时标注待核验，不推断权利人。',
    bindings: [
      { resourceId: 'r-model-opus', purpose: '主模型', enabled: true },
      { resourceId: 'r-kb-civil', purpose: '法条与司法解释依据', enabled: true },
    ],
  },
]

const seedTeams: Team[] = [
  {
    id: 't-litigation', name: '诉讼支持小组', status: 'active', revision: 5, updated: '今天',
    description: '主管按争点拆解任务并委派成员，汇总后统一交付。',
    modelResourceId: 'r-model-opus',
    members: [
      { employeeId: 'e-contract', duty: '条款与合同事实' },
      { employeeId: 'e-researcher', duty: '法规与判例检索' },
    ],
    maxDelegations: 8, maxParallel: 3,
  },
  {
    id: 't-deal', name: '交易顾问小组', status: 'draft', revision: 2, updated: '昨天',
    description: '成员分工待补充，主管模型已指定。',
    modelResourceId: 'r-model-byok',
    members: [{ employeeId: 'e-dd', duty: '事实梳理（待补充）' }],
    maxDelegations: 4, maxParallel: 2,
  },
]

const seedUsers: AdminUser[] = [
  {
    id: 'u-zhang', name: '张律', email: 'zhang@example-law.cn', roles: ['super_admin', 'governance_super_admin'],
    scopes: [{ type: 'platform', target: '平台' }, { type: 'tenant', target: '律所本部' }],
    status: 'active', mustChangePassword: false, lastLogin: '今天 09:14', lastSeen: '刚刚',
    sessions: [{ id: 's-a1', device: 'macOS · Chrome', ip: '10.240.70.31', lastSeen: '刚刚' }],
  },
  {
    id: 'u-li', name: '李律', email: 'li@example-law.cn', roles: ['lawyer_admin'],
    scopes: [{ type: 'tenant', target: '律所本部' }],
    status: 'active', mustChangePassword: false, lastLogin: '今天 10:02', lastSeen: '12 分钟前',
    sessions: [{ id: 's-b2', device: 'Windows · Edge', ip: '10.240.70.44', lastSeen: '12 分钟前' }],
  },
  {
    id: 'u-wang', name: '王实习', email: 'wang@example-law.cn', roles: ['user'],
    scopes: [{ type: 'tenant', target: '律所本部' }, { type: 'tenant', target: '上海分所' }],
    status: 'active', mustChangePassword: true, lastLogin: '昨天 18:20', lastSeen: '昨天',
    sessions: [{ id: 's-c3', device: 'iPad · Safari', ip: '10.240.70.91', lastSeen: '昨天' }],
  },
  {
    id: 'u-chen', name: '陈顾问', email: 'chen@example-law.cn', roles: ['user'],
    scopes: [{ type: 'project', target: '海德科技 A 轮融资尽调' }],
    status: 'disabled', mustChangePassword: false, lastLogin: '上周', lastSeen: '-',
    sessions: [],
  },
]

const seedLoginAudit: AuditEntry[] = [
  { id: 'la-1', time: '今天 09:14', actor: '张律', action: 'login_success', target: 'zhang@example-law.cn', detail: 'macOS · Chrome · 10.240.70.31' },
  { id: 'la-2', time: '今天 08:51', actor: '未知账号', action: 'login_failure', target: 'admin@example-law.cn', detail: '密码错误 1 次 · 10.240.70.77' },
  { id: 'la-3', time: '昨天 18:20', actor: '王实习', action: 'password_reset_first_login', target: 'wang@example-law.cn', detail: '首次登录强制改密已下发' },
  { id: 'la-4', time: '昨天 18:19', actor: '张律', action: 'logout', target: 'zhang@example-law.cn', detail: '会话已结束' },
]

const seedAdminAudit: AuditEntry[] = [
  { id: 'aa-1', time: '今天 10:26', actor: '张律', action: 'authorization_replaced', target: '李律', detail: 'roles=[lawyer_admin] scopes=[tenant:律所本部]' },
  { id: 'aa-2', time: '今天 10:05', actor: '张律', action: 'sessions_revoked', target: '王实习', detail: '吊销 2 个活跃会话' },
  { id: 'aa-3', time: '昨天 17:12', actor: '张律', action: 'password_reset', target: '王实习', detail: '已下发临时密码，要求首登改密' },
  { id: 'aa-4', time: '昨天 16:48', actor: '张律', action: 'user_created', target: '陈顾问', detail: 'roles=[user] scopes=[project:海德科技 A 轮融资尽调]' },
]

const seedProjects: Project[] = [
  {
    id: 'haide-due-diligence', name: '海德科技 A 轮融资尽调', desc: '股权结构、历史沿革与合规风险梳理，输出尽调报告框架。',
    caseType: '投融资', sessions: 8, updated: '12 分钟前', tenant: '律所本部', status: { kind: 'run', label: '生成中' },
  },
  {
    id: 'supply-chain-contract', name: '供应链框架合同审查', desc: '审查付款、违约与不可抗力条款，标注偏离与谈判建议。',
    caseType: '合同审查', sessions: 5, updated: '1 小时前', tenant: '律所本部', status: { kind: 'warn', label: '等待确认' },
  },
  {
    id: 'labor-dispute-timeline', name: '劳动争议应诉时间线', desc: '按证据目录构建争议事实时间线与举证责任分配。',
    caseType: '劳动争议', sessions: 12, updated: '昨天', tenant: '上海分所', status: { kind: 'ok', label: '已完成' },
  },
  {
    id: 'gdpr-comparison', name: '数据合规 GDPR 对标', desc: '对比境内外数据出境要求，生成整改清单。',
    caseType: '数据合规', sessions: 3, updated: '3 天前', tenant: '上海分所', status: { kind: 'ok', label: '已完成' },
  },
  {
    id: 'trademark-response', name: '商标异议答辩草案', desc: '检索近似商标，起草答辩理由与证据框架。',
    caseType: '知识产权', sessions: 2, updated: '上周', tenant: '深圳分所', status: { kind: 'draft', label: '草稿' },
  },
  {
    id: 'recycle-lease', name: '厂房租赁合同审阅', desc: '已删除的项目，保留 30 天后彻底清空。',
    caseType: '房地产', sessions: 1, updated: '3 天前', tenant: '律所本部', status: { kind: 'draft', label: '已删除' }, deletedAt: '3 天前',
  },
]

/* ── context ── */

export interface Notice {
  id: number
  tone: 'ok' | 'warn' | 'info'
  text: string
}

interface WorkspaceValue {
  resources: GovernanceResource[]
  employees: Employee[]
  teams: Team[]
  users: AdminUser[]
  loginAudit: AuditEntry[]
  adminAudit: AuditEntry[]
  projects: Project[]
  notices: Notice[]
  notify: (text: string, tone?: Notice['tone']) => void
  dismissNotice: (id: number) => void
  /* resources */
  createResource: (kind: ResourceKind, name: string, summary: string) => string
  toggleResourcePublished: (id: string) => void
  deleteResource: (id: string) => void
  updateResource: (id: string, patch: Partial<GovernanceResource>) => void
  addKnowledgeFile: (id: string, name: string, size: string, content?: string) => void
  removeKnowledgeFile: (id: string, name: string) => void
  addConnectorTool: (id: string, tool: ConnectorTool) => void
  /* employees */
  createEmployee: (name: string, description: string) => string
  updateEmployee: (id: string, patch: Partial<Employee>) => void
  pushEmployee: (id: string) => void
  disableEmployee: (id: string) => void
  deleteEmployee: (id: string) => void
  /* teams */
  createTeam: (name: string, description: string) => string
  updateTeam: (id: string, patch: Partial<Team>) => void
  activateTeam: (id: string) => void
  disableTeam: (id: string) => void
  toggleTeamMember: (id: string, employeeId: string) => void
  /* users */
  createUser: (name: string, email: string, roles: string[], scopes: ScopeGrant[]) => void
  replaceAuthorization: (id: string, roles: string[], scopes: ScopeGrant[]) => void
  resetUserPassword: (id: string) => void
  toggleUserStatus: (id: string) => void
  revokeUserSessions: (id: string) => void
  /* projects */
  createProject: (name: string, description: string, tenant: string) => string
  updateProject: (id: string, name: string, description: string) => void
  deleteProject: (id: string) => void
  restoreProject: (id: string) => void
  purgeProject: (id: string) => void
  emptyRecycleBin: () => void
  setProjectStatus: (id: string, status: Project['status']) => void
  bumpProjectSessions: (id: string) => void
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [resources, setResources] = useState(seedResources)
  const [employees, setEmployees] = useState(seedEmployees)
  const [teams, setTeams] = useState(seedTeams)
  const [users, setUsers] = useState(seedUsers)
  const [loginAudit, setLoginAudit] = useState(seedLoginAudit)
  const [adminAudit, setAdminAudit] = useState(seedAdminAudit)
  const [projects, setProjects] = useState(seedProjects)
  const [notices, setNotices] = useState<Notice[]>([])

  const notify = useCallback((text: string, tone: Notice['tone'] = 'info') => {
    const id = Date.now() + Math.random()
    setNotices(current => [...current, { id, tone, text }])
    window.setTimeout(() => setNotices(current => current.filter(notice => notice.id !== id)), 4200)
  }, [])

  const dismissNotice = useCallback((id: number) => {
    setNotices(current => current.filter(notice => notice.id !== id))
  }, [])

  const updateResource = useCallback((id: string, patch: Partial<GovernanceResource>) => {
    setResources(current => current.map(resource => resource.id === id ? { ...resource, ...patch } : resource))
  }, [])

  /* ── resources ── */

  const createResource = useCallback((kind: ResourceKind, name: string, summary: string) => {
    const id = `r-${kind}-${Date.now()}`
    setResources(current => [
      {
        id, kind, name, summary: summary || '尚未填写说明。',
        key: resourceKeyOf(kind, name, current),
        published: false, revision: 1, owner: '张律', updated: '刚刚',
        ...(kind === 'kb' ? { files: [] } : {}),
        ...(kind === 'connector' ? { connectorType: 'mcp' as const, endpoint: '', tools: [] } : {}),
        ...(kind === 'sop' ? { nodes: [], edges: [], dependencies: [] } : {}),
        ...(kind === 'model' ? { baseUrl: '', models: [], defaultModel: '', keyMasked: '尚未填写密钥', capability: { status: 'pending' as const, note: '尚未测试' } } : {}),
        ...(kind === 'skill' ? { files: [] } : {}),
      },
      ...current,
    ])
    notify(`已创建${kindLabel(kind)}资源「${name}」，保存并发布后才能被员工绑定。`, 'ok')
    return id
  }, [notify])

  const toggleResourcePublished = useCallback((id: string) => {
    const resource = resources.find(item => item.id === id)
    if (!resource) return
    if (!resource.published && resource.kind === 'sop' && (resource.validationErrors?.length ?? 0) > 0) {
      notify('SOP 校验未通过，已阻止发布：输出未连接到结束节点。', 'warn')
      return
    }
    const next = !resource.published
    setResources(current => current.map(item => item.id === id
      ? { ...item, published: next, revision: next ? item.revision + 1 : item.revision }
      : item))
    notify(next
      ? `「${resource.name}」已发布（revision r${resource.revision + 1}）`
      : `「${resource.name}」已取消发布，已有引用会被保留但不能再被新员工绑定。`, next ? 'ok' : 'info')
  }, [notify, resources])

  /* `content` 由调用方读出文件原文后传进来（真实应用那一步是在服务端做的）。传了
     undefined 就是没读到正文，预览面板显示空态。 */
  const addKnowledgeFile = useCallback((id: string, name: string, size: string, content?: string) => {
    const replaced = (resources.find(resource => resource.id === id)?.files ?? []).some(file => file.name === name)
    setResources(current => current.map(resource => {
      if (resource.id !== id) return resource
      const rest = (resource.files ?? []).filter(file => file.name !== name)
      return { ...resource, files: [...rest, { name, size, uploadedAt: '刚刚', parsed: true, ...(content === undefined ? {} : { content }) }] }
    }))
    notify(replaced ? `同名文件「${name}」已覆盖并重新解析（${size}）。` : `已上传 ${name}（${size}）`, 'ok')
  }, [notify, resources])

  const removeKnowledgeFile = useCallback((id: string, name: string) => {
    setResources(current => current.map(resource => resource.id === id
      ? { ...resource, files: (resource.files ?? []).filter(file => file.name !== name) }
      : resource))
    notify(`已删除 ${name}，Agent 不能再读取该文件。`)
  }, [notify])

  /* 删除只在未发布时可执行，和真实应用列表页把删除按钮 disabled 的条件一致
     （已发布的资源要先取消发布）。取消发布不会解绑已有引用，所以理论上仍可能
     存在「未发布但被员工绑定」的资源——那种情况照 deleteEmployee 的既有做法把
     绑定一并解除，而不是留下悬空引用。 */
  const deleteResource = useCallback((id: string) => {
    const resource = resources.find(item => item.id === id)
    if (!resource) return
    if (resource.published) {
      notify(`「${resource.name}」已发布，请先取消发布再删除。`, 'warn')
      return
    }
    const bound = employees.filter(employee => employee.bindings.some(binding => binding.resourceId === id))
    setResources(current => current.filter(item => item.id !== id))
    if (!bound.length) {
      notify(`已删除「${resource.name}」。`, 'warn')
      return
    }
    setEmployees(current => current.map(employee => employee.bindings.some(binding => binding.resourceId === id)
      ? { ...employee, bindings: employee.bindings.filter(binding => binding.resourceId !== id) }
      : employee))
    notify(`已删除「${resource.name}」，并从${bound.map(employee => `「${employee.name}」`).join('、')}解除了该绑定。`, 'warn')
  }, [employees, notify, resources])

  const addConnectorTool = useCallback((id: string, tool: ConnectorTool) => {
    const resource = resources.find(item => item.id === id)
    if (!resource) return
    if ((resource.tools ?? []).some(existing => existing.name === tool.name)) {
      notify(`工具名 ${tool.name} 与已有工具冲突，未加入（CONNECTOR_TOOL_NAME_CONFLICT）。`, 'warn')
      return
    }
    setResources(current => current.map(item => item.id === id
      ? { ...item, tools: [...(item.tools ?? []), tool] }
      : item))
  }, [notify, resources])

  /* ── employees ── */

  const createEmployee = useCallback((name: string, description: string) => {
    const id = `e-${Date.now()}`
    setEmployees(current => [
      {
        id, name, key: `emp.${Date.now().toString(36).slice(-4)}`, description: description || '尚未填写说明。',
        instructions: '', status: 'draft', revision: 1, bindings: [], updated: '刚刚',
      },
      ...current,
    ])
    notify(`已创建数字员工「${name}」，当前为草稿状态，配置完成后再发布。`, 'ok')
    return id
  }, [notify])

  const updateEmployee = useCallback((id: string, patch: Partial<Employee>) => {
    setEmployees(current => current.map(employee => employee.id === id
      ? { ...employee, ...patch, revision: employee.revision + 1, updated: '刚刚' }
      : employee))
  }, [])

  const pushEmployee = useCallback((id: string) => {
    const employee = employees.find(item => item.id === id)
    if (!employee) return
    if (employee.status === 'active') return
    const modelBinding = employee.bindings.find(binding => resources.find(item => item.id === binding.resourceId)?.kind === 'model')
    if (!modelBinding) {
      notify('发布失败：员工必须绑定一个主模型。', 'warn')
      return
    }
    setEmployees(current => current.map(item => item.id === id
      ? { ...item, status: 'active' as const, updated: '刚刚' }
      : item))
    notify(`「${employee.name}」已发布，revision r${employee.revision} → 正式执行读取当前配置。`, 'ok')
  }, [employees, notify, resources])

  const disableEmployee = useCallback((id: string) => {
    const employee = employees.find(item => item.id === id)
    if (!employee || employee.status === 'draft') return
    if (teams.some(team => team.status === 'active' && team.members.some(member => member.employeeId === id))) {
      notify('停用失败：该员工仍在启用中的员工组内，请先调整员工组。', 'warn')
      return
    }
    setEmployees(current => current.map(item => item.id === id
      ? { ...item, status: 'draft' as const, updated: '刚刚' }
      : item))
    notify(`「${employee.name}」已停用，转为草稿状态。`)
  }, [employees, notify, teams])

  const deleteEmployee = useCallback((id: string) => {
    const employee = employees.find(item => item.id === id)
    if (!employee) return
    if (employee.status === 'active') {
      notify('请先停用数字员工，再执行删除（EMPLOYEE_IN_USE）。', 'warn')
      return
    }
    const owning = teams.filter(team => team.members.some(member => member.employeeId === id))
    setEmployees(current => current.filter(item => item.id !== id))
    if (owning.length) {
      setTeams(current => current.map(team => team.members.some(member => member.employeeId === id)
        ? { ...team, members: team.members.filter(member => member.employeeId !== id), updated: '刚刚' }
        : team))
      notify(`已删除「${employee.name}」，并从${owning.map(team => `「${team.name}」`).join('、')}移除了该成员。`)
      return
    }
    notify(`已删除「${employee.name}」。`)
  }, [employees, notify, teams])

  /* ── teams ── */

  const createTeam = useCallback((name: string, description: string) => {
    const id = `t-${Date.now()}`
    setTeams(current => [
      { id, name, description: description || '尚未填写说明。', status: 'draft', modelResourceId: '', members: [], maxDelegations: 4, maxParallel: 2, revision: 1, updated: '刚刚' },
      ...current,
    ])
    notify(`已创建员工组「${name}」，成员与主管模型配置完成后再启用。`, 'ok')
    return id
  }, [notify])

  const updateTeam = useCallback((id: string, patch: Partial<Team>) => {
    setTeams(current => current.map(team => team.id === id ? { ...team, ...patch, revision: team.revision + 1, updated: '刚刚' } : team))
  }, [])

  const activateTeam = useCallback((id: string) => {
    const target = teams.find(team => team.id === id)
    if (!target || target.status === 'active') return
    const problems: string[] = []
    if (!target.modelResourceId) problems.push('未指定主管模型')
    if (target.members.length === 0) problems.push('没有任何成员')
    if (target.members.length > 0 && target.modelResourceId) {
      const missing = target.members.filter(member => {
        const employee = employees.find(item => item.id === member.employeeId)
        return !employee || employee.status !== 'active'
      })
      if (missing.length) problems.push(`${missing.length} 位成员不是启用状态`)
    }
    if (problems.length) {
      notify(`启用失败：${problems.join('、')}。`, 'warn')
      return
    }
    setTeams(current => current.map(team => team.id === id
      ? { ...team, status: 'active' as const, updated: '刚刚' }
      : team.status === 'active' ? { ...team, status: 'draft' as const, updated: '刚刚' } : team))
    notify(`「${target.name}」已启用；同一租户最多启用一个员工组，原启用组已自动停用。`, 'ok')
  }, [employees, notify, teams])

  const disableTeam = useCallback((id: string) => {
    setTeams(current => current.map(team => team.id === id ? { ...team, status: 'draft' as const, updated: '刚刚' } : team))
    notify('员工组已停用，项目对话会因为没有启用组而显式失败（GOVERNANCE_ACTIVE_TEAM_UNAVAILABLE）。', 'warn')
  }, [notify])

  const toggleTeamMember = useCallback((id: string, employeeId: string) => {
    const team = teams.find(item => item.id === id)
    if (!team) return
    const leaving = team.members.some(member => member.employeeId === employeeId)
    const employee = employees.find(item => item.id === employeeId)
    if (!leaving && employee && employee.status !== 'active') {
      notify(`「${employee.name}」不是启用状态，不能作为正式成员；请先发布该员工。`, 'warn')
      return
    }
    setTeams(current => current.map(item => {
      if (item.id !== id) return item
      return leaving
        ? { ...item, members: item.members.filter(member => member.employeeId !== employeeId), revision: item.revision + 1 }
        : { ...item, members: [...item.members, { employeeId, duty: '' }], revision: item.revision + 1 }
    }))
  }, [employees, notify, teams])

  /* ── users ── */

  const audit = useCallback((entry: Omit<AuditEntry, 'id' | 'time'>) => {
    setAdminAudit(current => [{ id: `aa-${Date.now()}`, time: '刚刚', ...entry }, ...current])
  }, [])

  const createUser = useCallback((name: string, email: string, roles: string[], scopes: ScopeGrant[]) => {
    if (users.some(user => user.email.toLowerCase() === email.toLowerCase())) {
      notify(`邮箱 ${email} 已被占用，创建被拒绝（409 EMAIL_ALREADY_EXISTS）。`, 'warn')
      return
    }
    setUsers(current => [
      ...current,
      { id: `u-${Date.now()}`, name, email, roles, scopes, status: 'active', mustChangePassword: true, lastLogin: '尚未登录', lastSeen: '-', sessions: [] },
    ])
    audit({ actor: '张律', action: 'user_created', target: name, detail: `roles=[${roles.join(',')}] scopes=[${scopes.map(scope => `${scope.type}:${scope.target}`).join(',')}]` })
    notify(`已创建账号「${name}」，已下发临时密码并要求首次登录改密。`, 'ok')
  }, [audit, notify, users])

  const replaceAuthorization = useCallback((id: string, roles: string[], scopes: ScopeGrant[]) => {
    const target = users.find(user => user.id === id)
    if (!target) return
    if (id === CURRENT_USER_ID) {
      notify('不能修改自己的授权（SELF_AUTHORIZATION_CHANGE_FORBIDDEN）。', 'warn')
      return
    }
    const superAdmins = users.filter(user => user.status === 'active' && user.roles.includes('super_admin'))
    const losingLastSuperAdmin = target.roles.includes('super_admin') && !roles.includes('super_admin') && superAdmins.length <= 1
    if (losingLastSuperAdmin) {
      notify('不能移除最后一个活跃 super_admin，事务已回滚。', 'warn')
      return
    }
    const normalized = scopes.map(scope => scope.type === 'platform' && !['admin', 'super_admin'].some(role => roles.includes(role))
      ? { ...scope, type: 'tenant' as const }
      : scope)
    setUsers(current => current.map(user => user.id === id
      ? { ...user, roles, scopes: normalized, sessions: [] }
      : user))
    audit({ actor: '张律', action: 'authorization_replaced', target: target.name, detail: `roles=[${roles.join(',')}] scopes=[${normalized.map(scope => `${scope.type}:${scope.target}`).join(',')}]` })
    notify(`已原子保存「${target.name}」的角色与作用域，旧会话已撤销。`, 'ok')
  }, [audit, notify, users])

  const resetUserPassword = useCallback((id: string) => {
    const target = users.find(user => user.id === id)
    if (!target) return
    setUsers(current => current.map(user => user.id === id ? { ...user, mustChangePassword: true, sessions: [] } : user))
    setLoginAudit(current => [{ id: `la-${Date.now()}`, time: '刚刚', actor: '张律', action: 'password_reset', target: target.email, detail: '已下发临时密码，要求首登改密' }, ...current])
    audit({ actor: '张律', action: 'password_reset', target: target.name, detail: '临时密码只展示一次，不写入日志' })
    notify(`已重置「${target.name}」的密码，并要求下次登录修改。`, 'ok')
  }, [audit, notify, users])

  const toggleUserStatus = useCallback((id: string) => {
    const target = users.find(user => user.id === id)
    if (!target) return
    if (id === CURRENT_USER_ID) {
      notify('不能停用当前登录账号。', 'warn')
      return
    }
    const activeSuperAdmins = users.filter(user => user.status === 'active' && user.roles.includes('super_admin'))
    if (target.status === 'active' && target.roles.includes('super_admin') && activeSuperAdmins.length <= 1) {
      notify('不能停用最后一个活跃 super_admin。', 'warn')
      return
    }
    const next = target.status === 'active' ? 'disabled' : 'active'
    setUsers(current => current.map(user => user.id === id ? { ...user, status: next, sessions: next === 'disabled' ? [] : user.sessions } : user))
    audit({ actor: '张律', action: next === 'disabled' ? 'user_disabled' : 'user_enabled', target: target.name, detail: next === 'disabled' ? '账号立即失效，会话已撤销' : '账号恢复可用' })
    notify(next === 'disabled' ? `已停用「${target.name}」，其会话立即失效。` : `已启用「${target.name}」。`, next === 'disabled' ? 'warn' : 'ok')
  }, [audit, notify, users])

  const revokeUserSessions = useCallback((id: string) => {
    const target = users.find(user => user.id === id)
    if (!target) return
    const count = target.sessions.length
    setUsers(current => current.map(user => user.id === id ? { ...user, sessions: [] } : user))
    audit({ actor: '张律', action: 'sessions_revoked', target: target.name, detail: `吊销 ${count} 个活跃会话` })
    notify(count ? `已吊销「${target.name}」的 ${count} 个会话。` : `「${target.name}」当前没有活跃会话。`, count ? 'ok' : 'info')
  }, [audit, notify, users])

  /* ── projects ── */

  /* 新建项目的初始态：0 会话、草稿。从输入区创建的项目不是这个流程——它建完就
     立刻开跑，`queueAssistant` 会把状态改成「生成中」，回复落地后由
     `bumpProjectSessions` 把计数改掉。注意那个函数是 `Math.max(sessions, 1) + 1`，
     对 0 和 1 都得到 2，所以在首页建出来的项目列表里显示「2 会话」，而它实际只有
     1 条会话；这里是既有行为，本次没有一并改。 */
  const createProject = useCallback((name: string, description: string, tenant: string) => {
    const id = `project-${Date.now()}`
    setProjects(current => [
      {
        id, name, desc: description,
        sessions: 0, updated: '刚刚', tenant, status: { kind: 'draft' as const, label: '草稿' },
      },
      ...current,
    ])
    return id
  }, [])

  const updateProject = useCallback((id: string, name: string, description: string) => {
    setProjects(current => current.map(project => project.id === id
      ? { ...project, name, desc: description, updated: '刚刚' }
      : project))
    notify(`项目「${name}」已保存。`, 'ok')
  }, [notify])

  const deleteProject = useCallback((id: string) => {
    setProjects(current => current.map(project => project.id === id
      ? { ...project, deletedAt: '刚刚', updated: '刚刚', status: { kind: 'draft' as const, label: '已删除' } }
      : project))
    notify('项目已移入回收站，关联会话与案卷会一并保留 30 天。')
  }, [notify])

  const restoreProject = useCallback((id: string) => {
    setProjects(current => current.map(project => project.id === id
      ? { ...project, deletedAt: undefined, updated: '刚刚', status: { kind: 'ok' as const, label: '已恢复' } }
      : project))
    notify('项目已从回收站恢复。', 'ok')
  }, [notify])

  const purgeProject = useCallback((id: string) => {
    setProjects(current => current.filter(project => project.id !== id))
    notify('已彻底删除项目，关联会话、运行记录与案卷同时清理。', 'warn')
  }, [notify])

  const emptyRecycleBin = useCallback(() => {
    const count = projects.filter(project => project.deletedAt).length
    if (!count) {
      notify('回收站已经是空的。', 'info')
      return
    }
    setProjects(current => current.filter(project => !project.deletedAt))
    notify(`已清空回收站，彻底删除 ${count} 个项目。`, 'warn')
  }, [notify, projects])

  const setProjectStatus = useCallback((id: string, status: Project['status']) => {
    setProjects(current => current.map(project => project.id === id ? { ...project, status } : project))
  }, [])

  const bumpProjectSessions = useCallback((id: string) => {
    setProjects(current => current.map(project => project.id === id
      ? { ...project, sessions: Math.max(project.sessions, 1) + 1, updated: '刚刚', status: { kind: 'ok' as const, label: '已完成' } }
      : project))
  }, [])

  const value = useMemo<WorkspaceValue>(() => ({
    resources, employees, teams, users, loginAudit, adminAudit, projects, notices,
    notify, dismissNotice,
    createResource, toggleResourcePublished, deleteResource, updateResource, addKnowledgeFile, removeKnowledgeFile, addConnectorTool,
    createEmployee, updateEmployee, pushEmployee, disableEmployee, deleteEmployee,
    createTeam, updateTeam, activateTeam, disableTeam, toggleTeamMember,
    createUser, replaceAuthorization, resetUserPassword, toggleUserStatus, revokeUserSessions,
    createProject, updateProject, deleteProject, restoreProject, purgeProject, emptyRecycleBin, setProjectStatus, bumpProjectSessions,
  }), [
    resources, employees, teams, users, loginAudit, adminAudit, projects, notices,
    notify, dismissNotice, updateResource,
    createResource, toggleResourcePublished, deleteResource, updateResource, addKnowledgeFile, removeKnowledgeFile, addConnectorTool,
    createEmployee, updateEmployee, pushEmployee, disableEmployee, deleteEmployee,
    createTeam, updateTeam, activateTeam, disableTeam, toggleTeamMember,
    createUser, replaceAuthorization, resetUserPassword, toggleUserStatus, revokeUserSessions,
    createProject, updateProject, deleteProject, restoreProject, purgeProject, emptyRecycleBin, setProjectStatus, bumpProjectSessions,
  ])

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider')
  return value
}

export function kindLabel(kind: ResourceKind) {
  return { kb: '知识库', skill: 'Skill', connector: 'Connector', sop: 'SOP', model: '模型' }[kind]
}

export function resourceKindOf(resources: GovernanceResource[], resourceId: string): ResourceKind | null {
  return resources.find(resource => resource.id === resourceId)?.kind ?? null
}

/** 演示用的资源 key：能直接用名字就用（`kb.contract-tpl`），中文名退回 `kb.custom-3`，避免出现时间戳式的随机串。 */
function resourceKeyOf(kind: ResourceKind, name: string, existing: GovernanceResource[]) {
  const prefix = { kb: 'kb', skill: 'skill', connector: 'conn', sop: 'sop', model: 'model' }[kind]
  const ascii = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (/^[a-z]/.test(ascii)) return `${prefix}.${ascii}`
  const taken = new Set(existing.map(resource => resource.key))
  let index = existing.filter(resource => resource.kind === kind).length + 1
  while (taken.has(`${prefix}.custom-${index}`)) index += 1
  return `${prefix}.custom-${index}`
}
