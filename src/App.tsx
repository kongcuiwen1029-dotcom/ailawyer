import { useRef, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import ConversationView, {
  createConversation,
  createUserMessage,
  type ChatMessage,
  type ProjectConversation,
} from './ConversationView'
import type { ViewId } from './nav'
import { TENANTS, WorkspaceProvider, useWorkspace, type Project } from './state/workspace'
import Welcome from './Welcome'

type Theme = 'dark' | 'gray'

const nextTheme: Record<Theme, Theme> = { dark: 'gray', gray: 'dark' }
const themeLabel: Record<Theme, string> = { dark: '切换灰色', gray: '切换深色' }
const shortcutLabel: Record<string, string> = { consult: '法律咨询', search: '法律检索', review: '文件审查', contract: '合同起草' }
const THINKING_DURATION_MS = 20000

interface ProjectChats {
  conversations: ProjectConversation[]
  activeId: string | null
}

const emptyChats: ProjectChats = { conversations: [], activeId: null }

/* 演示用的回复文本。刻意不写任何来源、员工组或 SOP 名字：这些只有真实执行时
   才会产生，编出来就等于伪造证据链。也不复述问题 —— 从首页发起的项目，项目名
   就是问题本身，两句叠在一起会读成复读。2026-09-21：按用户要求把这段演示回复
   加长到约 1000 字符，用来查看长回复的排版；内容是同一件事的展开 —— 讲清楚
   这一轮在原型里发生了什么、没发生什么，不新增任何具体的法律结论。 */
function replyFor(project: Project): string {
  return `已收到。这一轮在「${project.name}」的项目上下文里处理，本轮登记的来源与执行记录会写进右侧面板。

先把话说清楚：这段回复由原型内置的演示逻辑给出，不是模型生成的答案。原型不接模型，也不跑检索，所以它不会返回具体的条文、案号或结论——不是没查到，而是这条链路在原型里不存在。真实应用会在同样的位置返回带引用标注的回答，并标出命中的来源文件与段落位置，那才是这套界面要服务的形态。

这一轮在界面上看得到的内容，全部来自项目自己的数据。消息使用当前项目的共享记忆，并可按 metadata 偏好调用全局知识库，输入框左下角的知识库开关就是这条链路的入口。右侧面板分两个页签：资产页签里是项目的案卷文件，支持 Markdown 与 TXT，上传后按解析状态逐一标出；调试页签按 Project scope、Delegation、Sources 与项目观察记忆四段登记本轮的执行信息——在原型里后两段是空的，因为没有真实执行去产生它们。消息上方的思考轨迹记录参与这一轮的数字员工、已经走过的步骤和读取的材料明细，展开后可以逐项核对。案卷目前只支持 Markdown 与 TXT 两类文本，上传后先记为未解析——解析链路属于真实应用，原型不声称它已经跑过。

如果这是一条真实的执行链路，这一轮会依次走完三个环节：先从项目案卷里读取已经解析的材料，把目录、主体与时间线提取出来；再核对法律依据，逐条确认适用与待确认；最后整理结论，把证据覆盖与缺口一并列出。每一步的产出都会落进右侧面板，来源与执行记录可回溯，结论附出处。现在没有这些，是因为原型只演示结构，不演示一次真实的办案过程。项目之间是隔离的：案卷按项目存放，共享记忆也按项目分开，切换项目不会把上一个项目的材料带进这一轮。

之所以写机制而不是补一段读起来像样的答复：在没有真实执行的前提下，任何来源、员工组、SOP 或条文引用都是编出来的，等于在一份尽调材料里伪造证据链。界面可以演示交互与结构，证据必须来自真实执行。会话与项目的关系同样直白：会话挂在项目下面，删除先进回收站，恢复后回到原来的位置。这里宁可如实回报做了什么、没做什么，也不把缺失的部分用看上去完整的文字填上。等接上真实的检索与生成链路，这个位置出现的会是引用、出处与推理过程，而不是这段说明。在那之前，右侧面板与思考轨迹里能核对的部分，就是这一轮的全部。`
}

function nowLabel() {
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date())
}

export default function App() {
  return (
    <WorkspaceProvider>
      <AppShell />
    </WorkspaceProvider>
  )
}

function AppShell() {
  const { projects, createProject, renameProject, setProjectStatus, bumpProjectSessions } = useWorkspace()
  const [theme, setTheme] = useState<Theme>('dark')
  const [activeNav, setActiveNav] = useState<ViewId>('new')
  // The composer's tenant picker is gone, so there is nothing left to switch this.
  // New projects still record a tenant.
  const tenant = TENANTS[0]
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [chatsByProject, setChatsByProject] = useState<Record<string, ProjectChats>>({})
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const activeProject = projects.find(project => project.id === activeProjectId) ?? null
  const activeChats = activeProjectId ? (chatsByProject[activeProjectId] ?? emptyChats) : emptyChats
  /* 打开的那条会话。删掉最后一条会把 activeId 清空，而从回收站恢复只把它放回
     列表——不补这一步的话，界面会停在空态、输入框也发不出东西，用户得自己再点
     一次那条会话。全部会话都在回收站里时才真的是没有会话可选。 */
  const activeConversationId = activeChats.activeId ?? activeChats.conversations.find(item => !item.deletedAt)?.id ?? null

  function patchChats(projectId: string, patch: (current: ProjectChats) => ProjectChats) {
    setChatsByProject(current => ({ ...current, [projectId]: patch(current[projectId] ?? emptyChats) }))
  }

  function appendMessage(projectId: string, conversationId: string, message: ChatMessage) {
    patchChats(projectId, current => ({
      ...current,
      conversations: current.conversations.map(item => item.id === conversationId ? { ...item, messages: [...item.messages, message] } : item),
    }))
  }

  function stopGeneration() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
    setGeneratingId(null)
    if (activeProjectId) setProjectStatus(activeProjectId, { kind: 'warn', label: '已暂停' })
  }

  function queueAssistant(projectId: string, conversationId: string, projectOverride?: Project) {
    setGeneratingId(conversationId)
    setProjectStatus(projectId, { kind: 'run', label: '生成中' })
    // Keep the local demo long enough for the thinking panel to be legible.
    timerRef.current = window.setTimeout(() => {
      const project = projectOverride ?? projects.find(item => item.id === projectId)
      if (!project) return
      appendMessage(projectId, conversationId, { id: `assistant-${Date.now()}`, role: 'assistant', text: replyFor(project) })
      bumpProjectSessions(projectId)
      setGeneratingId(null)
      timerRef.current = null
    }, THINKING_DURATION_MS)
  }

  function openProject(project: Project) {
    setActiveProjectId(project.id)
    setActiveNav('conversation')
    setChatsByProject(current => {
      const existing = current[project.id]
      // 每条项目会话对应一个独立的 Chat Execution，打开项目时没有会话就先建一条。
      if (existing && existing.conversations.some(item => !item.deletedAt)) return current
      const conversation = createConversation(`c-${Date.now()}`, '新会话')
      return { ...current, [project.id]: { conversations: [...(existing?.conversations ?? []), conversation], activeId: conversation.id } }
    })
  }

  function startConversation(input: string, shortcutId?: string) {
    const label = shortcutId ? shortcutLabel[shortcutId] : undefined
    const text = input.trim() || (label ? `请帮我进行${label}` : '')
    if (!text) return
    const name = text.length > 24 ? `${text.slice(0, 24)}…` : text
    const desc = label ? `${label}任务 · 首条问题已带入项目会话` : '由新建对话创建的法律项目，等待继续补充上下文。'
    const projectId = createProject(name, desc, tenant)
    const project: Project = { id: projectId, name, desc, sessions: 1, updated: '刚刚', tenant, status: { kind: 'run', label: '生成中' } }
    const conversation = createConversation(`c-${Date.now()}`, name)
    setChatsByProject(current => ({ ...current, [projectId]: { conversations: [conversation], activeId: conversation.id } }))
    setActiveProjectId(projectId)
    setActiveNav('conversation')
    appendMessage(projectId, conversation.id, createUserMessage(text))
    queueAssistant(projectId, conversation.id, project)
  }

  function sendMessage(text: string) {
    const projectId = activeProjectId
    const conversationId = activeConversationId
    if (!projectId || !conversationId || generatingId === conversationId) return
    appendMessage(projectId, conversationId, createUserMessage(text))
    queueAssistant(projectId, conversationId)
  }

  function regenerate() {
    const projectId = activeProjectId
    const conversationId = activeConversationId
    if (!projectId || !conversationId || generatingId) return
    const conversation = activeChats.conversations.find(item => item.id === conversationId)
    const lastUser = [...(conversation?.messages ?? [])].reverse().find(message => message.role === 'user')
    if (!lastUser) return
    patchChats(projectId, current => ({
      ...current,
      conversations: current.conversations.map(item => item.id === conversationId
        ? { ...item, messages: item.messages.filter(message => message.role === 'user') }
        : item),
    }))
    queueAssistant(projectId, conversationId)
  }

  function newProject() {
    setActiveProjectId(null)
    setActiveNav('new')
  }

  function newConversation() {
    const projectId = activeProjectId
    if (!projectId) {
      newProject()
      return
    }
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
    setGeneratingId(null)
    const conversation = createConversation(`c-${Date.now()}`, '新会话')
    patchChats(projectId, current => ({ ...current, conversations: [...current.conversations, conversation], activeId: conversation.id }))
  }

  function patchConversation(conversationId: string, patch: (item: ProjectConversation) => ProjectConversation) {
    if (!activeProjectId) return
    patchChats(activeProjectId, current => ({
      ...current,
      conversations: current.conversations.map(item => item.id === conversationId ? patch(item) : item),
    }))
  }

  function renameConversation(conversationId: string, title: string) {
    patchConversation(conversationId, item => ({ ...item, title }))
  }

  function deleteConversation(conversationId: string) {
    if (generatingId === conversationId) {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = null
      setGeneratingId(null)
    }
    patchConversation(conversationId, item => ({ ...item, deletedAt: '刚刚', deletedLabel: nowLabel() }))
    if (activeProjectId) {
      patchChats(activeProjectId, current => {
        if (current.activeId !== conversationId) return current
        const next = current.conversations.find(item => item.id !== conversationId && !item.deletedAt)
        return { ...current, activeId: next?.id ?? null }
      })
    }
  }

  function restoreConversation(conversationId: string) {
    patchConversation(conversationId, item => ({ ...item, deletedAt: undefined, deletedLabel: undefined }))
  }

  function purgeConversation(conversationId: string) {
    if (!activeProjectId) return
    patchChats(activeProjectId, current => ({ ...current, conversations: current.conversations.filter(item => item.id !== conversationId) }))
  }

  function saveProject(name: string, desc: string) {
    if (!activeProject || !name) return
    renameProject(activeProject.id, name, desc)
  }

  /* Both themes render the same home screen; only the CSS palette behind the
     `dk-` / `gy-` class prefix changes. See src/Welcome.tsx for why. */
  function renderTheme() {
    const shared = {
      activeNav,
      onActiveNavChange: setActiveNav,
      onStartConversation: startConversation,
      projects,
      onOpenProject: openProject,
    }
    return <Welcome theme={theme} {...shared} />
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {activeNav === 'conversation' && activeProject ? (
        <div className={`conversation-theme ${theme}`}>
          <ConversationView
            project={activeProject}
            conversations={activeChats.conversations}
            activeConversationId={activeConversationId}
            isGenerating={generatingId !== null && generatingId === activeConversationId}
            onSendMessage={sendMessage}
            onStopGeneration={stopGeneration}
            onRegenerate={regenerate}
            onBack={() => setActiveNav('projects')}
            onNewConversation={newConversation}
            onSelectConversation={id => patchChats(activeProject.id, current => ({ ...current, activeId: id }))}
            onRenameConversation={renameConversation}
            onDeleteConversation={deleteConversation}
            onRestoreConversation={restoreConversation}
            onPurgeConversation={purgeConversation}
            onSaveProject={saveProject}
          />
        </div>
      ) : renderTheme()}
      <button className={`theme-toggle ${theme}`} onClick={() => setTheme(value => nextTheme[value])} aria-label={themeLabel[theme]} title={themeLabel[theme]}>
        {theme === 'dark' ? <Sun size={17} strokeWidth={2} /> : <Moon size={17} strokeWidth={2} />}
      </button>
    </div>
  )
}
