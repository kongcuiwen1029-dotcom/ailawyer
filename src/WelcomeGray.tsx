import { useState } from 'react'
import WorkspaceView, { type Project } from './WorkspaceView'
import NomosMark from './NomosMark'
import { navSections, type ViewId } from './nav'
import {
  User,
  Settings,
  Database,
  ArrowUp,
  Scale,
  Search,
  FileSearch,
  Paperclip,
  Globe,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react'

/* Gray theme uses conversational labels to match the reference */
const grayLabels: Partial<Record<ViewId, string>> = {
  new: '新建对话',
  projects: '我的项目',
}

const quickActions = [
  { id: 'consult',  icon: Scale,      label: '法律咨询', color: '#4f7bff' },
  { id: 'search',   icon: Search,     label: '法律检索', color: '#f59042' },
  { id: 'review',   icon: FileSearch, label: '文件审查', color: '#22a06b' },
  { id: 'contract', icon: Globe,      label: '合同起草', color: '#8b6cf0' },
]

type WelcomeGrayProps = {
  activeNav: ViewId
  onActiveNavChange: (view: ViewId) => void
  onStartConversation: (text: string, shortcutId?: string) => void
  projects: Project[]
  onOpenProject: (project: Project) => void
  onNewProject: () => void
}

export default function WelcomeGray({ activeNav, onActiveNavChange, onStartConversation, projects, onOpenProject, onNewProject }: WelcomeGrayProps) {
  const [query, setQuery]         = useState('')
  const [tags, setTags]           = useState<string[]>([])
  const [collapsed, setCollapsed] = useState(false)

  function toggleTag(id: string) {
    setTags(t => (t.includes(id) ? [] : [id]))
  }

  const hour = new Date().getHours()
  const greeting =
    hour < 5  ? '夜深了' :
    hour < 12 ? '早上好' :
    hour < 18 ? '下午好' : '晚上好'

  function handleSend() {
    if (query.trim() || tags.length) onStartConversation(query, tags[0])
    setQuery('')
    setTags([])
  }

  return (
    <div className="gy-root">
      <div className="gy-page">
        <div className={`gy-layout${collapsed ? ' collapsed' : ''}`}>

          {/* ── Sidebar ── */}
          <aside className="gy-sidebar">

            {/* Brand */}
            <div className={`gy-brand${collapsed ? ' is-collapsed' : ''}`} style={collapsed ? { justifyContent: 'center' } : undefined}>
              <NomosMark size={34} />
              {!collapsed && <span className="gy-brand-name">Nomos</span>}
            </div>

            <div className="nav-scroll">
              {navSections.map((section, i) => (
                <div key={section.title}>
                  {i > 0 && <div className="gy-divider" />}
                  {!collapsed && <div className="gy-section-label">{section.title}</div>}
                  <div className="gy-nav-group">
                    {section.items.map(({ id, icon: Icon, label }) => (
                      <button
                        key={id}
                        className={`gy-nav-item${collapsed ? ' collapsed' : ''}${activeNav === id ? ' active' : ''}`}
                        onClick={() => onActiveNavChange(id)}
                        title={collapsed ? (grayLabels[id] ?? label) : undefined}
                      >
                        <Icon size={16} strokeWidth={1.7} />
                        <span>{grayLabels[id] ?? label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className={`gy-sidebar-footer${collapsed ? ' is-collapsed' : ''}`}>
              <div className="gy-user-row">
                <div className="gy-avatar">
                  <User size={14} strokeWidth={1.6} color="#6a6a78" />
                </div>
                {!collapsed && <span className="gy-user-name">我的账户</span>}
              </div>
              <button
                className="gy-icon-btn"
                onClick={() => setCollapsed(c => !c)}
                aria-label={collapsed ? '展开菜单' : '收起菜单'}
                title={collapsed ? '展开菜单' : '收起菜单'}
              >
                {collapsed ? <PanelLeftOpen size={15} strokeWidth={1.6} /> : <PanelLeftClose size={15} strokeWidth={1.6} />}
              </button>
              {!collapsed && (
                <button className="gy-icon-btn" aria-label="设置">
                  <Settings size={15} strokeWidth={1.6} />
                </button>
              )}
            </div>
          </aside>

          {/* ── Main ── */}
          <main className={`gy-main${activeNav !== 'new' ? ' has-view' : ''}`}>

            {activeNav === 'new' ? (
              <div className="gy-hero">

                <NomosMark size={54} />

                <h1 className="gy-hero-title">
                  {greeting}，我是&nbsp;<span className="accent">Nomos</span>
                </h1>
                <p className="gy-hero-sub">您的 AI 法律助手，随时为您提供专业支持</p>

                {/* Composer */}
                <div className="gy-composer-wrap">
                  <div className="gy-composer-body">
                    {tags.length > 0 && (
                      <div className="gy-tags">
                        {tags.map(id => {
                          const a = quickActions.find(q => q.id === id)!
                          const Icon = a.icon
                          return (
                            <span
                              key={id}
                              className="gy-tag"
                              style={{ background: `${a.color}1f`, color: a.color }}
                            >
                              <Icon size={13} strokeWidth={2} />
                              <span>{a.label}</span>
                              <button
                                className="gy-tag-x"
                                aria-label={`移除${a.label}`}
                                onClick={() => toggleTag(id)}
                              >
                                <X size={12} strokeWidth={2.4} />
                              </button>
                            </span>
                          )
                        })}
                      </div>
                    )}
                    <textarea
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="帮您处理什么？"
                      className="gy-composer-input"
                    />
                  </div>

                  <div className="gy-composer-toolbar">
                    <div className="gy-composer-left">
                      <button className="gy-chip" title="附件">
                        <Paperclip size={13} strokeWidth={1.8} />
                        <span>上传文件</span>
                      </button>
                      <button className="gy-chip" title="知识库">
                        <Database size={13} strokeWidth={1.8} />
                        <span>知识库</span>
                      </button>
                    </div>
                    <button
                      className="gy-send-button"
                      aria-label="发送"
                      onClick={handleSend}
                    >
                      <ArrowUp size={16} strokeWidth={2.4} color="#ffffff" />
                    </button>
                  </div>
                </div>

                {/* Quick action pills */}
                <div className="gy-quick-row">
                  {quickActions.map(({ id, icon: Icon, label, color }) => (
                    <button
                      key={id}
                      className={`gy-quick-pill${tags.includes(id) ? ' active' : ''}`}
                      onClick={() => toggleTag(id)}
                    >
                      <Icon size={15} strokeWidth={1.9} color={color} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <WorkspaceView view={activeNav} projects={projects} onOpenProject={onOpenProject} onNewProject={onNewProject} />
            )}

          </main>

        </div>
      </div>
    </div>
  )
}
