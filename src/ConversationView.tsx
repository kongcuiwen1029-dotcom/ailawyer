import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowUp,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Database,
  FileText,
  MoreHorizontal,
  PanelLeftClose,
  PanelRightClose,
  Pencil,
  Plus,
  RotateCcw,
  Settings2,
  Square,
  Trash2,
  X,
} from 'lucide-react'
import type { Project } from './WorkspaceView'
import AgentAvatar from './agent-avatars'
import { useEnterToSend } from './ui/useEnterToSend'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
}

/* 一条项目会话。服务端的 ProjectConversation 除标题外只带运行态，这里保持一致：
   标题为空时列表回落到「新会话」，deletedAt 有值即进入回收站。 */
export interface ProjectConversation {
  id: string
  title: string
  messages: ChatMessage[]
  deletedAt?: string
  deletedLabel?: string
}

interface ConversationViewProps {
  project: Project
  conversations: ProjectConversation[]
  activeConversationId: string | null
  isGenerating: boolean
  onSendMessage: (text: string) => void
  onStopGeneration: () => void
  onRegenerate: () => void
  onBack: () => void
  onNewConversation: () => void
  onSelectConversation: (id: string) => void
  onRenameConversation: (id: string, title: string) => void
  onDeleteConversation: (id: string) => void
  onRestoreConversation: (id: string) => void
  onPurgeConversation: (id: string) => void
  onSaveProject: (name: string, desc: string) => void
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
  scope: string
  materials: number[]
}

const thinkingAgents: ThinkingAgent[] = [
  { id: 'materials', name: '材料审阅员', role: '读取案卷与解析状态', scope: '扫描项目案卷，登记可读文件与仍未解析的文件，回写材料目录。', materials: [0, 2] },
  { id: 'research', name: '法规检索员', role: '核对法规与判例依据', scope: '在法规库与判例库中检索，标注依据来源、时效和适用条件。', materials: [1] },
  { id: 'evidence', name: '证据核验员', role: '整理证据覆盖与结论', scope: '检查每项主张的证据覆盖情况，标记证据缺口与待补材料。', materials: [2] },
]

const THINKING_STEP_INTERVAL_MS = 5000

function ConversationDialog({ title, description, onClose, children, footer }: {
  title: string
  description: string
  onClose: () => void
  children?: ReactNode
  footer: ReactNode
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="conversation-overlay" role="presentation" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className="conversation-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="conversation-dialog-head">
          <div>
            <h2>{title}</h2>
            <p className="conversation-dialog-desc">{description}</p>
          </div>
          <button className="conversation-icon-btn small" onClick={onClose} aria-label="关闭" title="关闭">
            <X size={15} strokeWidth={2} />
          </button>
        </div>
        {children && <div className="conversation-dialog-body">{children}</div>}
        <div className="conversation-dialog-foot">{footer}</div>
      </div>
    </div>
  )
}

function ThinkingPanel() {
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
  }, [])

  useEffect(() => {
    if (!showDetails) return
    window.requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }, [showDetails])

  const currentStep = thinkingSteps[activeStep]
  const openAgent = thinkingAgents.find(agent => agent.id === openAgentId) ?? null

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
      </div>

      <div className="thinking-team">
        <div className="thinking-agent-heading">
          <span>本次参与 {thinkingAgents.length} 位数字员工</span>
          <span className="thinking-agent-running"><span />共同处理中</span>
        </div>
        <div className="thinking-agent-rail" role="list" aria-label="本次参与任务的数字员工">
          {thinkingAgents.map((agent, index) => {
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
                  <AgentAvatar id={agent.id} />
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
            <span className="thinking-step-label">{step.title}</span>
            {index < thinkingSteps.length - 1 && (
              <span className={`thinking-step-rail${index < activeStep ? ' done' : ''}`} aria-hidden="true" />
            )}
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
  conversations,
  activeConversationId,
  isGenerating,
  onSendMessage,
  onStopGeneration,
  onRegenerate,
  onBack,
  onNewConversation,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
  onRestoreConversation,
  onPurgeConversation,
  onSaveProject,
}: ConversationViewProps) {
  const [draft, setDraft] = useState('')
  const [knowledgeBase, setKnowledgeBase] = useState(true)
  const [showSessions, setShowSessions] = useState(true)
  const [showInspector, setShowInspector] = useState(true)
  const [inspectorTab, setInspectorTab] = useState<'assets' | 'debug'>('assets')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [renameError, setRenameError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showTrash, setShowTrash] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsName, setSettingsName] = useState(project.name)
  const [settingsDesc, setSettingsDesc] = useState(project.desc)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const activeConversation = conversations.find(item => item.id === activeConversationId) ?? null
  const messages = activeConversation?.messages ?? []
  const archived = conversations.filter(item => item.deletedAt)
  const lastAssistantId = [...messages].reverse().find(message => message.role === 'assistant')?.id

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages.length, isGenerating])

  function submit() {
    const text = draft.trim()
    if (!text || isGenerating) return
    onSendMessage(text)
    setDraft('')
  }

  async function copyMessage(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.text)
    } catch {
      /* 剪贴板被拒时静默失败，不打断阅读 */
    }
    setCopiedId(message.id)
    window.setTimeout(() => setCopiedId(current => (current === message.id ? null : current)), 1200)
  }

  const enterToSend = useEnterToSend(submit)

  return (
    <>
    <div className="conversation-view">
      <header className="conversation-header">
        <div className="conversation-header-left">
          <button className="conversation-icon-btn" onClick={onBack} aria-label="返回项目列表" title="返回项目列表">
            <ArrowLeft size={17} strokeWidth={1.9} />
          </button>
          <div className="conversation-heading">
            <h1>{project.name}</h1>
          </div>
        </div>
        <div className="conversation-header-actions">
          <button className="conversation-icon-btn" onClick={() => setShowSessions(value => !value)} aria-label={showSessions ? '收起会话列表' : '展开会话列表'} title={showSessions ? '收起会话列表' : '展开会话列表'}>
            <PanelLeftClose size={16} strokeWidth={1.8} />
          </button>
          <button className="conversation-icon-btn" onClick={() => setShowInspector(value => !value)} aria-label={showInspector ? '收起右侧面板' : '展开右侧面板'} title={showInspector ? '收起右侧面板' : '展开右侧面板'}>
            <PanelRightClose size={16} strokeWidth={1.8} />
          </button>
          <button
            className="conversation-icon-btn"
            onClick={() => { setSettingsName(project.name); setSettingsDesc(project.desc); setShowSettings(true) }}
            aria-label="项目设置"
            title="项目设置"
          >
            <Settings2 size={16} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <div className={`conversation-grid${showSessions ? '' : ' no-sessions'}${showInspector ? '' : ' no-inspector'}`}>
        {showSessions && (
          <aside className="session-sidebar">
            <div className="session-sidebar-head">
              <span>会话</span>
              <button className="conversation-icon-btn small" onClick={onNewConversation} aria-label="新建会话" title="新建会话">
                <Plus size={15} strokeWidth={2} />
              </button>
            </div>
            {conversations.filter(item => !item.deletedAt).length === 0 ? (
              <p className="session-empty">点击右上角「+」新建此项目下的第一条会话。</p>
            ) : (
              conversations.filter(item => !item.deletedAt).map(item => (
                <div className={`session-item-wrap${item.id === activeConversationId ? ' active' : ''}`} key={item.id}>
                  <button className={`session-item${item.id === activeConversationId ? ' active' : ''}`} onClick={() => onSelectConversation(item.id)}>
                    <div className="session-item-copy">
                      <strong>{item.title || '新会话'}</strong>
                      {item.id === activeConversationId && isGenerating && (
                        <span className="session-item-run" role="status" aria-label="生成中"><span />生成中</span>
                      )}
                    </div>
                  </button>
                  <button
                    className="session-item-more"
                    onClick={() => setOpenMenuId(value => (value === item.id ? null : item.id))}
                    aria-label={`会话操作：${item.title || '新会话'}`}
                    aria-expanded={openMenuId === item.id}
                    title="会话操作"
                  >
                    <MoreHorizontal size={15} strokeWidth={1.9} />
                  </button>
                  {openMenuId === item.id && (
                    <div className="session-menu" role="menu">
                      <button role="menuitem" onClick={() => { setOpenMenuId(null); setRenamingId(item.id); setRenameDraft(item.title); setRenameError('') }}>
                        <Pencil size={13} strokeWidth={1.8} /> 重命名
                      </button>
                      <button role="menuitem" onClick={() => { setOpenMenuId(null); setDeletingId(item.id) }}>
                        <Trash2 size={13} strokeWidth={1.8} /> 删除会话
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
            <div className="session-sidebar-foot">
              <button className="session-trash" onClick={() => setShowTrash(true)}>
                <Trash2 size={14} strokeWidth={1.8} />
                <span>回收站</span>
                {archived.length > 0 && <em>{archived.length}</em>}
              </button>
            </div>
          </aside>
        )}

        <section className="chat-column">
          <div className="message-viewport">
            {messages.length === 0 && (
              <div className="conversation-empty">
                <div className="conversation-empty-mark"><Bot size={23} strokeWidth={1.6} /></div>
                <h2>有什么可以帮你的吗？</h2>
                <p>消息会使用当前项目的共享记忆，并可按 metadata 偏好调用全局 RAG。</p>
              </div>
            )}
            {messages.map(message => (
              <article className={`message-row ${message.role}`} key={message.id}>
                {message.role === 'assistant' && <div className="message-avatar"><Bot size={15} strokeWidth={1.8} /></div>}
                <div className="message-content">
                  <div className="message-bubble">{message.text}</div>
                  {message.role === 'assistant' && (
                    <div className="message-actions">
                      <button onClick={() => copyMessage(message)} aria-label="复制" title="复制">
                        {copiedId === message.id ? <Check size={13} strokeWidth={2} /> : <Copy size={13} strokeWidth={1.7} />}
                      </button>
                      {message.id === lastAssistantId && !isGenerating && (
                        <button onClick={onRegenerate} aria-label="重新生成" title="重新生成">
                          <RotateCcw size={13} strokeWidth={1.7} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </article>
            ))}
            {isGenerating && (
              <article className="message-row assistant">
                <div className="message-avatar"><Bot size={15} strokeWidth={1.8} /></div>
                <div className="message-content">
                  <ThinkingPanel />
                </div>
              </article>
            )}
            <div ref={endRef} />
          </div>

          <form className="conversation-composer" onSubmit={event => { event.preventDefault(); submit() }}>
            <textarea value={draft} onChange={event => setDraft(event.target.value)} placeholder="输入项目问题，回车发送" rows={2} aria-label="项目问题输入" {...enterToSend} />
            <div className="composer-actions">
              <div className="composer-tools">
                <button
                  type="button"
                  className={`composer-kb${knowledgeBase ? ' active' : ''}`}
                  aria-pressed={knowledgeBase}
                  onClick={() => setKnowledgeBase(value => !value)}
                  title={knowledgeBase ? '已开启知识库检索，点击切换为不走知识库' : '已关闭知识库检索，点击切换为走知识库'}
                >
                  <Database size={15} strokeWidth={1.8} /><span>知识库</span>
                </button>
              </div>
              {isGenerating ? (
                <button type="button" className="composer-stop" onClick={onStopGeneration} aria-label="停止生成"><Square size={13} strokeWidth={2.2} /> 停止生成</button>
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
              <div className="inspector-section">
                <div className="inspector-title"><span>项目案卷</span></div>
                <p className="inspector-empty">还没有案卷文件。</p>
              </div>
            ) : (
              <>
                <div className="inspector-section">
                  <div className="inspector-title">
                    <span>Project scope</span>
                    <span className={`inspector-status${isGenerating ? '' : ' idle'}`}><span /> {isGenerating ? 'streaming' : 'ready'}</span>
                  </div>
                  <div className="inspector-context">
                    <span>resource</span>
                    <code>project:{project.id}</code>
                  </div>
                  <div className="inspector-context">
                    <span>thread</span>
                    <code>{activeConversationId ? `project-chat:${activeConversationId}` : '—'}</code>
                  </div>
                </div>

                <div className="inspector-section">
                  <div className="inspector-title">
                    <span>Delegation</span>
                    {isGenerating && <span className="inspector-live">live</span>}
                  </div>
                  <p className="inspector-empty">本轮还没有子 Agent 委派；主管会在需要时调用成员。</p>
                </div>

                <div className="inspector-section">
                  <div className="inspector-title"><span>Sources</span></div>
                  <p className="inspector-empty">本轮还没有登记来源。</p>
                </div>

                <div className="inspector-section">
                  <div className="inspector-title">
                    <span>项目观察记忆</span>
                    <span className="inspector-gen">gen 0</span>
                  </div>
                  <div className="inspector-tokens">
                    <div><span>Messages</span><span className="inspector-bar"><i style={{ width: '0%' }} /></span></div>
                    <div><span>Observations</span><span className="inspector-bar"><i style={{ width: '0%' }} /></span></div>
                  </div>
                  <p className="inspector-empty">还没有观察日志；对话累积到阈值后 Observer 会首次生成。</p>
                </div>
              </>
            )}
          </aside>
        )}
      </div>
    </div>

      {/* 弹窗渲染在 .conversation-view 之外。玻璃主题给这个容器上了
         backdrop-filter，而 backdrop-filter 会让容器成为 fixed 定位的包含块——
         遮罩就只能盖住容器内缩一圈的矩形，四边会留出一圈没被压暗的页边。 */}
      {renamingId && (
        <ConversationDialog
          title="重命名对话"
          description="保持简短且易于识别"
          onClose={() => setRenamingId(null)}
          footer={
            <>
              <button className="conversation-dialog-btn" onClick={() => setRenamingId(null)}>取消</button>
              <button
                className="conversation-dialog-btn primary"
                onClick={() => {
                  const name = renameDraft.trim()
                  if (!name) { setRenameError('会话名称不能为空。'); return }
                  onRenameConversation(renamingId, name)
                  setRenamingId(null)
                }}
              >
                保存
              </button>
            </>
          }
        >
          <label className="conversation-dialog-field">
            <span>会话名称</span>
            <input
              value={renameDraft}
              autoFocus
              onChange={event => { setRenameDraft(event.target.value); setRenameError('') }}
              placeholder="会话名称"
            />
          </label>
          {renameError && <p className="conversation-dialog-error">{renameError}</p>}
        </ConversationDialog>
      )}

      {deletingId && (
        <ConversationDialog
          title="删除会话"
          description={`确定删除「${conversations.find(item => item.id === deletingId)?.title || '新会话'}」吗？删除后可在回收站恢复。`}
          onClose={() => setDeletingId(null)}
          footer={
            <>
              <button className="conversation-dialog-btn" onClick={() => setDeletingId(null)}>取消</button>
              <button className="conversation-dialog-btn danger" onClick={() => { onDeleteConversation(deletingId); setDeletingId(null) }}>删除</button>
            </>
          }
        />
      )}

      {showTrash && (
        <ConversationDialog
          title="回收站"
          description="已删除的会话保留在此，可恢复到会话列表，或彻底删除。"
          onClose={() => setShowTrash(false)}
          footer={<button className="conversation-dialog-btn" onClick={() => setShowTrash(false)}>关闭</button>}
        >
          {archived.length === 0 ? (
            <p className="inspector-empty">回收站是空的。</p>
          ) : (
            archived.map(item => (
              <div className="conversation-trash-row" key={item.id}>
                <div>
                  <strong>{item.title || '新会话'}</strong>
                  <span>删除于 {item.deletedLabel ?? '—'}</span>
                </div>
                <button className="conversation-dialog-btn" onClick={() => onRestoreConversation(item.id)}>恢复</button>
                <button className="conversation-dialog-btn danger" onClick={() => onPurgeConversation(item.id)}>彻底删除</button>
              </div>
            ))
          )}
        </ConversationDialog>
      )}

      {showSettings && (
        <ConversationDialog
          title="项目设置"
          description="基本信息"
          onClose={() => setShowSettings(false)}
          footer={
            <>
              <button className="conversation-dialog-btn" onClick={() => setShowSettings(false)}>取消</button>
              <button className="conversation-dialog-btn primary" onClick={() => { onSaveProject(settingsName.trim(), settingsDesc.trim()); setShowSettings(false) }}>保存</button>
            </>
          }
        >
          <label className="conversation-dialog-field">
            <span>项目名称</span>
            <input value={settingsName} onChange={event => setSettingsName(event.target.value)} placeholder="项目名称" />
          </label>
          <label className="conversation-dialog-field">
            <span>项目描述</span>
            <input value={settingsDesc} onChange={event => setSettingsDesc(event.target.value)} placeholder="一句话描述这个项目。" />
          </label>
        </ConversationDialog>
      )}
    </>
  )
}

export function createUserMessage(text: string): ChatMessage {
  return { id: `user-${Date.now()}`, role: 'user', text }
}

export function createConversation(id: string, title: string): ProjectConversation {
  return { id, title, messages: [] }
}
