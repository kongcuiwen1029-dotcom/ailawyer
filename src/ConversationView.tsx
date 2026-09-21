import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowUp,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Copy,
  Database,
  Folder,
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

/* 一次生成的思考记录。stopped 记的是「用户中途停了」—— 收尾时回复没跟着来；
   afterId 是这次生成开始时消息流里的最后一条（就是触发它的那条用户消息），
   记录据此留在自己那一轮的位置上，而不是被推到流末尾去；endedAt 是这次运行的终点，
   计时就定在那里。轨迹本身是演示数据，不是这次生成算出来的，所以记录里不存轨迹。 */
interface TraceRecord {
  startedAt: number
  endedAt: number | null
  stopped: boolean
  afterId: string | null
}

/* 一条会话攒下的思考记录，分两处放 —— 因为它们在屏幕上的位置不同：
   settled 已经换来了回复，挂在它回应的那条回复上方（位置由 afterId 交棒给回复 id）；
   pending 还没有回复可挂（正在跑的、被停掉的），留在 afterId 那条消息后面。 */
interface TraceState {
  settled: Record<string, TraceRecord>
  pending: TraceRecord[]
}

const EMPTY_TRACES: TraceState = { settled: {}, pending: [] }

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

/* 思考轨迹的三行 = thinkingAgents 的三位员工，一一对应：一位员工负责一个阶段。
   note 是 metric 的紧凑形式（同一份数字，不是新事实），只有它出现在收起的那一行里；
   metric 整句留在该行展开后 —— 「18/21 份」在行上，「已读取 18 份案卷，3 份未解析」在行下。
   两者都只在轮到这一步之后才出现：它们记的是「做过什么」，没走过的步骤没有可记的。 */
const thinkingSteps = [
  { title: '读取项目材料', metric: '已读取 18 份案卷，3 份未解析', note: '18/21 份' },
  { title: '核对法律依据', metric: '已核对 42 条依据，4 条待确认', note: '42 条' },
  { title: '整理结论', metric: '27 条结论中 2 条待核验', note: '25/27 条' },
]

const thinkingMaterials = [
  { name: '尽调材料目录.md', status: '已读取', detail: '24 KB · 已提取目录、时间线与主体信息' },
  { name: '股权结构说明.txt', status: '已读取', detail: '8 KB · 已识别 6 个股东及持股关系' },
  { name: '历史沿革扫描件.pdf', status: '未解析', detail: 'OCR 队列 · 原文件需要更高分辨率' },
]

// 项目案卷只收 Markdown 与 TXT（需求文档 3.4：「项目案卷是项目私有材料，当前主要支持 Markdown 和 TXT」；
// 真实应用的 accept 也是 .md,.txt）。
const CASE_FILE_EXTENSIONS = '.md,.txt'
const CASE_FILE_PATTERN = /\.(md|txt)$/i

type CaseFile = {
  name: string
  size: string
  status: string
}

// 资产页的种子案卷取自上面那份 thinkingMaterials —— 同一份演示数据不在两处各写一遍文件名与大小。
// 只留 .md / .txt 两条：第三条是 .pdf 的「未解析」示例，不在案卷支持的格式里。
const caseFileSeeds: CaseFile[] = thinkingMaterials
  .filter(material => CASE_FILE_PATTERN.test(material.name))
  .map(material => ({
    name: material.name,
    size: material.detail.split(' · ')[0],
    status: material.status,
  }))

function formatFileSize(byteSize: number) {
  if (byteSize < 1024) return `${byteSize} B`
  if (byteSize < 1024 * 1024) return `${(byteSize / 1024).toFixed(1)} KB`
  return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`
}

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
// 流式的逐字速度：1 字 / 150ms，一句 15 字的正文约 2.3 秒打完，在 5 秒的一步里留一段静止。
const THINKING_TYPE_MS = 150

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

/* 思考轨迹（spec/31 对话流式输出设计语言）——
   一个可折叠的面板，展开后从下到上是三块：谁在做（数字员工）、做到哪了（思考的流式输出）、
   碰过哪些材料（材料明细）。它不是浮起来的表面：没有阴影、没有扫光。
   收起时占一行，展开后 620px —— 员工横排与材料的两栏明细都需要这个宽度（见 spec/31 的 06 偏差段）。 */
function ThinkingTrace({ live, stopped, startedAt, endedAt }: { live: boolean; stopped: boolean; startedAt: number; endedAt: number | null }) {
  // 展开状态机（05-行为规范 5.2）：展开 = 用户手动值 ?? 运行中。
  // 用户手动切过一次之后，运行态不再覆盖他的选择 —— 收起就是收起。
  const [manualOpen, setManualOpen] = useState<boolean | null>(null)
  const [streamOpen, setStreamOpen] = useState(true)
  const [openAgentId, setOpenAgentId] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [reduceMotion, setReduceMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const open = manualOpen ?? live

  /* 逐字是一支 JS 动效，CSS 的 reduced-motion 段管不到它，所以在这里单独关：
     偏好减弱动效时正文整句出现，不逐字。 */
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduceMotion(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  /* 计时读的是墙上的时间，不按阶段数推算 —— 数字可以是任何值，所以它诚实。
     跑完的那一拍不是由这个组件记的：终点写在记录里（endedAt），所以组件什么时候挂、
     挂了几次都不影响这个数。活着的才需要每 100ms 走一次表。 */
  useEffect(() => {
    if (!live) return
    const timer = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(timer)
  }, [live])

  const elapsedMs = Math.max((endedAt ?? now) - startedAt, 0)
  const elapsedSeconds = elapsedMs / 1000
  /* 走到第几步是从时长推导的，不是定时器一格一格加上去的 —— 它因此不依赖组件活了多久：
     停止的历史轨迹切走再回来、原地重挂，读出的都是同一个位置。真实应用里这一步由运行
     事件驱动，原型用 5 秒一格的节拍代替。 */
  const activeStep = Math.min(Math.floor(elapsedMs / THINKING_STEP_INTERVAL_MS), thinkingAgents.length - 1)
  /* 流式的两条规则：① 没轮到的步骤根本不在 —— 行是一步步长出来的，不是一次排好、只等
     变色；② 正在跑的那一步，正文按进入本步的时长逐字浮现，走过的行整句显示。
     历史轨迹（非 live 非 stopped）整句显示 —— 流式只属于正在发生的那一次。 */
  const visibleSteps = live || stopped ? thinkingSteps.slice(0, activeStep + 1) : thinkingSteps
  const typedChars = Math.floor(Math.max(elapsedMs - activeStep * THINKING_STEP_INTERVAL_MS, 0) / THINKING_TYPE_MS)
  const openAgent = thinkingAgents.find(agent => agent.id === openAgentId)
  const material = thinkingMaterials[selectedMaterial]

  /* 三态：跑完的是 done，正在跑的是 active，没轮到的和没跑完的一律 pending。
     被停掉的那次没有 active —— 停下来的那一刻它就不再「正在」了；它走到哪一步
     由 activeStep 记着，所以上面那几行仍然是走过的路，下面那几行仍然是没走的。
     员工卡与步骤行读的是同一次推导：一位员工负责一个阶段，两边不该各算各的。 */
  function stepState(index: number) {
    if (live) return index < activeStep ? 'done' : index === activeStep ? 'active' : 'pending'
    return stopped && index >= activeStep ? 'pending' : 'done'
  }

  return (
    <section className={`trace${live ? ' live' : ''}`} data-slot="thinking-trace" aria-label="AI 思考过程" aria-live="polite">
      <button type="button" className="trace-head" onClick={() => setManualOpen(value => !(value ?? live))} aria-expanded={open}>
        {/* 左端的小脸：照 Thinking.json 那张 Lottie 表情重画 —— 4 秒一条时间轴上的三次眨眼、
            一转眼珠（眉跟着挑、嘴跟着跑）、食指的点动，五条动效由 .trace-face 系列驱动 */}
        <svg className="trace-face" width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle className="trace-face-disc" cx="12" cy="12" r="9.3" stroke="none" />
          {/* 五官装在同一个组里：那份 Lottie 里它们的父层就是眼睛，眼珠一动整张脸跟着偏 */}
          <g className="trace-face-shift">
            {/* 眼是实心椭圆（不是描边竖线）：28px 下 rx 1.16 约 2.7px 宽，是这份尺寸还读得出来的形状 */}
            <ellipse className="trace-face-eye" cx="9.33" cy="8.8" rx="1.16" ry="1.45" fill="currentColor" stroke="none" />
            <ellipse className="trace-face-eye" cx="15.49" cy="9.38" rx="1.16" ry="1.45" fill="currentColor" stroke="none" />
            {/* 眉与嘴的描边在 Lottie 里是 30.19 世界单位 ≈ 0.93 此处单位，取 1 补一点栅格损失 */}
            <path className="trace-face-brow-l" d="M7.4 5.95C7.4 5.95 9.33 5.02 11.59 5.99" strokeWidth={1} />
            <path className="trace-face-brow-r" d="M13.63 8.17C13.63 8.17 15.6 7.3 17.8 8.43" strokeWidth={1} />
            <path d="M10.39 13.7C10.39 13.7 12.57 13.21 14.43 14.78" strokeWidth={1} />
          </g>
          {/* 左下角那只橙色的手（Mano 层）：它是那份 Lottie 里唯一没有父层的图层，所以不在
              shift 组里 —— 眼珠转的时候它不跟着偏。形状与位移照文件原样（局部坐标 + 图层
              变换），d 上这份是食指伸出的那一半，另一半与缓动在 CSS 的 trace-face-hand-point 里 */}
          <path className="trace-face-hand" fill="#f4900c" stroke="none" d="M36.35,151.64C36.35,151.64 60.22,143.88 63.31,126.13C66.58,107.81 51.54,104.11 51.54,104.11C51.54,104.11 71.18,100.18 73.65,78.14C75.97,57.39 57.39,52.43 57.39,52.43C57.39,52.43 75.69,44.88 76.56,23.39C77.28,5.29 57.78,-3.56 57.78,-3.56C57.78,-3.56 152.84,-26.58 162.6,-28.84C172.33,-31.12 187.52,-40.46 182.79,-60.82C178.09,-81.2 160.07,-81.92 150.75,-79.75C141.43,-77.56 23.5,-50.18 -17.18,-40.71C-21.52,-39.71 -41.86,-35.01 -44.33,-34.41C-54.52,-32.01 -59.14,-36.5 -51.97,-44.07C-42.37,-54.18 -36.25,-65.37 -34.1,-83.94C-31.86,-103.48 -38.48,-127.6 -42.27,-136.94C-49.33,-154.32 -61.24,-168.05 -74.99,-172.77C-96.47,-180.13 -111.71,-166.71 -104.09,-143.31C-92.69,-108.31 -100.14,-79.63 -119.81,-62.31C-166.01,-21.61 -187.52,7.41 -173.2,69.26C-157.6,136.71 -90.62,180.13 -23.16,164.5C-19.6,163.71 36.35,151.64 36.35,151.64Z" />
        </svg>
        <span className="trace-title">
          {live ? `正在${thinkingSteps[activeStep].title}` : `已思考 ${Math.round(elapsedSeconds)} 秒`}
        </span>
        {/* 「已中断」是中性的：断掉的是这次运行，不是哪一步出了错（02 里危险色留给失败本身）。 */}
        {stopped && <span className="trace-halt">已中断</span>}
        <span className="trace-count">{thinkingAgents.length} 位数字员工</span>
        {live && <span className="trace-timer">{elapsedSeconds.toFixed(1)}s</span>}
        <ChevronDown className={`trace-caret${open ? ' is-open' : ''}`} size={15} strokeWidth={1.9} aria-hidden="true" />
      </button>

      {/* grid-template-rows 0fr ↔ 1fr：不需要知道内容多高就能折叠，也不用 max-height 猜一个数 */}
      <div className={`trace-body${open ? ' is-open' : ''}`} aria-busy={live}>
        <div>
          <div className="trace-body-inner">

            {/* ── 谁在做 ── 一横排员工卡，点击展开各自的职责与关联材料 */}
            <div className="trace-team">
              <div className="trace-team-head">
                <span>本次参与 {thinkingAgents.length} 位数字员工</span>
                {live && (
                  <span className="trace-team-running">
                    <span className="trace-team-pulse" aria-hidden="true" />
                    共同处理中
                  </span>
                )}
              </div>
              <div className="trace-team-rail">
                {thinkingAgents.map((agent, index) => {
                  const state = stepState(index)
                  const isOpen = openAgentId === agent.id
                  return (
                    <button
                      type="button"
                      className="trace-agent-chip"
                      key={agent.id}
                      style={{ '--i': index } as CSSProperties}
                      onClick={() => setOpenAgentId(value => (value === agent.id ? null : agent.id))}
                      aria-expanded={isOpen}
                    >
                      <span className={`trace-agent-avatar ${state}`}>
                        <AgentAvatar id={agent.id} />
                        {state === 'done' && <span className="trace-agent-dot" aria-hidden="true" />}
                      </span>
                      <span className="trace-agent-copy">
                        <strong>{agent.name}</strong>
                        <small>{agent.role}</small>
                      </span>
                      <ChevronDown className={`trace-agent-caret${isOpen ? ' is-open' : ''}`} size={13} strokeWidth={2} aria-hidden="true" />
                    </button>
                  )
                })}
              </div>
              {openAgent && (
                <div className="trace-agent-detail">
                  <div className="trace-agent-detail-head">
                    <strong>{openAgent.name}</strong>
                    <span>{openAgent.role}</span>
                  </div>
                  <p>{openAgent.scope}</p>
                  <div className="trace-agent-materials">
                    {openAgent.materials.map(materialIndex => {
                      const item = thinkingMaterials[materialIndex]
                      return (
                        <span className={`trace-agent-material${item.status === '未解析' ? ' warning' : ''}`} key={item.name}>
                          <span className="trace-agent-material-dot" aria-hidden="true" />
                          {item.name}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ── 做到哪了 ── 三行步骤逐条流出来；正文只在这步真的走过之后才出现 */}
            <div className="trace-stream">
              <button type="button" className="trace-stream-head" onClick={() => setStreamOpen(value => !value)} aria-expanded={streamOpen}>
                <ChevronDown className={`trace-stream-caret${streamOpen ? ' is-open' : ''}`} size={14} strokeWidth={1.9} aria-hidden="true" />
                <span className="trace-stream-title">思考过程</span>
                <span className="trace-stream-count">{thinkingSteps.length} 个步骤</span>
              </button>
              <div className={`trace-stream-body${streamOpen ? ' is-open' : ''}`}>
                <div>
                  <div className="trace-stream-inner">
                    {visibleSteps.map((step, index) => {
                      const state = stepState(index)
                      /* 只有正在跑的那一步逐字，且只在 live 时 —— 走过的行整句。 */
                      const typing = live && !reduceMotion && index === activeStep
                      const metric = typing ? step.metric.slice(0, typedChars) : step.metric
                      return (
                        <div className={`trace-step ${state}`} key={step.title} style={{ '--i': index } as CSSProperties}>
                          <span className="trace-step-mark" aria-hidden="true">
                            {state === 'done' ? <Check size={13} strokeWidth={2.6} /> : <span className="trace-mark-dot" />}
                          </span>
                          <div className="trace-step-copy">
                            <div className="trace-step-line">
                              <span className="trace-step-title">{step.title}</span>
                              {/* 量级只在这一步真的走过之后才报。挂在一个还没开始的行上，它就从「记录」
                                  变成了「预告」—— 那个数字此刻没有任何依据（铁律 ③ 诚实优先于好看）。 */}
                              {state !== 'pending' && <span className="trace-step-note">{step.note}</span>}
                            </div>
                            {state !== 'pending' && metric && <p className="trace-step-body">{metric}</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* ── 碰过哪些材料 ── 左列表右详情，收起时只是一行按钮 */}
            <button type="button" className="trace-details-toggle" onClick={() => setShowDetails(value => !value)} aria-expanded={showDetails}>
              <ChevronDown className={showDetails ? 'is-open' : ''} size={13} strokeWidth={2} aria-hidden="true" />
              {showDetails ? '收起材料明细' : '查看材料明细'}
            </button>
            {showDetails && (
              <div className="trace-details">
                <div className="trace-material-list">
                  {thinkingMaterials.map((item, index) => (
                    <button
                      type="button"
                      className={`trace-material${index === selectedMaterial ? ' selected' : ''}`}
                      key={item.name}
                      onClick={() => setSelectedMaterial(index)}
                    >
                      <span className={`trace-material-status${item.status === '未解析' ? ' warning' : ''}`} aria-hidden="true" />
                      <span className="trace-material-name">{item.name}</span>
                      <span className="trace-material-state">{item.status}</span>
                      <ChevronRight size={13} strokeWidth={2} aria-hidden="true" />
                    </button>
                  ))}
                </div>
                <div className="trace-material-detail">
                  <span>材料明细</span>
                  <strong>{material.name}</strong>
                  <p>{material.detail}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/* 三栏的宽度契约照真实应用的 resizable panel 抄：会话栏 13/17/30rem、
   右侧面板 18/22/44rem、中栏底线 24rem（1rem = 16px）；分界条 12px 即它的 w-3。
   GRID_PAD_X 是 .conversation-grid 左右各 12px 的内边距（真实应用 `p-3 pt-0`），
   clientWidth 把它算在内，拖拽的天花板要先刨掉它。拖动只改像素值，所以这些
   常量就是四边边界。 */
const DIVIDER_WIDTH = 12
const GRID_PAD_X = 12
const SESSIONS_MIN = 208
const SESSIONS_DEFAULT = 272
const SESSIONS_MAX = 480
const INSPECTOR_MIN = 288
const INSPECTOR_DEFAULT = 352
const INSPECTOR_MAX = 704
const CHAT_MIN = 384

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/* 两栏之间的可拖分界：12px 宽的透明缝，hover 或拖动时才浮出中间那条 4px 细线。
   收起时宽度收到 0（有过渡），所以它始终留在 DOM 里，只是窄到点不着。拖动期给
   body 挂 conversation-resizing：关掉面板的宽度过渡（否则每帧都落后指针 180ms），
   并让指针移出分界条后细线仍然亮着。 */
function ConversationDivider({ label, collapsed, onDrag }: { label: string; collapsed: boolean; onDrag: (delta: number) => void }) {
  return (
    <div
      aria-hidden={collapsed || undefined}
      aria-label={label}
      aria-orientation="vertical"
      className="conversation-divider"
      onPointerDown={event => {
        event.preventDefault()
        const divider = event.currentTarget
        let last = event.clientX
        const move = (moveEvent: PointerEvent) => {
          onDrag(moveEvent.clientX - last)
          last = moveEvent.clientX
        }
        const stop = () => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', stop)
          document.body.classList.remove('conversation-resizing')
          divider.classList.remove('dragging')
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', stop)
        document.body.classList.add('conversation-resizing')
        divider.classList.add('dragging')
      }}
      role="separator"
      style={collapsed ? { width: 0 } : undefined}
    />
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
  /* null = 还没拖过，宽度由 CSS 给（含 1120px 断点下的收窄）；拖动一旦发生就定成像素值。 */
  const [sessionsWidth, setSessionsWidth] = useState<number | null>(null)
  const [inspectorWidth, setInspectorWidth] = useState<number | null>(null)
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
  const [caseFilesByProject, setCaseFilesByProject] = useState<Record<string, CaseFile[]>>({})
  const [traces, setTraces] = useState<Record<string, TraceState>>({})
  const endRef = useRef<HTMLDivElement>(null)
  const caseFileInputRef = useRef<HTMLInputElement>(null)
  const wasGeneratingRef = useRef(false)
  const gridRef = useRef<HTMLDivElement>(null)
  const sessionsPaneRef = useRef<HTMLDivElement>(null)
  const inspectorPaneRef = useRef<HTMLDivElement>(null)

  const activeConversation = conversations.find(item => item.id === activeConversationId) ?? null
  const messages = activeConversation?.messages ?? []
  const archived = conversations.filter(item => item.deletedAt)
  const lastAssistantId = [...messages].reverse().find(message => message.role === 'assistant')?.id
  const lastMessageId = messages[messages.length - 1]?.id ?? null

  /* 思考记录的一生：开跑时记一条，锚在这一轮最后那条消息后面；回复落地时把它交给那条
     回复，落进 settled（它就定格在回复上方）；如果收尾那一刻手里还攥着没交出去的一条，
     说明这次被用户停了 —— 留在 pending 里并标上 stopped，位置仍然在它自己那一轮。
     三个分支都只看状态本身，不看计数，所以切走再切回来既不会多记一条，也不会丢一条。 */
  useEffect(() => {
    if (!activeConversationId) {
      wasGeneratingRef.current = isGenerating
      return
    }
    const conversationId = activeConversationId
    const last = lastAssistantId
    /* 起止判断必须在这里定下来，不能挪进 setTraces 的回调里：React 可能在 effect 跑完
       之后才调用那个回调，那时 wasGeneratingRef 已经被下面这行改掉了，判断会当场翻脸。 */
    const starting = isGenerating && !wasGeneratingRef.current
    const finishing = !isGenerating && wasGeneratingRef.current
    /* 起止都从这一拍取，而且写进记录里 —— 计时不再依赖组件的状态：那一行被重挂过
       多少次，读出来的都是同一个数。 */
    const now = Date.now()
    const anchorId = lastMessageId
    setTraces(current => {
      const base = current[conversationId] ?? EMPTY_TRACES
      let state = base
      // 回复落地：把手里的这条交给它，记录就此定格在这条回复上方。前一条已经合上的不算 ——
      // 那次的运行早结束了，回复不可能是它换来的。
      if (last && !state.settled[last] && state.pending.length > 0) {
        const record = state.pending[state.pending.length - 1]
        if (record.endedAt === null) {
          state = { settled: { ...state.settled, [last]: { ...record, endedAt: now } }, pending: state.pending.slice(0, -1) }
        }
      }
      if (starting) {
        // 开跑：新的一次生成，记一条新的。
        state = { ...state, pending: [...state.pending, { startedAt: now, endedAt: null, stopped: false, afterId: anchorId }] }
      } else if (finishing && state.pending.length > 0) {
        /* 收尾时手里还攥着一条开着的，说明没有回复跟着来 —— 用户把这次停了。
           只在它还没合上（endedAt 为空）时才写：正常跑完的那次已经被上一步交给回复了，
           这时 pending 里剩下的是更早那次被停掉的记录，再盖一次时间戳就会把它
           「已思考 9 秒」改成「已思考 52 秒」。 */
        const record = state.pending[state.pending.length - 1]
        if (record.endedAt === null) {
          state = { ...state, pending: [...state.pending.slice(0, -1), { ...record, stopped: true, endedAt: now }] }
        }
      }
      return state === base ? current : { ...current, [conversationId]: state }
    })
    wasGeneratingRef.current = isGenerating
  }, [isGenerating, activeConversationId, lastAssistantId, lastMessageId])

  // 记录跟着会话走：切到别的会话自然不显示，切回来还在。
  const activeTraces = activeConversationId ? traces[activeConversationId] ?? EMPTY_TRACES : EMPTY_TRACES
  /* 还在跑的那一条永远是 pending 里最后一条。收尾（无论是接到回复还是被停掉）之后
     这里就是 null，于是屏幕上不会再有活着的轨迹。 */
  const liveRecord = isGenerating ? activeTraces.pending[activeTraces.pending.length - 1] : null
  /* 一条只有轨迹的 assistant 行：和别的 assistant 行同一个骨架（内容列），
     只是正文还没到（或不会到了）。它不是组件，就是一个画行的小函数 —— 写成组件的话
     每次 render 都会换一个类型，那一行会被整个卸载重挂，入场动画会重播。 */
  const traceRow = (record: TraceRecord) => (
    <article className="message-row assistant" key={record.startedAt}>
      <div className="message-content">
        <ThinkingTrace live={record === liveRecord} stopped={record.stopped} startedAt={record.startedAt} endedAt={record.endedAt} />
      </div>
    </article>
  )

  // 案卷是项目私有材料（需求文档 3.4），按项目 id 分开存，切换项目不会串上一个项目的案卷。
  const caseFiles = caseFilesByProject[project.id] ?? caseFileSeeds

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages.length, isGenerating])

  function submit() {
    const text = draft.trim()
    if (!text || isGenerating) return
    onSendMessage(text)
    setDraft('')
  }

  // 新加入的案卷只能是「未解析」：原型不跑解析链路，不能声称它已经被读过（与 thinkingMaterials
  // 里既有的那个状态同名）。扩展名由 input 的 accept 收窄，真正的编码 / 大小 / 数量校验在后端，
  // 原型不模拟。案卷按文件名唯一（真实应用 rowKey="filename"）：重名覆盖，不追加第二条。
  function addCaseFiles(fileList: FileList | null) {
    if (!fileList?.length) return

    const incoming: CaseFile[] = Array.from(fileList).map(file => ({
      name: file.name,
      size: formatFileSize(file.size),
      status: '未解析',
    }))

    setCaseFilesByProject(current => ({
      ...current,
      [project.id]: [
        ...(current[project.id] ?? caseFileSeeds).filter(file => !incoming.some(next => next.name === file.name)),
        ...incoming,
      ],
    }))
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

  /* 拖动的天花板：另一侧的实际宽 + 两条分界 + 中栏 384 的底线，所以窄窗口里拖到
     头就停住，不会把中栏挤没。未拖过时宽度由 CSS 决定，先问面板要 clientWidth；
     拖动一旦发生就固定为像素值，不再跟断点走。 */
  const dragSessions = (delta: number) => {
    const grid = gridRef.current
    if (!grid) return
    setSessionsWidth(current => {
      const base = current ?? sessionsPaneRef.current?.clientWidth ?? SESSIONS_DEFAULT
      const other = showInspector ? (inspectorPaneRef.current?.clientWidth ?? INSPECTOR_DEFAULT) : 0
      const ceiling = Math.min(SESSIONS_MAX, grid.clientWidth - GRID_PAD_X * 2 - other - DIVIDER_WIDTH * (showInspector ? 2 : 1) - CHAT_MIN)
      return clamp(base + delta, SESSIONS_MIN, Math.max(SESSIONS_MIN, ceiling))
    })
  }

  const dragInspector = (delta: number) => {
    const grid = gridRef.current
    if (!grid) return
    setInspectorWidth(current => {
      const base = current ?? inspectorPaneRef.current?.clientWidth ?? INSPECTOR_DEFAULT
      const other = showSessions ? (sessionsPaneRef.current?.clientWidth ?? SESSIONS_DEFAULT) : 0
      const ceiling = Math.min(INSPECTOR_MAX, grid.clientWidth - GRID_PAD_X * 2 - other - DIVIDER_WIDTH * (showSessions ? 2 : 1) - CHAT_MIN)
      return clamp(base - delta, INSPECTOR_MIN, Math.max(INSPECTOR_MIN, ceiling))
    })
  }

  const sessionsWidthStyle = sessionsWidth === null ? undefined : { width: sessionsWidth }
  const inspectorWidthStyle = inspectorWidth === null ? undefined : { width: inspectorWidth }

  return (
    <>
    <div className="conversation-view">
      <header className="conversation-header">
        <div className="conversation-header-left">
          <button className="conversation-icon-btn" onClick={onBack} aria-label="返回项目列表" title="返回项目列表">
            <ArrowLeft size={17} strokeWidth={1.9} />
          </button>
          <button className="conversation-icon-btn" onClick={() => setShowSessions(value => !value)} aria-label={showSessions ? '收起会话列表' : '展开会话列表'} title={showSessions ? '收起会话列表' : '展开会话列表'}>
            <PanelLeftClose size={16} strokeWidth={1.8} />
          </button>
        </div>
        <div className="conversation-heading">
          <h1>{project.name}</h1>
        </div>
        <div className="conversation-header-actions">
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

      <div className="conversation-grid" ref={gridRef}>
        <div className="conversation-pane conversation-pane-sessions" inert={!showSessions} ref={sessionsPaneRef} style={showSessions ? sessionsWidthStyle : { width: 0 }}>
          <div className="conversation-pane-inner" style={sessionsWidthStyle}>
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
          </div>
        </div>
        <ConversationDivider collapsed={!showSessions} label="调整会话列表宽度" onDrag={dragSessions} />

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
              <Fragment key={message.id}>
                <article className={`message-row ${message.role}`}>
                  <div className="message-content">
                    {activeTraces.settled[message.id] && (
                      <ThinkingTrace
                        key={activeTraces.settled[message.id].startedAt}
                        live={false}
                        stopped={false}
                        startedAt={activeTraces.settled[message.id].startedAt}
                        endedAt={activeTraces.settled[message.id].endedAt}
                      />
                    )}
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
                {/* 锚在这条消息后面的记录：这一次生成是它触发的，回复还没到（或不会到了）。 */}
                {activeTraces.pending.filter(record => record.afterId === message.id).map(traceRow)}
              </Fragment>
            ))}
            {/* 兜底：锚点已经不在消息流里的记录。正常路径下不该有，但宁可画在末尾，
                也不能让它一声不响地消失。 */}
            {activeTraces.pending.filter(record => !messages.some(message => message.id === record.afterId)).map(traceRow)}
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

        <ConversationDivider collapsed={!showInspector} label="调整右侧面板宽度" onDrag={dragInspector} />
        <div className="conversation-pane conversation-pane-inspector" inert={!showInspector} ref={inspectorPaneRef} style={showInspector ? inspectorWidthStyle : { width: 0 }}>
          <div className="conversation-pane-inner" style={inspectorWidthStyle}>
            <aside className="project-inspector">
              <div className="inspector-tabs">
                <button className={inspectorTab === 'assets' ? 'active' : ''} onClick={() => setInspectorTab('assets')}>资产</button>
                <button className={inspectorTab === 'debug' ? 'active' : ''} onClick={() => setInspectorTab('debug')}>调试</button>
              </div>

              {inspectorTab === 'assets' ? (
                <div className="inspector-section">
                  <div className="inspector-title">
                    <span className="inspector-title-label"><Folder size={13} strokeWidth={1.8} />项目案卷</span>
                  </div>
                  <div className="inspector-files">
                    {caseFiles.map(file => (
                      <div className="inspector-file" key={file.name}>
                        <span className="inspector-file-name">{file.name}</span>
                        <span className="inspector-file-meta">项目材料 · {file.size}</span>
                        {file.status === '已读取'
                          ? <CheckCircle2 aria-label={file.status} className="inspector-file-check" role="img" size={15} strokeWidth={2} />
                          : <Circle aria-label={file.status} className="inspector-file-check pending" role="img" size={15} strokeWidth={2} />}
                      </div>
                    ))}
                  </div>
                  <input
                    accept={CASE_FILE_EXTENSIONS}
                    className="hidden"
                    multiple
                    onChange={event => {
                      addCaseFiles(event.target.files)
                      event.target.value = ''
                    }}
                    ref={caseFileInputRef}
                    type="file"
                  />
                  <button className="inspector-add" onClick={() => caseFileInputRef.current?.click()} type="button">
                    <Plus size={13} strokeWidth={2} />添加项目文件
                  </button>
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
          </div>
        </div>
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
