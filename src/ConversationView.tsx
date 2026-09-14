import { useEffect, useRef, useState } from 'react'
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
} from 'lucide-react'
import type { Project } from './WorkspaceView'

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

function ThinkingCharacter({ step }: { step: number }) {
  const stages = ['reading', 'checking', 'concluding'] as const

  return (
    <div className={`thinking-character is-${stages[step]}`} aria-hidden="true">
      <svg className="thinking-character-svg" viewBox="0 0 92 58" fill="none">
        <path className="thinking-scene-floor" d="M9 49.5H82" />

        <g className="thinking-person">
          <circle className="thinking-person-head" cx="27" cy="16" r="6.5" />
          <path className="thinking-person-body" d="M27 23V36.5" />
          <path className="thinking-person-arm arm-left" d="M27 27L19.5 33.5L16 30.5" />
          <path className="thinking-person-arm arm-right" d="M27 27L36 32L43 27.5" />
          <path className="thinking-person-legs" d="M27 36.5L21.5 47M27 36.5L33.5 47" />
        </g>

        <g className="thinking-scene-paper">
          <rect className="thinking-paper-back" x="49" y="10" width="24" height="32" rx="2.5" />
          <path className="thinking-paper-front" d="M44 14.5H65.5L71 20V45H44V14.5Z" />
          <path className="thinking-paper-fold" d="M65 14.5V20.5H71" />
          <path className="thinking-paper-line line-one" d="M49 26H65" />
          <path className="thinking-paper-line line-two" d="M49 31H63" />
          <path className="thinking-paper-line line-three" d="M49 36H66" />
        </g>

        <g className="thinking-scene-magnifier">
          <circle cx="57" cy="28" r="7" />
          <path className="thinking-magnifier-handle" d="M62 33L68.5 39.5" />
          <path className="thinking-scan-ray" d="M53 28H61" />
        </g>

        <g className="thinking-scene-nodes">
          <path className="thinking-node-link link-one" d="M49 28L59 20L70 27" />
          <path className="thinking-node-link link-two" d="M49 28L58 39L70 27" />
          <circle className="thinking-node node-one" cx="49" cy="28" r="3" />
          <circle className="thinking-node node-two" cx="59" cy="20" r="3" />
          <circle className="thinking-node node-three" cx="58" cy="39" r="3" />
          <circle className="thinking-node node-four" cx="70" cy="27" r="5.5" />
          <path className="thinking-conclusion-check" d="M67.5 27L69.5 29L73 24.8" />
        </g>
      </svg>
      <span className="thinking-scan-dot" />
    </div>
  )
}

function ThinkingPanel({ mode }: { mode: ChatMode }) {
  const [activeStep, setActiveStep] = useState(0)
  const [showDetails, setShowDetails] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState(0)
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    setActiveStep(0)
    setShowDetails(false)
    setSelectedMaterial(0)
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

  return (
    <section ref={panelRef} className="thinking-panel" aria-label="AI 思考过程" aria-live="polite">
      <div className="thinking-panel-head">
        <ThinkingCharacter key={activeStep} step={activeStep} />
        <div className="thinking-copy">
          <div className="thinking-title-row">
            <strong>Nomos 正在思考</strong>
            <span className="thinking-live-dot"><span />实时</span>
          </div>
          <span>{currentStep.title} · {currentStep.detail}</span>
        </div>
        <div className="thinking-mode">{mode}</div>
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
}: ConversationViewProps) {
  const [mode, setMode] = useState<ChatMode>(initialMode)
  const [draft, setDraft] = useState('')
  const [showSessions, setShowSessions] = useState(true)
  const [showInspector, setShowInspector] = useState(true)
  const endRef = useRef<HTMLDivElement>(null)

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
            <div className="inspector-section">
              <div className="inspector-title"><span>项目案卷</span><button title="打开案卷"><FolderOpen size={14} strokeWidth={1.8} /></button></div>
              <div className="inspector-file"><FileText size={14} strokeWidth={1.8} /><div><strong>尽调材料目录.md</strong><span>项目材料 · 24 KB</span></div><CheckCircle2 size={13} strokeWidth={1.9} /></div>
              <div className="inspector-file"><FileText size={14} strokeWidth={1.8} /><div><strong>股权结构说明.txt</strong><span>项目材料 · 8 KB</span></div><CheckCircle2 size={13} strokeWidth={1.9} /></div>
              <button className="inspector-link"><Plus size={13} strokeWidth={1.8} /> 添加项目文件</button>
            </div>
            <div className="inspector-section">
              <div className="inspector-title"><span>运行状态</span><span className="inspector-status"><span /> 就绪</span></div>
              <div className="run-card"><div className="run-card-top"><Play size={13} strokeWidth={1.8} /> 最近一次运行</div><strong>{mode} · 已完成</strong><span>响应已写入当前会话</span></div>
            </div>
            <div className="inspector-section">
              <div className="inspector-title"><span>工作流与产物</span><MoreHorizontal size={15} strokeWidth={1.8} /></div>
              <div className="workflow-step done"><CheckCircle2 size={14} strokeWidth={1.8} /><span>事实抽取</span><small>完成</small></div>
              <div className="workflow-step active"><CircleDot size={14} strokeWidth={1.8} /><span>风险判断</span><small>待运行</small></div>
              <div className="workflow-step"><CircleDot size={14} strokeWidth={1.8} /><span>报告输出</span><small>未开始</small></div>
            </div>
            <div className="inspector-note"><Bot size={14} strokeWidth={1.8} /><span>来源边界已启用：项目案卷、全局 RAG、KnowledgeBase 与 Connector 分开记录。</span></div>
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
