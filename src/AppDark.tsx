import { useState } from 'react'
import NomosMark from './NomosMark'
import WorkspaceView, { type Project } from './WorkspaceView'
import { navSections, type ViewId } from './nav'
import {
  User,
  PanelLeftClose,
  PanelLeftOpen,
  Database,
  ArrowUp,
  Scale,
  Search,
  FileSearch,
  FileSignature,
} from 'lucide-react'

const quickActions = [
  { id: 'consult',  icon: Scale,         label: '法律咨询' },
  { id: 'search',   icon: Search,        label: '法律检索' },
  { id: 'review',   icon: FileSearch,    label: '文件审查' },
  { id: 'contract', icon: FileSignature, label: '合同起草' },
]

type AppDarkProps = {
  activeNav: ViewId
  onActiveNavChange: (view: ViewId) => void
  onStartConversation: (text: string, shortcutId?: string) => void
  projects: Project[]
  onOpenProject: (project: Project) => void
  onNewProject: () => void
}

export default function AppDark({ activeNav, onActiveNavChange, onStartConversation, projects, onOpenProject, onNewProject }: AppDarkProps) {
  const [query, setQuery] = useState('')
  const [selectedShortcut, setSelectedShortcut] = useState<string | undefined>()
  const [collapsed, setCollapsed] = useState(false)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好'

  return (
    <div className="dk-root">
      <div className="dk-page">
        <div className={`dk-layout${collapsed ? ' collapsed' : ''}`}>

          {/* Sidebar */}
          <aside className="dk-glass dk-sidebar">
            <div className={`brand-row${collapsed ? ' is-collapsed' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '2px 2px 22px' }}>
              <NomosMark size={34} />
              {!collapsed && (
                <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.94)' }}>
                  Nomos
                </div>
              )}
            </div>

            <div className="nav-scroll">
              {navSections.map(section => (
                <div key={section.title}>
                  {!collapsed && (
                    <div style={{ margin: '4px 2px 10px', fontSize: 11, color: 'rgba(255,255,255,0.46)', fontWeight: 600 }}>
                      {section.title}
                    </div>
                  )}
                  <div style={{ display: 'grid', gap: 7, marginBottom: collapsed ? 10 : 18 }}>
                    {section.items.map(({ id, icon: Icon, label }) => (
                      <button
                        key={id}
                        className={`dk-nav-item${collapsed ? ' collapsed' : ''}${activeNav === id ? ' active' : ''}`}
                        onClick={() => onActiveNavChange(id)}
                        title={collapsed ? label : undefined}
                      >
                        <Icon size={17} strokeWidth={1.7} />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className={`sidebar-footer${collapsed ? ' is-collapsed' : ''}`} style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 6px 4px', color: 'rgba(255,255,255,0.72)' }}>
              <User size={20} strokeWidth={1.6} />
              <button className="collapse-btn" onClick={() => setCollapsed(c => !c)} aria-label={collapsed ? '展开菜单' : '收起菜单'} title={collapsed ? '展开菜单' : '收起菜单'}>
                {collapsed ? <PanelLeftOpen size={20} strokeWidth={1.6} /> : <PanelLeftClose size={20} strokeWidth={1.6} />}
              </button>
            </div>
          </aside>

          {/* Main */}
          <main className={`dk-main${activeNav !== 'new' ? ' has-view' : ''}`}>
            {activeNav === 'new' ? (
              <section className="dk-glass dk-hero-panel">
                <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
                  <NomosMark size={56} />
                </div>

                <h1 className="dk-hero-title" style={{ position: 'relative', zIndex: 1 }}>
                  {greeting}，我是 <span className="accent">Nomos</span>
                </h1>

                <div style={{ display: 'grid', gap: 22, justifyItems: 'center', position: 'relative', zIndex: 1 }}>
                  <div className="dk-composer">
                    {query ? (
                      <div style={{ fontSize: 16, lineHeight: 1.6, color: 'rgba(255,255,255,0.88)', position: 'relative', zIndex: 1 }}>
                        {query}
                      </div>
                    ) : (
                      <div className="dk-composer-placeholder">帮您处理什么?</div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, position: 'relative', zIndex: 1 }}>
                      <div className="dk-chip">
                        <Database size={14} strokeWidth={1.8} />
                        <span>知识库</span>
                      </div>
                      <button
                        className="dk-send-button"
                        aria-label="发送"
                        onClick={() => { if (query.trim()) onStartConversation(query, selectedShortcut); setQuery(''); setSelectedShortcut(undefined) }}
                      >
                        <ArrowUp size={18} strokeWidth={2.2} color="#111" />
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {quickActions.map(({ id, icon: Icon, label }) => (
                      <button
                        key={id}
                        className="dk-quick-pill"
                        onClick={() => { setQuery(label); setSelectedShortcut(id) }}
                      >
                        <Icon size={15} strokeWidth={1.8} />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            ) : (
              <WorkspaceView view={activeNav} projects={projects} onOpenProject={onOpenProject} onNewProject={onNewProject} />
            )}

          </main>

        </div>
      </div>
    </div>
  )
}
