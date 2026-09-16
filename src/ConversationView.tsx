import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  ArrowLeft,
  ArrowUp,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  FileText,
  FolderOpen,
  Globe2,
  History,
  MoreHorizontal,
  Paperclip,
  PanelLeftClose,
  PanelRightClose,
  Play,
  Plus,
  RotateCcw,
  Search,
  Square,
  Workflow,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { Project } from './WorkspaceView'
import { useWorkspace, type Team, type TraceFocus } from './state/workspace'

export type ChatMode = 'Direct' | 'Agentic' | 'Workflow'

export interface ChatSource {
  kind: '项目案卷' | '全局 RAG' | 'KnowledgeBase' | 'Connector'
  title: string
  detail: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  mode?: ChatMode
  sources?: ChatSource[]
  time: string
}

interface ConversationViewProps {
  project: Project
  messages: ChatMessage[]
  isGenerating: boolean
  initialMode?: ChatMode
  onSendMessage: (text: string, mode: ChatMode) => void
  onStopGeneration: () => void
  onBack: () => void
  onNewConversation: () => void
  onOpenTraces: () => void
}

const modeMeta: Record<ChatMode, { label: string; hint: string }> = {
  Direct: { label: 'Direct', hint: '基于当前对话和你提供的文本' },
  Agentic: { label: 'Agentic', hint: '检索案卷、法规与外部连接器' },
  Workflow: { label: 'Workflow', hint: '按绑定 SOP 执行并记录节点状态' },
}

const fallbackSources: ChatSource[] = [
  { kind: '项目案卷', title: '项目案卷 / 已上传材料', detail: '仅限本项目可读 · 3 个文件' },
  { kind: '全局 RAG', title: '民商法法规库', detail: '平台资料 · 检索命中 4 条' },
]

/* ── delegated execution ──
   The project Copilot is the team supervisor: it splits the task, delegates to
   members, and merges the answers. Direct route answers without delegating. */

interface DelegationStep {
  name: string
  duty: string
  tools: string[]
  status: string
}

interface DelegationPlan {
  supervisor: string
  note: string
  steps: DelegationStep[]
  budget: string
  traceId: string
}

const delegationByMode: Record<ChatMode, DelegationPlan> = {
  Direct: {
    supervisor: '不委派 · 单个数字员工直接回答',
    note: 'Direct 路线在当前会话内完成，不启动员工组，也不会调用任何 Connector。',
    steps: [
      { name: '法律顾问', duty: '直接回答并声明证据边界', tools: [], status: '已完成' },
    ],
    budget: '模型调用 1 / 32 · 用时 2.4 秒',
    traceId: 'a4d90c17e5b24c9f8f0a1b2c3d4e5f60',
  },
  Agentic: {
    supervisor: '项目 Copilot（诉讼支持小组主管）',
    note: '主管拆解任务后并行委派两位成员，成员各自的结论由主管汇总后再交付。',
    steps: [
      { name: '合同审查员', duty: '条款与合同事实', tools: ['read_file', 'search_law'], status: '已完成' },
      { name: '法律检索员', duty: '法规与判例检索', tools: ['load_connector_tools', 'search_law'], status: '已完成' },
    ],
    budget: '委派 2 / 8 · 并行 2 / 3 · 总用时 42.3 秒',
    traceId: '7c1e04b2a9f04f0d8a5e6b3c2d1f0091',
  },
  Workflow: {
    supervisor: '项目 Copilot · 按绑定 SOP 推进',
    note: '节点按合同审查工作流顺序执行，条件是业务语言描述、保存时编译，不在画布上手改 DSL。',
    steps: [
      { name: '条款切分', duty: 'SOP 节点 1', tools: ['read_file'], status: '已完成' },
      { name: '付款条款风险判断', duty: 'SOP 节点 2 · 条件分支', tools: ['search_law'], status: '已完成' },
      { name: '输出风险清单', duty: 'SOP 节点 3', tools: [], status: '待确认' },
    ],
    budget: '委派 1 / 8 · 并行 1 / 3 · 总用时 18.7 秒',
    traceId: '3e7a51c8842b4f0ea9d1c6552b8e4a07',
  },
}

/** Direct runs inside the employee that answered; every other route runs under the tenant's active team supervisor. */
function traceFocusFor(mode: ChatMode, teams: Team[]): TraceFocus {
  const activeTeam = teams.find(team => team.status === 'active')
  if (mode !== 'Direct' && activeTeam) return { kind: 'team', id: activeTeam.id }
  return { kind: 'employee', id: 'e-researcher' }
}

function DelegationCard({ mode, onOpenTraces }: { mode: ChatMode; onOpenTraces: () => void }) {
  const { teams, setTraceFocus } = useWorkspace()
  const plan = delegationByMode[mode]

  function openTrace() {
    setTraceFocus(traceFocusFor(mode, teams))
    onOpenTraces()
  }

  return (
    <div className="delegation-card">
      <div className="delegation-head">
        <span className="delegation-head-label">{mode === 'Direct' ? '执行方式' : '委派执行'}</span>
        <strong>{plan.supervisor}</strong>
        <button className="delegation-link" onClick={openTrace}>
          <Play size={11} strokeWidth={2} /> 在调试台查看
        </button>
      </div>
      <p className="delegation-note">{plan.note}</p>
      <div className="delegation-steps">
        {plan.steps.map(step => (
          <div className="delegation-step" key={step.name}>
            <Bot size={13} strokeWidth={1.8} />
            <div>
              <strong>{step.name}</strong>
              <span>{step.duty}</span>
            </div>
            {step.tools.length > 0 && (
              <div className="delegation-tools">
                {step.tools.map(tool => (
                  <span className="delegation-tool" key={tool}><Wrench size={10} strokeWidth={2} />{tool}</span>
                ))}
              </div>
            )}
            <span className={`delegation-status${step.status === '待确认' ? ' pending' : ''}`}>{step.status}</span>
          </div>
        ))}
      </div>
      <div className="delegation-foot">
        <span>{plan.budget}</span>
        <span className="delegation-trace">traceId <code>{plan.traceId.slice(0, 12)}…</code></span>
      </div>
    </div>
  )
}

const thinkingSteps = [
  { title: '读取项目材料', detail: '扫描案卷并检查解析状态', metric: '已读取 18 份案卷，3 份未解析' },
  { title: '核对法律依据', detail: '比对法规库与项目事实', metric: '已核对 42 条依据，4 条待确认' },
  { title: '整理结论', detail: '标记需要人工复核的判断', metric: '27 条结论中 2 条待核验' },
]

const thinkingMaterials = [
  { name: '尽调材料目录.md', status: '已读取', detail: '24 KB · 已提取目录、时间线与主体信息' },
  { name: '股权结构说明.txt', status: '已读取', detail: '8 KB · 已识别 6 个股东及持股关系' },
  { name: '历史沿革扫描件.pdf', status: '未解析', detail: 'OCR 队列 · 原文件需要更高分辨率' },
]

type ThinkingAgent = {
  id: string
  name: string
  role: string
  icon: LucideIcon
  scope: string
  materials: number[]
}

const thinkingAgentsByMode: Record<ChatMode, ThinkingAgent[]> = {
  Direct: [
    { id: 'counsel', name: '法律顾问', role: '拆解问题与输出边界', icon: Bot, scope: '把问题拆成可回答的子问题，并界定本次回答的范围和明确不做的判断。', materials: [0] },
    { id: 'facts', name: '事实审阅员', role: '核对案卷中的事实', icon: FileText, scope: '逐条比对案卷记载与用户陈述，标出不一致和缺失的事实。', materials: [1] },
    { id: 'checker', name: '结论核验员', role: '标记需要复核的判断', icon: CheckCircle2, scope: '为每条结论标注依据强度，标出需要律师人工复核的部分。', materials: [2] },
  ],
  Agentic: [
    { id: 'materials', name: '材料审阅员', role: '读取案卷与解析状态', icon: FileText, scope: '扫描项目案卷，登记可读文件与仍未解析的文件，回写材料目录。', materials: [0, 2] },
    { id: 'research', name: '法规检索员', role: '核对法规与判例依据', icon: Search, scope: '在法规库与判例库中检索，标注依据来源、时效和适用条件。', materials: [1] },
    { id: 'evidence', name: '证据核验员', role: '整理证据覆盖与结论', icon: CheckCircle2, scope: '检查每项主张的证据覆盖情况，标记证据缺口与待补材料。', materials: [2] },
  ],
  Workflow: [
    { id: 'orchestrator', name: '流程编排员', role: '按 SOP 调度任务节点', icon: Workflow, scope: '按预设 SOP 推进任务节点，记录每个节点的输入输出与耗时。', materials: [0] },
    { id: 'clause', name: '条款审查员', role: '识别条款风险与偏离', icon: FileText, scope: '逐条比对合同条款与范本，标出风险条款和偏离项。', materials: [1] },
    { id: 'delivery', name: '交付复核员', role: '检查输出结构与边界', icon: CheckCircle2, scope: '检查交付物的结构完整性、引用来源和输出边界声明。', materials: [2] },
  ],
}

const THINKING_STEP_INTERVAL_MS = 5000

function sourceIcon(kind: ChatSource['kind']) {
  if (kind === '项目案卷') return <FolderOpen size={14} strokeWidth={1.8} />
  if (kind === 'Connector') return <Globe2 size={14} strokeWidth={1.8} />
  if (kind === 'KnowledgeBase') return <Bot size={14} strokeWidth={1.8} />
  return <Search size={14} strokeWidth={1.8} />
}

function formatNow() {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date())
}

function ThinkingPanel({ mode }: { mode: ChatMode }) {
  const [activeStep, setActiveStep] = useState(0)
  const [showDetails, setShowDetails] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState(0)
  const [openAgentId, setOpenAgentId] = useState<string | null>(null)
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    setActiveStep(0)
    setShowDetails(false)
    setSelectedMaterial(0)
    setOpenAgentId(null)
    const interval = window.setInterval(() => {
      setActiveStep(value => Math.min(value + 1, thinkingSteps.length - 1))
    }, THINKING_STEP_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [mode])

  useEffect(() => {
    if (!showDetails) return
    window.requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }, [showDetails])

  const currentStep = thinkingSteps[activeStep]
  const agents = thinkingAgentsByMode[mode]
  const openAgent = agents.find(agent => agent.id === openAgentId) ?? null

  return (
    <section ref={panelRef} className="thinking-panel" aria-label="AI 思考过程" aria-live="polite">
      <div className="thinking-panel-head">
        <div className="thinking-copy">
          <div className="thinking-title-row">
            <strong>Nomos 正在思考</strong>
            <span className="thinking-live-dot"><span />实时</span>
          </div>
          <span>正在{currentStep.title} · {currentStep.detail}</span>
        </div>
        <div className="thinking-mode">{mode}</div>
      </div>

      <div className="thinking-team">
        <span className="thinking-team-sweep" aria-hidden="true" />
        <div className="thinking-agent-heading">
          <span>本次参与 {agents.length} 位数字员工</span>
          <span className="thinking-agent-running"><span />共同处理中</span>
        </div>
        <div className="thinking-agent-rail" role="list" aria-label="本次参与任务的数字员工">
          {agents.map((agent, index) => {
            const AgentIcon = agent.icon
            const isOpen = openAgent?.id === agent.id
            return (
              <button
                type="button"
                className="thinking-agent-chip"
                key={agent.id}
                onClick={() => setOpenAgentId(value => (value === agent.id ? null : agent.id))}
                aria-expanded={isOpen}
                aria-label={`${agent.name}，${agent.role}，查看职责与相关材料`}
              >
                <span className="thinking-agent-avatar" style={{ '--i': index } as CSSProperties}>
                  <AgentIcon size={12} strokeWidth={2} />
                  <span className="thinking-agent-dot" aria-hidden="true" />
                </span>
                <span className="thinking-agent-copy"><strong>{agent.name}</strong><small>{agent.role}</small></span>
                <ChevronDown size={11} strokeWidth={1.9} className={`thinking-agent-caret${isOpen ? ' is-open' : ''}`} />
              </button>
            )
          })}
        </div>
        {openAgent && (
          <div className="thinking-agent-detail">
            <div className="thinking-agent-detail-head">
              <strong>{openAgent.name}</strong>
              <span>{openAgent.role}</span>
            </div>
            <p>{openAgent.scope}</p>
            <div className="thinking-agent-detail-materials">
              {openAgent.materials.map(index => {
                const material = thinkingMaterials[index]
                return (
                  <span className={`thinking-agent-material${material.status === '未解析' ? ' warning' : ''}`} key={material.name}>
                    <span className="thinking-agent-material-dot" aria-hidden="true" />
                    {material.name}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="thinking-step-line" role="list" aria-label="思考阶段">
        {thinkingSteps.map((step, index) => (
          <div className={`thinking-step${index === activeStep ? ' active' : ''}${index < activeStep ? ' complete' : ''}`} key={step.title} role="listitem">
            <span className="thinking-step-dot">{index < activeStep ? <CheckCircle2 size={12} strokeWidth={2.2} /> : index + 1}</span>
            <span>{step.title}</span>
          </div>
        ))}
      </div>

      <div className="thinking-metrics">
        <button className="thinking-metric" onClick={() => { setShowDetails(true); setSelectedMaterial(0) }} aria-label="查看案卷处理明细">
          <span className="thinking-metric-label"><FileText size={13} strokeWidth={1.8} />案卷处理</span>
          <strong>18 <small>/ 21 份</small></strong>
          <span className="thinking-metric-caption">3 份未解析</span>
        </button>
        <button className="thinking-metric" onClick={() => { setShowDetails(true); setSelectedMaterial(2) }} aria-label="查看结论核验明细">
          <span className="thinking-metric-label"><CheckCircle2 size={13} strokeWidth={1.8} />结论检查</span>
          <strong>25 <small>/ 27 条</small></strong>
          <span className="thinking-metric-caption">2 条待核验</span>
        </button>
      </div>

      <div className="thinking-current-line">
        <span className="thinking-current-pulse" />
        <span>{currentStep.metric}</span>
        <span className="thinking-progress-bar"><span style={{ width: `${Math.round(((activeStep + 1) / thinkingSteps.length) * 100)}%` }} /></span>
      </div>

      <button className="thinking-details-toggle" onClick={() => setShowDetails(value => !value)} aria-expanded={showDetails}>
        <FileText size={13} strokeWidth={1.8} />
        {showDetails ? '收起材料明细' : '查看材料明细'}
        <ChevronDown size={14} strokeWidth={1.8} className={showDetails ? 'is-open' : ''} />
      </button>

      {showDetails && (
        <div className="thinking-details">
          <div className="thinking-material-list">
            {thinkingMaterials.map((material, index) => (
              <button className={`thinking-material${selectedMaterial === index ? ' selected' : ''}`} key={material.name} onClick={() => setSelectedMaterial(index)}>
                <span className={`thinking-material-status${material.status === '未解析' ? ' warning' : ''}`} />
                <span className="thinking-material-name">{material.name}</span>
                <span className="thinking-material-state">{material.status}</span>
                <ChevronRight size={13} strokeWidth={1.8} />
              </button>
            ))}
          </div>
          <div className="thinking-material-detail">
            <span>材料明细</span>
            <strong>{thinkingMaterials[selectedMaterial].name}</strong>
            <p>{thinkingMaterials[selectedMaterial].detail}</p>
          </div>
        </div>
      )}
    </section>
  )
}

export default function ConversationView({
  project,
  messages,
  isGenerating,
  initialMode = 'Agentic',
  onSendMessage,
  onStopGeneration,
  onBack,
  onNewConversation,
  onOpenTraces,
}: ConversationViewProps) {
  const [mode, setMode] = useState<ChatMode>(initialMode)
  const [draft, setDraft] = useState('')
  const [showSessions, setShowSessions] = useState(true)
  const [showInspector, setShowInspector] = useState(true)
  const [inspectorTab, setInspectorTab] = useState<'assets' | 'debug'>('assets')
  const { teams, setTraceFocus } = useWorkspace()
  const endRef = useRef<HTMLDivElement>(null)

  function openCurrentTrace() {
    setTraceFocus(traceFocusFor(mode, teams))
    onOpenTraces()
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages.length, isGenerating])

  function submit() {
    const text = draft.trim()
    if (!text || isGenerating) return
    onSendMessage(text, mode)
    setDraft('')
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div className="conversation-view">
      <header className="conversation-header">
        <div className="conversation-header-left">
          <button className="conversation-icon-btn" onClick={onBack} aria-label="返回项目" title="返回项目">
            <ArrowLeft size={17} strokeWidth={1.9} />
          </button>
          <div className="conversation-heading">
            <div className="conversation-breadcrumb">项目 / Copilot</div>
            <h1>{project.name}</h1>
          </div>
        </div>
        <div className="conversation-header-actions">
          <span className="conversation-live"><CircleDot size={11} strokeWidth={2.4} /> 本地演示</span>
          <button className="conversation-icon-btn" onClick={() => setShowSessions(value => !value)} aria-label="切换会话列表" title="切换会话列表">
            <PanelLeftClose size={16} strokeWidth={1.8} />
          </button>
          <button className="conversation-icon-btn" onClick={() => setShowInspector(value => !value)} aria-label="切换项目面板" title="切换项目面板">
            <PanelRightClose size={16} strokeWidth={1.8} />
          </button>
          <button className="conversation-icon-btn" aria-label="更多项目操作" title="更多项目操作">
            <MoreHorizontal size={17} strokeWidth={1.9} />
          </button>
        </div>
      </header>

      <div className={`conversation-grid${showSessions ? '' : ' no-sessions'}${showInspector ? '' : ' no-inspector'}`}>
        {showSessions && (
          <aside className="session-sidebar">
            <div className="session-sidebar-head">
              <span>项目会话</span>
              <button className="conversation-icon-btn small" onClick={onNewConversation} aria-label="新建会话" title="新建会话">
                <Plus size={15} strokeWidth={2} />
              </button>
            </div>
            <button className="session-item active">
              <div className="session-item-icon"><Bot size={14} strokeWidth={1.8} /></div>
              <div className="session-item-copy">
                <strong>{messages.find(message => message.role === 'user')?.text.slice(0, 19) || '新会话'}</strong>
                <span>{isGenerating ? '生成中' : '刚刚更新'}</span>
              </div>
              <ChevronDown size={13} strokeWidth={1.7} />
            </button>
            <div className="session-divider" />
            <div className="session-history-label"><History size={13} strokeWidth={1.8} /> 最近会话</div>
            <div className="session-history-item"><span>合同条款风险梳理</span><time>昨天</time></div>
            <div className="session-history-item"><span>项目材料摘要</span><time>3 天前</time></div>
            <div className="session-sidebar-footer">
              <div className="session-mini-stat"><span>会话</span><strong>{Math.max(project.sessions, 1)}</strong></div>
              <div className="session-mini-stat"><span>案卷</span><strong>3</strong></div>
            </div>
          </aside>
        )}

        <section className="chat-column">
          <div className="chat-column-toolbar">
            <div className="route-picker">
              {(Object.keys(modeMeta) as ChatMode[]).map(value => (
                <button key={value} className={mode === value ? 'active' : ''} onClick={() => setMode(value)}>
                  {value === 'Direct' && <CircleDot size={12} strokeWidth={2} />}
                  {value === 'Agentic' && <Search size={12} strokeWidth={2} />}
                  {value === 'Workflow' && <Workflow size={12} strokeWidth={2} />}
                  {modeMeta[value].label}
                </button>
              ))}
            </div>
            <span className="chat-route-hint">{modeMeta[mode].hint}</span>
          </div>

          <div className="message-viewport">
            {messages.length === 0 && (
              <div className="conversation-empty">
                <div className="conversation-empty-mark"><Bot size={23} strokeWidth={1.6} /></div>
                <h2>开始这个项目的第一轮对话</h2>
                <p>你可以先描述事实、上传案卷，或直接告诉 Nomos 需要完成的法律工作。</p>
              </div>
            )}
            {messages.map(message => (
              <article className={`message-row ${message.role}`} key={message.id}>
                {message.role === 'assistant' && <div className="message-avatar"><Bot size={15} strokeWidth={1.8} /></div>}
                <div className="message-content">
                  <div className="message-meta">
                    <span>{message.role === 'assistant' ? 'Nomos' : '你'}</span>
                    {message.mode && <span className="message-mode">{message.mode}</span>}
                    <time>{message.time}</time>
                  </div>
                  <div className="message-bubble">{message.text}</div>
                  {message.sources && message.sources.length > 0 && (
                    <div className="message-sources">
                      <div className="message-sources-label"><CheckCircle2 size={13} strokeWidth={1.9} /> 依据来源</div>
                      <div className="source-grid">
                        {message.sources.map(source => (
                          <div className="source-card" key={`${message.id}-${source.kind}`}>
                            <div className="source-card-icon">{sourceIcon(source.kind)}</div>
                            <div><strong>{source.title}</strong><span>{source.kind} · {source.detail}</span></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {message.role === 'assistant' && <DelegationCard mode={message.mode ?? mode} onOpenTraces={onOpenTraces} />}
                  {message.role === 'assistant' && <div className="message-actions"><button title="重新生成"><RotateCcw size={13} strokeWidth={1.7} /></button><button title="更多操作"><MoreHorizontal size={14} strokeWidth={1.8} /></button></div>}
                </div>
              </article>
            ))}
            {isGenerating && (
              <article className="message-row assistant">
                <div className="message-avatar"><Bot size={15} strokeWidth={1.8} /></div>
                <div className="message-content">
                  <div className="message-meta"><span>Nomos</span><span className="message-mode">{mode}</span></div>
                  <ThinkingPanel mode={mode} />
                </div>
              </article>
            )}
            <div ref={endRef} />
          </div>

          <form className="conversation-composer" onSubmit={event => { event.preventDefault(); submit() }}>
            <div className="composer-mode-line">
              <span className="composer-mode-dot" /> {mode} 路线
              <span className="composer-mode-copy">{modeMeta[mode].hint}</span>
            </div>
            <textarea value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={handleKeyDown} placeholder="继续描述问题，或追问上一条回答" rows={2} />
            <div className="composer-actions">
              <div className="composer-tools">
                <button type="button" title="添加会话附件"><Paperclip size={15} strokeWidth={1.8} /><span>附件</span></button>
                <button type="button" title="查看项目案卷"><FileText size={15} strokeWidth={1.8} /><span>案卷</span></button>
              </div>
              {isGenerating ? (
                <button type="button" className="composer-stop" onClick={onStopGeneration}><Square size={13} strokeWidth={2.2} /> 停止生成</button>
              ) : (
                <button type="submit" className="composer-send" disabled={!draft.trim()} aria-label="发送"><ArrowUp size={17} strokeWidth={2.3} /></button>
              )}
            </div>
          </form>
        </section>

        {showInspector && (
          <aside className="project-inspector">
            <div className="inspector-tabs">
              <button className={inspectorTab === 'assets' ? 'active' : ''} onClick={() => setInspectorTab('assets')}>资产</button>
              <button className={inspectorTab === 'debug' ? 'active' : ''} onClick={() => setInspectorTab('debug')}>调试</button>
            </div>

            {inspectorTab === 'assets' ? (
              <>
                <div className="inspector-section">
                  <div className="inspector-title"><span>项目案卷</span><button title="打开案卷"><FolderOpen size={14} strokeWidth={1.8} /></button></div>
                  <div className="inspector-file"><FileText size={14} strokeWidth={1.8} /><div><strong>尽调材料目录.md</strong><span>项目材料 · 24 KB</span></div><CheckCircle2 size={13} strokeWidth={1.9} /></div>
                  <div className="inspector-file"><FileText size={14} strokeWidth={1.8} /><div><strong>股权结构说明.txt</strong><span>项目材料 · 8 KB</span></div><CheckCircle2 size={13} strokeWidth={1.9} /></div>
                  <button className="inspector-link"><Plus size={13} strokeWidth={1.8} /> 添加项目文件</button>
                </div>
                <div className="inspector-section">
                  <div className="inspector-title"><span>工作流与产物</span><MoreHorizontal size={15} strokeWidth={1.8} /></div>
                  <div className="workflow-step done"><CheckCircle2 size={14} strokeWidth={1.8} /><span>事实抽取</span><small>完成</small></div>
                  <div className="workflow-step active"><CircleDot size={14} strokeWidth={1.8} /><span>风险判断</span><small>待运行</small></div>
                  <div className="workflow-step"><CircleDot size={14} strokeWidth={1.8} /><span>报告输出</span><small>未开始</small></div>
                </div>
                <div className="inspector-note"><Bot size={14} strokeWidth={1.8} /><span>来源边界已启用：项目案卷、全局 RAG、KnowledgeBase 与 Connector 分开记录。</span></div>
              </>
            ) : (
              <>
                <div className="inspector-section">
                  <div className="inspector-title"><span>运行状态</span><span className="inspector-status"><span /> {isGenerating ? '执行中' : '就绪'}</span></div>
                  <div className="run-card"><div className="run-card-top"><Play size={13} strokeWidth={1.8} /> 最近一次运行</div><strong>{mode} · {isGenerating ? '进行中' : '已完成'}</strong><span>响应已写入当前会话</span></div>
                  <button className="inspector-link" onClick={openCurrentTrace}><Search size={12} strokeWidth={2} /> 在调试台查看完整 Span</button>
                </div>
                <div className="inspector-section">
                  <div className="inspector-title"><span>本轮执行事件</span><span className="inspector-status"><span /> 实时</span></div>
                  <div className="inspector-event"><code>agent.start</code><span>governed-employee-e-contract</span></div>
                  <div className="inspector-event"><code>harness:model-request</code><span>工具集合与选择策略已记录</span></div>
                  <div className="inspector-event"><code>tool</code><span>read_file · 项目案卷/供应链框架合同.md</span></div>
                  <div className="inspector-event"><code>tool</code><span>search_law · 按需加载连接器工具</span></div>
                  <div className="inspector-event pending"><code>workflow</code><span>sop.contract-review · 等待确认输入范围</span></div>
                </div>
                <div className="inspector-section">
                  <div className="inspector-title"><span>项目观察记忆</span><FileText size={14} strokeWidth={1.8} /></div>
                  <div className="inspector-memory">供应链框架合同的账期为 90 天，逾期付款违约金按日万分之五</div>
                  <div className="inspector-memory">对方主体注册资本 5,000 万元，尚未完成实缴核验</div>
                  <div className="inspector-memory">争议解决条款约定由合同签订地法院管辖</div>
                </div>
                <div className="inspector-note"><FileText size={14} strokeWidth={1.8} /><span>原件保留在 MinIO 中按 hash 寻址；这里展示的是 Agent 已登记的观察，重新解析会生成新版本。</span></div>
              </>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}

export function createInitialAssistantMessage(project: Project): ChatMessage {
  return {
    id: `assistant-${project.id}`,
    role: 'assistant',
    mode: 'Agentic',
    time: formatNow(),
    text: `我已打开「${project.name}」项目。可以基于项目案卷梳理事实，也可以调用全局法律资料进行检索。请告诉我这次要优先完成什么。`,
    sources: fallbackSources,
  }
}

export function createUserMessage(text: string, mode: ChatMode): ChatMessage {
  return { id: `user-${Date.now()}`, role: 'user', text, mode, time: formatNow() }
}
