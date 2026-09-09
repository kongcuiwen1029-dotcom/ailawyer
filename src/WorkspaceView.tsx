import { useState } from 'react'
import {
  Briefcase,
  Clock,
  MessageSquare,
  LayoutGrid,
  Table as TableIcon,
  Database,
  Wrench,
  Plug,
  Workflow,
  Cpu,
  Bot,
  Users,
  ClipboardList,
  CheckCircle2,
  CircleDot,
  Play,
  Upload,
  Send,
  Route,
  Archive,
  type LucideIcon,
} from 'lucide-react'
import { viewTitles, type ViewId } from './nav'

type BadgeKind = 'ok' | 'run' | 'draft' | 'warn'

function Badge({ kind, children }: { kind: BadgeKind; children: React.ReactNode }) {
  return <span className={`wv-badge ${kind}`}>{children}</span>
}

function ViewHead({
  view,
  action,
}: {
  view: ViewId
  action?: React.ReactNode
}) {
  const { title, sub } = viewTitles[view]
  return (
    <div className="wv-head">
      <div>
        <h1 className="wv-h1">{title}</h1>
        {sub && <p className="wv-sub">{sub}</p>}
      </div>
      {action && <div className="wv-toolbar">{action}</div>}
    </div>
  )
}

/* ───────────────────────── Projects ───────────────────────── */

export interface Project {
  id: string
  name: string
  desc: string
  sessions: number
  updated: string
  status: { kind: BadgeKind; label: string }
}

export const initialProjects: Project[] = [
  { id: 'haide-due-diligence', name: '海德科技 A 轮融资尽调', desc: '股权结构、历史沿革与合规风险梳理，输出尽调报告框架。', sessions: 8, updated: '12 分钟前', status: { kind: 'run', label: '生成中' } },
  { id: 'supply-chain-contract', name: '供应链框架合同审查', desc: '审查付款、违约与不可抗力条款，标注偏离与谈判建议。', sessions: 5, updated: '1 小时前', status: { kind: 'warn', label: '等待确认' } },
  { id: 'labor-dispute-timeline', name: '劳动争议应诉时间线', desc: '按证据目录构建争议事实时间线与举证责任分配。', sessions: 12, updated: '昨天', status: { kind: 'ok', label: '已完成' } },
  { id: 'gdpr-comparison', name: '数据合规 GDPR 对标', desc: '对比境内外数据出境要求，生成整改清单。', sessions: 3, updated: '3 天前', status: { kind: 'ok', label: '已完成' } },
  { id: 'trademark-response', name: '商标异议答辩草案', desc: '检索近似商标，起草答辩理由与证据框架。', sessions: 2, updated: '上周', status: { kind: 'draft', label: '草稿' } },
]

function ProjectsView({ projects, onOpenProject, onNewProject }: {
  projects: Project[]
  onOpenProject: (project: Project) => void
  onNewProject: () => void
}) {
  const [mode, setMode] = useState<'card' | 'table'>('card')

  const action = (
    <>
      <div className="wv-seg">
        <button className={mode === 'card' ? 'active' : ''} onClick={() => setMode('card')}>
          <LayoutGrid size={14} strokeWidth={1.9} /> 卡片
        </button>
        <button className={mode === 'table' ? 'active' : ''} onClick={() => setMode('table')}>
          <TableIcon size={14} strokeWidth={1.9} /> 表格
        </button>
      </div>
      <button className="wv-btn primary" onClick={onNewProject}>新建项目</button>
    </>
  )

  return (
    <>
      <ViewHead view="projects" action={action} />

      {mode === 'card' ? (
        <div className="wv-grid">
          {projects.map(p => (
            <article className="wv-card" key={p.id} onClick={() => onOpenProject(p)} role="button" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter') onOpenProject(p) }}>
              <div className="wv-card-top">
                <div className="wv-ico"><Briefcase size={18} strokeWidth={1.8} /></div>
                <Badge kind={p.status.kind}>{p.status.label}</Badge>
              </div>
              <h3 className="wv-card-title">{p.name}</h3>
              <p className="wv-card-desc">{p.desc}</p>
              <div className="wv-card-meta">
                <span><MessageSquare size={13} strokeWidth={1.8} /> {p.sessions} 会话</span>
                <span><Clock size={13} strokeWidth={1.8} /> {p.updated}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <table className="wv-table">
          <thead>
            <tr><th>项目名称</th><th>会话</th><th>更新时间</th><th>状态</th></tr>
          </thead>
          <tbody>
            {projects.map(p => (
              <tr key={p.id} onClick={() => onOpenProject(p)} className="wv-click-row">
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td>{p.sessions}</td>
                <td>{p.updated}</td>
                <td><Badge kind={p.status.kind}>{p.status.label}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

/* ───────────────────────── Resource market ───────────────────────── */

interface ResourceTab {
  id: string
  label: string
  icon: LucideIcon
  items: { name: string; key: string; published: boolean; rev: string; meta: string }[]
}

const resourceTabs: ResourceTab[] = [
  {
    id: 'kb', label: '知识库', icon: Database,
    items: [
      { name: '民商法法规库', key: 'kb.civil-commercial', published: true, rev: 'r14', meta: '412 文件 · MinIO' },
      { name: '最高院指导案例', key: 'kb.spc-cases', published: true, rev: 'r7', meta: '1,208 文件' },
      { name: '内部合同模板', key: 'kb.contract-tpl', published: false, rev: 'r2', meta: '36 文件 · 草稿' },
    ],
  },
  {
    id: 'skill', label: 'Skill', icon: Wrench,
    items: [
      { name: '合同条款风险评估', key: 'skill.contract-risk', published: true, rev: 'r9', meta: '证据要求 · 输出 Schema' },
      { name: '法律检索改写', key: 'skill.legal-rewrite', published: true, rev: 'r5', meta: '多轮检索' },
      { name: '尽调清单生成', key: 'skill.dd-checklist', published: false, rev: 'r1', meta: 'AI 草稿' },
    ],
  },
  {
    id: 'conn', label: 'Connector', icon: Plug,
    items: [
      { name: '北大法宝 MCP', key: 'conn.pkulaw', published: true, rev: 'r3', meta: 'MCP · 已握手' },
      { name: '企业信息 HTTP', key: 'conn.corp-info', published: true, rev: 'r6', meta: 'HTTP · GET' },
      { name: '裁判文书检索', key: 'conn.judgments', published: false, rev: 'r1', meta: '待测试' },
    ],
  },
  {
    id: 'sop', label: 'SOP', icon: Workflow,
    items: [
      { name: '合同审查工作流', key: 'sop.contract-review', published: true, rev: 'r11', meta: 'Dynamic Graph · 7 节点' },
      { name: '尽职调查流程', key: 'sop.due-diligence', published: true, rev: 'r8', meta: '12 节点' },
      { name: '证据目录编排', key: 'sop.evidence-index', published: false, rev: 'r2', meta: '校验未通过' },
    ],
  },
  {
    id: 'model', label: '模型', icon: Cpu,
    items: [
      { name: 'Claude Opus（系统托管）', key: 'model.sys-opus', published: true, rev: 'r1', meta: '默认模型' },
      { name: 'BYOK · GPT 兼容端点', key: 'model.byok-oai', published: true, rev: 'r4', meta: '3 个 Model ID' },
      { name: 'BYOK · 本地推理', key: 'model.byok-local', published: false, rev: 'r1', meta: 'Host 待校验' },
    ],
  },
]

function ResourcesView() {
  const [tab, setTab] = useState('kb')
  const active = resourceTabs.find(t => t.id === tab)!
  const Icon = active.icon

  return (
    <>
      <ViewHead
        view="resources"
        action={<button className="wv-btn primary">创建资源</button>}
      />
      <div className="wv-tabs">
        {resourceTabs.map(t => (
          <button
            key={t.id}
            className={`wv-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="wv-list">
        {active.items.map(it => (
          <div className="wv-row" key={it.key}>
            <div className="wv-ico"><Icon size={18} strokeWidth={1.8} /></div>
            <div className="wv-row-main">
              <p className="wv-row-title">
                {it.name}
                {it.published
                  ? <Badge kind="ok">已发布</Badge>
                  : <Badge kind="draft">未发布</Badge>}
              </p>
              <p className="wv-row-sub">{it.key} · {it.meta} · {it.rev}</p>
            </div>
            <div className="wv-row-actions">
              <button className="wv-btn"><Play size={13} strokeWidth={1.9} /> 测试</button>
              <button className="wv-btn">{it.published ? '取消发布' : '发布'}</button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

/* ───────────────────────── Digital employees ───────────────────────── */

interface Employee {
  name: string
  key: string
  active: boolean
  model: string
  routes: string[]
  binds: string[]
}

const employees: Employee[] = [
  { name: '合同审查员', key: 'emp.contract-reviewer', active: true, model: 'Claude Opus', routes: ['Direct', 'Agentic', 'Workflow'], binds: ['合同风险 Skill', '合同审查 SOP', '民商法库'] },
  { name: '法律检索员', key: 'emp.legal-researcher', active: true, model: 'BYOK · GPT', routes: ['Direct', 'Agentic'], binds: ['检索改写 Skill', '北大法宝', '指导案例库'] },
  { name: '尽调助理', key: 'emp.dd-assistant', active: false, model: 'Claude Opus', routes: ['Agentic', 'Workflow'], binds: ['尽调 SOP', '企业信息 HTTP'] },
]

function EmployeesView() {
  return (
    <>
      <ViewHead
        view="employees"
        action={<button className="wv-btn primary">新建员工</button>}
      />
      <div className="wv-list">
        {employees.map(e => (
          <div className="wv-row" key={e.key}>
            <div className="wv-ico"><Bot size={18} strokeWidth={1.8} /></div>
            <div className="wv-row-main">
              <p className="wv-row-title">
                {e.name}
                {e.active
                  ? <Badge kind="ok"><CheckCircle2 size={11} strokeWidth={2.2} /> active</Badge>
                  : <Badge kind="draft"><CircleDot size={11} strokeWidth={2.2} /> draft</Badge>}
              </p>
              <p className="wv-row-sub">{e.key} · {e.model}</p>
              <div className="wv-chips" style={{ marginTop: 8 }}>
                <span className="wv-chip2"><Route size={11} strokeWidth={2} /> {e.routes.join(' / ')}</span>
                {e.binds.map(b => <span className="wv-chip2" key={b}>{b}</span>)}
              </div>
            </div>
            <div className="wv-row-actions">
              <button className="wv-btn"><Play size={13} strokeWidth={1.9} /> 调试</button>
              <button className="wv-btn">{e.active ? '配置' : '发布'}</button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

/* ───────────────────────── Teams ───────────────────────── */

function TeamsView() {
  return (
    <>
      <ViewHead
        view="teams"
        action={<button className="wv-btn primary">新建员工组</button>}
      />
      <p className="wv-hint">每个租户最多启用一个员工组，启用前会完整校验成员、主管模型与资源绑定。</p>

      <div className="wv-list">
        <div className="wv-row" style={{ alignItems: 'flex-start' }}>
          <div className="wv-ico"><Users size={18} strokeWidth={1.8} /></div>
          <div className="wv-row-main">
            <p className="wv-row-title">诉讼支持小组 <Badge kind="ok">已启用</Badge></p>
            <p className="wv-row-sub">Team Supervisor · Claude Opus · 委派 + 并行 + 结果汇总</p>
            <div className="wv-chips" style={{ marginTop: 10 }}>
              <span className="wv-chip2">合同审查员 · 主审</span>
              <span className="wv-chip2">法律检索员 · 证据检索</span>
              <span className="wv-chip2">尽调助理 · 事实梳理</span>
            </div>
          </div>
          <div className="wv-row-actions">
            <button className="wv-btn"><Play size={13} strokeWidth={1.9} /> 调试</button>
            <button className="wv-btn">配置</button>
          </div>
        </div>

        <div className="wv-row" style={{ alignItems: 'flex-start' }}>
          <div className="wv-ico"><Users size={18} strokeWidth={1.8} /></div>
          <div className="wv-row-main">
            <p className="wv-row-title">交易顾问小组 <Badge kind="draft">草稿</Badge></p>
            <p className="wv-row-sub">成员分工待补充 · 主管模型未指定</p>
          </div>
          <div className="wv-row-actions">
            <button className="wv-btn">配置</button>
          </div>
        </div>
      </div>
    </>
  )
}

/* ───────────────────────── Datasets ───────────────────────── */

const datasets = [
  { name: '合同审查回归集', versions: 6, cases: 128, hash: '9f2a…c41', archived: false },
  { name: '法律检索准确率集', versions: 4, cases: 96, hash: '3b70…e8d', archived: false },
  { name: '尽调抽取评测', versions: 2, cases: 40, hash: 'a15c…772', archived: true },
]

function DatasetsView() {
  return (
    <>
      <ViewHead
        view="datasets"
        action={<button className="wv-btn primary"><Upload size={14} strokeWidth={1.9} /> 导入 Case</button>}
      />
      <div className="wv-list">
        {datasets.map(d => (
          <div className="wv-row" key={d.name}>
            <div className="wv-ico"><ClipboardList size={18} strokeWidth={1.8} /></div>
            <div className="wv-row-main">
              <p className="wv-row-title">
                {d.name}
                {d.archived && <Badge kind="draft"><Archive size={11} strokeWidth={2} /> 已归档</Badge>}
              </p>
              <p className="wv-row-sub">{d.versions} 个版本 · {d.cases} 个 Case · manifest {d.hash}</p>
            </div>
            <div className="wv-row-actions">
              <button className="wv-btn">新建版本</button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

/* ───────────────────────── Feedback ───────────────────────── */

function FeedbackView() {
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)

  return (
    <>
      <ViewHead view="feedback" />
      <div className="wv-feedback">
        {sent ? (
          <div className="wv-feedback-done">
            <CheckCircle2 size={40} strokeWidth={1.6} />
            <p>感谢反馈，我们已经收到了。</p>
            <button className="wv-btn" onClick={() => { setSent(false); setText('') }}>再提一条</button>
          </div>
        ) : (
          <>
            <textarea
              className="wv-textarea"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="描述你遇到的问题或想要的功能……"
              rows={6}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button
                className="wv-btn primary"
                disabled={!text.trim()}
                onClick={() => setSent(true)}
              >
                <Send size={14} strokeWidth={1.9} /> 提交反馈
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

/* ───────────────────────── Router ───────────────────────── */

export default function WorkspaceView({
  view,
  projects = initialProjects,
  onOpenProject = () => undefined,
  onNewProject = () => undefined,
}: {
  view: ViewId
  projects?: Project[]
  onOpenProject?: (project: Project) => void
  onNewProject?: () => void
}) {
  return (
    <div className="wv-scroll">
      <div className="wv">
        {view === 'projects'  && <ProjectsView projects={projects} onOpenProject={onOpenProject} onNewProject={onNewProject} />}
        {view === 'resources' && <ResourcesView />}
        {view === 'employees' && <EmployeesView />}
        {view === 'teams'     && <TeamsView />}
        {view === 'datasets'  && <DatasetsView />}
        {view === 'feedback'  && <FeedbackView />}
      </div>
    </div>
  )
}
