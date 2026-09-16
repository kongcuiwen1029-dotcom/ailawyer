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

export type SpanKind = 'agent' | 'model' | 'model-request' | 'tool' | 'workflow' | 'processor'

export interface TraceSpan {
  id: string
  parentId: string | null
  kind: SpanKind
  name: string
  startMs: number
  durationMs: number
  input: string
  output: string
  metadata: Record<string, string>
}

export interface TraceRun {
  traceId: string
  executorKind: 'employee' | 'team'
  executorId: string
  executorName: string
  tenant: string
  startedAt: string
  durationMs: number
  status: 'succeeded' | 'failed'
  spans: TraceSpan[]
}

export interface ScopeGrant {
  type: 'platform' | 'tenant' | 'project'
  target: string
}

/** Which executor the 调试台 should be filtered to when it opens. */
export interface TraceFocus {
  kind: 'employee' | 'team'
  id: string
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

export interface DatasetVersion {
  version: string
  cases: number
  hash: string
  frozenAt: string
}

export interface Dataset {
  id: string
  name: string
  scope: string
  cases: number
  archived: boolean
  versions: DatasetVersion[]
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
  /* 案件类型，对应服务端 `Project.caseType`（自由文本）。新建项目时可选，所以
     老数据与从输入区创建的项目都没有它。 */
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

const seedResources: GovernanceResource[] = [
  {
    id: 'r-kb-civil', kind: 'kb', name: '民商法法规库', key: 'kb.civil-commercial',
    summary: '民法典、公司法与司法解释的现行有效版本，按领域与法域标注。',
    published: true, revision: 14, owner: '张律', updated: '2 天前',
    files: [
      { name: '民法典-合同编.md', size: '412 KB', uploadedAt: '2 天前', parsed: true },
      { name: '公司法-2023修订.md', size: '286 KB', uploadedAt: '3 天前', parsed: true },
      { name: '合同编通则司法解释.txt', size: '96 KB', uploadedAt: '上周', parsed: true },
      { name: '担保制度解释-批注.txt', size: '58 KB', uploadedAt: '上周', parsed: false },
    ],
  },
  {
    id: 'r-kb-tpl', kind: 'kb', name: '内部合同模板', key: 'kb.contract-tpl',
    summary: '律所自有的交易文件范本，仅本租户可用。',
    published: false, revision: 2, owner: '张律', updated: '昨天',
    files: [{ name: '股权转让协议-范本.txt', size: '74 KB', uploadedAt: '昨天', parsed: true }],
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

const seedTraces: TraceRun[] = [
  {
    traceId: '0bf50948f1ddc9e5772688eb4c7fff3b',
    executorKind: 'employee', executorId: 'e-contract', executorName: '合同审查员',
    tenant: '律所本部', startedAt: '今天 14:22', durationMs: 14_600, status: 'failed',
    spans: [
      { id: 's0', parentId: null, kind: 'agent', name: 'governed-employee-e-contract', startMs: 0, durationMs: 14_600, input: '审查供应链框架合同的付款与违约条款', output: '执行被预算拦截：GOVERNANCE_DELEGATION_LIMIT', metadata: { employeeKey: 'emp.contract-reviewer', bundleSchemaVersion: '2' } },
      { id: 's1', parentId: 's0', kind: 'model-request', name: 'harness:model-request', startMs: 40, durationMs: 1180, input: 'system + user（含项目案卷清单）', output: 'providerRequestBody 已记录', metadata: { toolChoice: 'auto', temperature: '0.2', maxOutputTokens: '4096', providerRequestBodyAvailable: 'true' } },
      { id: 's2', parentId: 's0', kind: 'tool', name: 'read_file', startMs: 1300, durationMs: 260, input: '{"path":"项目案卷/供应链框架合同.md"}', output: '已读取 18 KB', metadata: { workspace: 'project-documents', readOnly: 'true' } },
      { id: 's3', parentId: 's0', kind: 'model', name: 'claude-opus-5', startMs: 1700, durationMs: 9800, input: '工具结果 + 条款正文', output: '生成条款风险清单（未落库）', metadata: { modelConnection: 'r-model-opus', source: 'author_preview' } },
      { id: 's4', parentId: 's0', kind: 'processor', name: 'employee-required-sop', startMs: 11_600, durationMs: 40, input: '第 0 步只暴露绑定 SOP 工具', output: '跳过：当前任务不是指定 SOP', metadata: {} },
      { id: 's5', parentId: 's0', kind: 'agent', name: 'error', startMs: 14_500, durationMs: 100, input: '委派计数', output: 'GOVERNANCE_DELEGATION_LIMIT：员工内部不允许再委派', metadata: { maxDelegations: '0' } },
    ],
  },
  {
    traceId: '7c1e04b2a9f04f0d8a5e6b3c2d1f0091',
    executorKind: 'team', executorId: 't-litigation', executorName: '诉讼支持小组',
    tenant: '律所本部', startedAt: '今天 11:08', durationMs: 42_300, status: 'succeeded',
    spans: [
      { id: 't0', parentId: null, kind: 'agent', name: 'project-copilot-agent', startMs: 0, durationMs: 42_300, input: '这份供应链合同有哪些付款风险？', output: '已汇总成员结论并交付', metadata: { teamId: 't-litigation', maxDelegations: '8', maxParallel: '3' } },
      { id: 't1', parentId: 't0', kind: 'agent', name: 'emp.contract-reviewer', startMs: 620, durationMs: 21_400, input: '审查付款与账期条款', output: '列出 4 条风险条款与建议', metadata: { delegateCount: '1/8' } },
      { id: 't2', parentId: 't1', kind: 'model-request', name: 'harness:model-request', startMs: 700, durationMs: 900, input: 'system + 案卷清单', output: 'providerRequestBody 已记录', metadata: { toolChoice: 'auto', temperature: '0.2', maxOutputTokens: '4096' } },
      { id: 't3', parentId: 't1', kind: 'tool', name: 'read_file', startMs: 1700, durationMs: 240, input: '{"path":"项目案卷/供应链框架合同.md"}', output: '已读取 18 KB', metadata: {} },
      { id: 't4', parentId: 't1', kind: 'workflow', name: 'governance-sop-sop.contract-review', startMs: 2400, durationMs: 15_800, input: '合同正文', output: '风险清单已生成', metadata: { sopRevision: 'r11', dependencies: 'skill.contract-risk, kb.civil-commercial' } },
      { id: 't5', parentId: 't4', kind: 'tool', name: 'search_law', startMs: 3200, durationMs: 1400, input: '{"query":"账期 逾期付款 违约金 上限"}', output: '命中 6 条法条', metadata: { connector: 'conn.pkulaw', onDemand: 'true' } },
      { id: 't6', parentId: 't0', kind: 'agent', name: 'emp.legal-researcher', startMs: 22_600, durationMs: 18_100, input: '核对违约金上限的司法口径', output: '给出 3 条判例要旨', metadata: { delegateCount: '2/8' } },
    ],
  },
  {
    traceId: '3e7a51c8842b4f0ea9d1c6552b8e4a07',
    executorKind: 'team', executorId: 't-litigation', executorName: '诉讼支持小组',
    tenant: '律所本部', startedAt: '今天 09:34', durationMs: 18_700, status: 'succeeded',
    spans: [
      { id: 'w0', parentId: null, kind: 'agent', name: 'project-copilot-agent', startMs: 0, durationMs: 18_700, input: '按合同审查工作流审一遍这份框架合同', output: '风险清单已交付，等待人工确认输出范围', metadata: { teamId: 't-litigation', route: 'Workflow', maxDelegations: '8', maxParallel: '3' } },
      { id: 'w1', parentId: 'w0', kind: 'agent', name: 'emp.contract-reviewer', startMs: 480, durationMs: 17_600, input: '执行绑定的合同审查 SOP', output: '输出 3 个节点的结果', metadata: { delegateCount: '1/8', sop: 'sop.contract-review' } },
      { id: 'w2', parentId: 'w1', kind: 'model-request', name: 'harness:model-request', startMs: 520, durationMs: 760, input: 'system + SOP 节点说明', output: 'providerRequestBody 已记录', metadata: { toolChoice: 'required', temperature: '0.1', maxOutputTokens: '4096' } },
      { id: 'w3', parentId: 'w1', kind: 'workflow', name: 'governance-sop-sop.contract-review · 节点 1/条款切分', startMs: 1400, durationMs: 5400, input: '合同正文', output: '切分出 14 个条款单元', metadata: { sopRevision: 'r11', nodeIndex: '1' } },
      { id: 'w4', parentId: 'w1', kind: 'workflow', name: 'governance-sop-sop.contract-review · 节点 2/付款条款风险判断', startMs: 6900, durationMs: 8100, input: '付款相关条款单元', output: '标记 4 条风险，其中 1 条需要人工确认', metadata: { sopRevision: 'r11', nodeIndex: '2', branch: 'risk=high' } },
      { id: 'w5', parentId: 'w4', kind: 'tool', name: 'search_law', startMs: 8100, durationMs: 1300, input: '{"query":"逾期付款违约金 上限"}', output: '命中 4 条法条', metadata: { connector: 'conn.pkulaw', onDemand: 'true' } },
      { id: 'w6', parentId: 'w1', kind: 'workflow', name: 'governance-sop-sop.contract-review · 节点 3/输出风险清单', startMs: 15_100, durationMs: 2900, input: '风险条款 + 法条依据', output: '等待人工确认输出范围（HITL）', metadata: { sopRevision: 'r11', nodeIndex: '3', hitl: 'true' } },
    ],
  },
  {
    traceId: 'a4d90c17e5b24c9f8f0a1b2c3d4e5f60',
    executorKind: 'employee', executorId: 'e-researcher', executorName: '法律检索员',
    tenant: '上海分所', startedAt: '昨天 17:41', durationMs: 9_200, status: 'succeeded',
    spans: [
      { id: 'q0', parentId: null, kind: 'agent', name: 'governed-employee-e-researcher', startMs: 0, durationMs: 9_200, input: '检索数据出境合规依据', output: '已给出 5 条依据与时效说明', metadata: { employeeKey: 'emp.legal-researcher', bundleSchemaVersion: '2' } },
      { id: 'q1', parentId: 'q0', kind: 'tool', name: 'load_connector_tools', startMs: 300, durationMs: 120, input: '{}', output: '注册连接器工具（按需加载）', metadata: { preconnected: 'false' } },
      { id: 'q2', parentId: 'q0', kind: 'tool', name: 'search_law', startMs: 520, durationMs: 1900, input: '{"query":"个人信息出境 标准合同"}', output: '命中 5 条法条', metadata: { connector: 'conn.pkulaw' } },
      { id: 'q3', parentId: 'q0', kind: 'model', name: 'gpt-5.2', startMs: 2500, durationMs: 6400, input: '检索结果', output: '依据清单 + 时效标注', metadata: { modelConnection: 'r-model-byok' } },
    ],
  },
]

const seedUsers: AdminUser[] = [
  {
    id: 'u-zhang', name: '张律', email: 'zhang@example-law.cn', roles: ['super_admin', 'governance_super_admin'],
    scopes: [{ type: 'platform', target: '平台' }, { type: 'tenant', target: '律所本部' }],
    status: 'active', mustChangePassword: false, lastLogin: '今天 09:14',
    sessions: [{ id: 's-a1', device: 'macOS · Chrome', ip: '10.240.70.31', lastSeen: '刚刚' }],
  },
  {
    id: 'u-li', name: '李律', email: 'li@example-law.cn', roles: ['lawyer_admin'],
    scopes: [{ type: 'tenant', target: '律所本部' }],
    status: 'active', mustChangePassword: false, lastLogin: '今天 10:02',
    sessions: [{ id: 's-b2', device: 'Windows · Edge', ip: '10.240.70.44', lastSeen: '12 分钟前' }],
  },
  {
    id: 'u-wang', name: '王实习', email: 'wang@example-law.cn', roles: ['user'],
    scopes: [{ type: 'tenant', target: '律所本部' }, { type: 'tenant', target: '上海分所' }],
    status: 'active', mustChangePassword: true, lastLogin: '昨天 18:20',
    sessions: [{ id: 's-c3', device: 'iPad · Safari', ip: '10.240.70.91', lastSeen: '昨天' }],
  },
  {
    id: 'u-chen', name: '陈顾问', email: 'chen@example-law.cn', roles: ['user'],
    scopes: [{ type: 'project', target: '海德科技 A 轮融资尽调' }],
    status: 'disabled', mustChangePassword: false, lastLogin: '上周',
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

const seedDatasets: Dataset[] = [
  {
    id: 'ds-contract', name: '合同审查回归集', scope: '律所本部 · 合同审查员', cases: 128, archived: false,
    versions: [
      { version: 'v6', cases: 128, hash: '9f2a…c41', frozenAt: '3 天前' },
      { version: 'v5', cases: 112, hash: '6d31…0ba', frozenAt: '上周' },
      { version: 'v4', cases: 96, hash: '22ee…7fd', frozenAt: '2 周前' },
    ],
  },
  {
    id: 'ds-retrieval', name: '法律检索准确率集', scope: '律所本部 · 法律检索员', cases: 96, archived: false,
    versions: [{ version: 'v4', cases: 96, hash: '3b70…e8d', frozenAt: '4 天前' }],
  },
  {
    id: 'ds-dd', name: '尽调抽取评测', scope: '律所本部 · 尽调助理', cases: 40, archived: true,
    versions: [{ version: 'v2', cases: 40, hash: 'a15c…772', frozenAt: '上周' }],
  },
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
  traces: TraceRun[]
  users: AdminUser[]
  loginAudit: AuditEntry[]
  adminAudit: AuditEntry[]
  datasets: Dataset[]
  projects: Project[]
  notices: Notice[]
  /** Set before navigating to 调试台 so the list opens filtered to one executor. */
  traceFocus: TraceFocus | null
  setTraceFocus: (focus: TraceFocus | null) => void
  notify: (text: string, tone?: Notice['tone']) => void
  dismissNotice: (id: number) => void
  /* resources */
  createResource: (kind: ResourceKind, name: string, summary: string) => string
  toggleResourcePublished: (id: string) => void
  updateResource: (id: string, patch: Partial<GovernanceResource>) => void
  addKnowledgeFile: (id: string, name: string, size: string) => void
  removeKnowledgeFile: (id: string, name: string) => void
  addConnectorTool: (id: string, tool: ConnectorTool) => void
  /* employees */
  createEmployee: (name: string, description: string) => string
  updateEmployee: (id: string, patch: Partial<Employee>) => void
  addEmployeeBinding: (id: string, resourceId: string, purpose: string) => void
  removeEmployeeBinding: (id: string, resourceId: string) => void
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
  /* datasets */
  createDatasetVersion: (id: string) => void
  importCases: (id: string, count: number) => void
  toggleDatasetArchived: (id: string) => void
  /* projects */
  createProject: (name: string, description: string, tenant: string) => string
  renameProject: (id: string, name: string) => void
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
  const [traces] = useState(seedTraces)
  const [users, setUsers] = useState(seedUsers)
  const [loginAudit, setLoginAudit] = useState(seedLoginAudit)
  const [adminAudit, setAdminAudit] = useState(seedAdminAudit)
  const [datasets, setDatasets] = useState(seedDatasets)
  const [projects, setProjects] = useState(seedProjects)
  const [notices, setNotices] = useState<Notice[]>([])
  const [traceFocus, setTraceFocus] = useState<TraceFocus | null>(null)

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

  const addKnowledgeFile = useCallback((id: string, name: string, size: string) => {
    const replaced = (resources.find(resource => resource.id === id)?.files ?? []).some(file => file.name === name)
    setResources(current => current.map(resource => {
      if (resource.id !== id) return resource
      const rest = (resource.files ?? []).filter(file => file.name !== name)
      return { ...resource, files: [...rest, { name, size, uploadedAt: '刚刚', parsed: true }] }
    }))
    notify(replaced ? `同名文件「${name}」已覆盖并重新解析（${size}）。` : `已上传 ${name}（${size}）`, 'ok')
  }, [notify, resources])

  const removeKnowledgeFile = useCallback((id: string, name: string) => {
    setResources(current => current.map(resource => resource.id === id
      ? { ...resource, files: (resource.files ?? []).filter(file => file.name !== name) }
      : resource))
    notify(`已删除 ${name}，Agent 不能再读取该文件。`)
  }, [notify])

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

  const addEmployeeBinding = useCallback((id: string, resourceId: string, purpose: string) => {
    const resource = resources.find(item => item.id === resourceId)
    const employee = employees.find(item => item.id === id)
    if (!resource || !employee) return
    if (!resource.published) {
      notify(`只能绑定已发布且有权使用的资源：${resource.name} 目前未发布。`, 'warn')
      return
    }
    if (employee.bindings.some(binding => binding.resourceId === resourceId)) {
      notify(`「${resource.name}」已绑定，同一资源不能重复绑定。`, 'warn')
      return
    }
    if (resource.kind === 'model' && employee.bindings.some(binding => resources.find(item => item.id === binding.resourceId)?.kind === 'model')) {
      notify('员工只能配置一个主模型，请先替换原模型（EMPLOYEE_MODEL_CONFLICT）。', 'warn')
      return
    }
    setEmployees(current => current.map(item => item.id === id
      ? { ...item, bindings: [...item.bindings, { resourceId, purpose, enabled: true }] }
      : item))
    notify(`已绑定「${resource.name}」，保存后生效。`, 'ok')
  }, [employees, notify, resources])

  const removeEmployeeBinding = useCallback((id: string, resourceId: string) => {
    setEmployees(current => current.map(employee => employee.id === id
      ? { ...employee, bindings: employee.bindings.filter(binding => binding.resourceId !== resourceId) }
      : employee))
    notify('已解除绑定。')
  }, [notify])

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
      { id: `u-${Date.now()}`, name, email, roles, scopes, status: 'active', mustChangePassword: true, lastLogin: '尚未登录', sessions: [] },
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

  /* ── datasets ── */

  const createDatasetVersion = useCallback((id: string) => {
    const dataset = datasets.find(item => item.id === id)
    if (!dataset) return
    const highest = dataset.versions.reduce((max, item) => Math.max(max, Number(item.version.replace(/\D/g, '')) || 0), 0)
    const version = `v${highest + 1}`
    setDatasets(current => current.map(item => item.id === id
      ? { ...item, versions: [{ version, cases: item.cases, hash: `${Math.random().toString(16).slice(2, 6)}…${Math.random().toString(16).slice(2, 5)}`, frozenAt: '刚刚' }, ...item.versions] }
      : item))
    notify(`已冻结不可变版本 ${version}（${dataset.cases} 个 Case，manifest 已生成 hash）。`, 'ok')
  }, [datasets, notify])

  const importCases = useCallback((id: string, count: number) => {
    // Frozen versions are immutable: imported Cases land in the working copy only.
    setDatasets(current => current.map(dataset => dataset.id === id
      ? { ...dataset, cases: dataset.cases + count }
      : dataset))
    notify(`已导入 ${count} 个 Case，来源已关联运行 Snapshot 与 hash。`, 'ok')
  }, [notify])

  const toggleDatasetArchived = useCallback((id: string) => {
    setDatasets(current => current.map(dataset => dataset.id === id ? { ...dataset, archived: !dataset.archived } : dataset))
    notify('数据集状态已更新。')
  }, [notify])

  /* ── projects ── */

  const createProject = useCallback((name: string, description: string, tenant: string) => {
    const id = `project-${Date.now()}`
    setProjects(current => [
      {
        id, name, desc: description || '由新建对话创建的法律项目，等待继续补充上下文。',
        sessions: 1, updated: '刚刚', tenant, status: { kind: 'run' as const, label: '生成中' },
      },
      ...current,
    ])
    return id
  }, [])

  const renameProject = useCallback((id: string, name: string) => {
    setProjects(current => current.map(project => project.id === id ? { ...project, name, updated: '刚刚' } : project))
    notify(`项目已重命名为「${name}」。`, 'ok')
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
    resources, employees, teams, traces, users, loginAudit, adminAudit, datasets, projects, notices, traceFocus, setTraceFocus,
    notify, dismissNotice,
    createResource, toggleResourcePublished, updateResource, addKnowledgeFile, removeKnowledgeFile, addConnectorTool,
    createEmployee, updateEmployee, addEmployeeBinding, removeEmployeeBinding, pushEmployee, disableEmployee, deleteEmployee,
    createTeam, updateTeam, activateTeam, disableTeam, toggleTeamMember,
    createUser, replaceAuthorization, resetUserPassword, toggleUserStatus, revokeUserSessions,
    createDatasetVersion, importCases, toggleDatasetArchived,
    createProject, renameProject, deleteProject, restoreProject, purgeProject, emptyRecycleBin, setProjectStatus, bumpProjectSessions,
  }), [
    resources, employees, teams, traces, users, loginAudit, adminAudit, datasets, projects, notices, traceFocus, setTraceFocus,
    notify, dismissNotice, updateResource,
    createResource, toggleResourcePublished, updateResource, addKnowledgeFile, removeKnowledgeFile, addConnectorTool,
    createEmployee, updateEmployee, addEmployeeBinding, removeEmployeeBinding, pushEmployee, disableEmployee, deleteEmployee,
    createTeam, updateTeam, activateTeam, disableTeam, toggleTeamMember,
    createUser, replaceAuthorization, resetUserPassword, toggleUserStatus, revokeUserSessions,
    createDatasetVersion, importCases, toggleDatasetArchived,
    createProject, renameProject, deleteProject, restoreProject, purgeProject, emptyRecycleBin, setProjectStatus, bumpProjectSessions,
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
