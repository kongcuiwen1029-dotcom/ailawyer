import { useRef, useState } from 'react'
import { Layers, Moon, Sun } from 'lucide-react'
import AppDark from './AppDark'
import ConversationView, {
  createInitialAssistantMessage,
  createUserMessage,
  type ChatMessage,
  type ChatMode,
} from './ConversationView'
import { initialProjects, type Project } from './WorkspaceView'
import type { ViewId } from './nav'
import WelcomeGray from './WelcomeGray'
import WelcomeLight from './WelcomeLight'

type Theme = 'light' | 'dark' | 'gray'

const nextTheme: Record<Theme, Theme> = { light: 'dark', dark: 'gray', gray: 'light' }
const themeLabel: Record<Theme, string> = { light: '切换深色', dark: '切换灰色', gray: '切换浅色' }
const routeByShortcut: Record<string, ChatMode> = { consult: 'Direct', search: 'Agentic', review: 'Agentic', contract: 'Workflow' }
const shortcutLabel: Record<string, string> = { consult: '法律咨询', search: '法律检索', review: '文件审查', contract: '合同起草' }

function responseFor(text: string, mode: ChatMode, project: Project): Pick<ChatMessage, 'text' | 'sources'> {
  if (mode === 'Direct') {
    return { text: `收到。我会围绕「${text}」继续对话，只基于你提供的信息组织回答，不会把项目文件或外部资料当作已核验事实。你可以继续补充事实、目标或希望的输出格式。` }
  }
  if (mode === 'Workflow') {
    return {
      text: `已为「${project.name}」建立 Workflow 任务：先读取项目案卷，再按绑定的合同审查 SOP 进行条款识别、风险分级和建议汇总。当前等待你确认输入范围，确认后会逐节点记录运行状态。`,
      sources: [
        { kind: '项目案卷', title: '项目案卷 / 已上传材料', detail: '当前项目上下文 · 3 个文件' },
        { kind: 'KnowledgeBase', title: '合同审查工作流', detail: '治理资源 · SOP r11' },
      ],
    }
  }
  return {
    text: `我会先把「${text}」拆成检索问题，再分别检查项目案卷与平台法律资料。初步建议会标注证据覆盖范围；如果需要外部信息，我会在调用 Connector 前单独提示并保留来源。`,
    sources: [
      { kind: '项目案卷', title: '项目案卷 / 已上传材料', detail: '项目私有证据 · 命中 2 条' },
      { kind: '全局 RAG', title: '民商法法规库', detail: '平台法律资料 · 命中 4 条' },
      { kind: 'Connector', title: '北大法宝 MCP', detail: '治理连接器 · 尚未调用' },
    ],
  }
}

export default function App() {
  const [theme, setTheme] = useState<Theme>('light')
  const [activeNav, setActiveNav] = useState<ViewId>('new')
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [messagesByProject, setMessagesByProject] = useState<Record<string, ChatMessage[]>>({})
  const [generatingProjectId, setGeneratingProjectId] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const activeProject = projects.find(project => project.id === activeProjectId) ?? null
  const activeMessages = activeProjectId ? (messagesByProject[activeProjectId] ?? []) : []

  function stopGeneration() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
    setGeneratingProjectId(null)
    if (activeProjectId) {
      setProjects(current => current.map(project => project.id === activeProjectId ? { ...project, status: { kind: 'warn', label: '已暂停' } } : project))
    }
  }

  function queueAssistant(projectId: string, text: string, mode: ChatMode, projectOverride?: Project) {
    setGeneratingProjectId(projectId)
    setProjects(current => current.map(project => project.id === projectId ? { ...project, status: { kind: 'run', label: '生成中' } } : project))
    timerRef.current = window.setTimeout(() => {
      const project = projectOverride ?? projects.find(item => item.id === projectId)
      if (!project) return
      const answer = responseFor(text, mode, project)
      setMessagesByProject(current => ({ ...current, [projectId]: [...(current[projectId] ?? []), { id: `assistant-${Date.now()}`, role: 'assistant', mode, time: new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date()), ...answer }] }))
      setProjects(current => current.map(item => item.id === projectId ? { ...item, sessions: Math.max(item.sessions, 1), updated: '刚刚', status: { kind: 'ok', label: '已完成' } } : item))
      setGeneratingProjectId(null)
      timerRef.current = null
    }, 850)
  }

  function openProject(project: Project) {
    setActiveProjectId(project.id)
    setActiveNav('conversation')
    setMessagesByProject(current => current[project.id] ? current : { ...current, [project.id]: [createInitialAssistantMessage(project)] })
  }

  function startConversation(input: string, shortcutId?: string) {
    const label = shortcutId ? shortcutLabel[shortcutId] : undefined
    const text = input.trim() || (label ? `请帮我进行${label}` : '')
    if (!text) return
    const projectId = `project-${Date.now()}`
    const project: Project = {
      id: projectId,
      name: text.length > 24 ? `${text.slice(0, 24)}…` : text,
      desc: label ? `${label}任务 · 首条问题已带入项目会话` : '由新建对话创建的法律项目，等待继续补充上下文。',
      sessions: 1,
      updated: '刚刚',
      status: { kind: 'run', label: '生成中' },
    }
    const mode = (shortcutId && routeByShortcut[shortcutId]) || 'Direct'
    setProjects(current => [project, ...current])
    setMessagesByProject(current => ({ ...current, [projectId]: [createUserMessage(text, mode)] }))
    setActiveProjectId(projectId)
    setActiveNav('conversation')
    queueAssistant(projectId, text, mode, project)
  }

  function sendMessage(text: string, mode: ChatMode) {
    if (!activeProjectId || generatingProjectId === activeProjectId) return
    setMessagesByProject(current => ({ ...current, [activeProjectId]: [...(current[activeProjectId] ?? []), createUserMessage(text, mode)] }))
    queueAssistant(activeProjectId, text, mode)
  }

  function newProject() {
    setActiveProjectId(null)
    setActiveNav('new')
  }

  function newConversation() {
    if (!activeProjectId) {
      newProject()
      return
    }
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
    setGeneratingProjectId(null)
    setMessagesByProject(current => ({ ...current, [activeProjectId]: [] }))
    setActiveNav('conversation')
  }

  function renderTheme() {
    const shared = { activeNav, onActiveNavChange: setActiveNav, onStartConversation: startConversation, projects, onOpenProject: openProject, onNewProject: newProject }
    if (theme === 'dark') return <AppDark {...shared} />
    if (theme === 'gray') return <WelcomeGray {...shared} />
    return <WelcomeLight {...shared} />
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {activeNav === 'conversation' && activeProject ? (
        <div className={`conversation-theme ${theme}`}>
          <ConversationView project={activeProject} messages={activeMessages} isGenerating={generatingProjectId === activeProject.id} initialMode={activeMessages.find(message => message.mode)?.mode} onSendMessage={sendMessage} onStopGeneration={stopGeneration} onBack={() => setActiveNav('projects')} onNewConversation={newConversation} />
        </div>
      ) : renderTheme()}
      <button className={`theme-toggle ${theme}`} onClick={() => setTheme(value => nextTheme[value])} aria-label={themeLabel[theme]} title={themeLabel[theme]}>
        {theme === 'light' ? <Moon size={15} strokeWidth={2} /> : theme === 'dark' ? <Layers size={15} strokeWidth={2} /> : <Sun size={15} strokeWidth={2} />}
      </button>
    </div>
  )
}
