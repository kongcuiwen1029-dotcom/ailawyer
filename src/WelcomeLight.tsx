import { useState } from 'react'
import NomosMark from './NomosMark'
import WorkspaceView, { type Project } from './WorkspaceView'
import { navSections, type ViewId } from './nav'
import {
  User,
  PanelLeftClose,
  PanelLeftOpen,
  Database,
  Paperclip,
  ArrowUp,
  Scale,
  Search,
  FileSearch,
  Globe,
  Building2,
  X,
} from 'lucide-react'
import { TENANTS } from './state/workspace'

/* Purple theme uses the same conversational labels as the gray theme */
const purpleLabels: Partial<Record<ViewId, string>> = {
  new: '新建',
  projects: '项目',
}

const quickActions = [
  { id: 'consult',  icon: Scale,      label: '法律咨询', color: '#6d5cf0' },
  { id: 'search',   icon: Search,     label: '法律检索', color: '#4f7bff' },
  { id: 'review',   icon: FileSearch, label: '文件审查', color: '#22a06b' },
  { id: 'contract', icon: Globe,      label: '合同起草', color: '#c05fb0' },
]

type WelcomeLightProps = {
  activeNav: ViewId
  onActiveNavChange: (view: ViewId) => void
  onStartConversation: (text: string, shortcutId?: string) => void
  projects: Project[]
  onOpenProject: (project: Project) => void
  onNewProject: () => void
  tenant: string
  onTenantChange: (tenant: string) => void
}

export default function WelcomeLight({ activeNav, onActiveNavChange, onStartConversation, projects, onOpenProject, onNewProject, tenant, onTenantChange }: WelcomeLightProps) {
  const [query, setQuery] = useState('')
  const [tags, setTags] = useState<string[]>([])
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
    <div className="al-page">
      <div className={`al-layout${collapsed ? ' collapsed' : ''}`}>

        {/* Sidebar */}
        <aside className="al-glass al-sidebar">
          <div className={`brand-row${collapsed ? ' is-collapsed' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '2px 2px 22px' }}>
            <NomosMark size={38} />
            {!collapsed && <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: '#29233d' }}>Nomos</div>}
          </div>

          <div className="nav-scroll">
            {navSections.map(section => (
              <div key={section.title}>
                {!collapsed && <div className="al-section-label">{section.title}</div>}
                <div style={{ display: 'grid', gap: 7, marginBottom: collapsed ? 10 : 18 }}>
                  {section.items.map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      className={`al-nav-item${collapsed ? ' collapsed' : ''}${activeNav === id ? ' active' : ''}`}
                      onClick={() => onActiveNavChange(id)}
                      title={collapsed ? (purpleLabels[id] ?? label) : undefined}
                    >
                      <Icon size={18} strokeWidth={1.7} />
                      <span>{purpleLabels[id] ?? label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className={`sidebar-footer${collapsed ? ' is-collapsed' : ''}`} style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 6px 4px', color: 'var(--muted)' }}>
            <User size={20} strokeWidth={1.6} />
            <button className="collapse-btn" onClick={() => setCollapsed(c => !c)} aria-label={collapsed ? '展开菜单' : '收起菜单'} title={collapsed ? '展开菜单' : '收起菜单'}>
              {collapsed ? <PanelLeftOpen size={20} strokeWidth={1.6} /> : <PanelLeftClose size={20} strokeWidth={1.6} />}
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className={`al-main${activeNav !== 'new' ? ' has-view' : ''}`}>
          {activeNav === 'new' ? (
            <section className="al-hero-panel">
              <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'center' }}>
                <NomosMark size={54} />
              </div>

              <h1 className="al-hero-title">
                {greeting}，我是 <span className="accent">Nomos</span>
              </h1>

              <div style={{ display: 'grid', gap: 22, justifyItems: 'center' }}>
                <div className="al-composer">
                  <div className="al-composer-body">
                    {tags.length > 0 && (
                      <div className="al-tags">
                        {tags.map(id => {
                          const a = quickActions.find(q => q.id === id)!
                          const Icon = a.icon
                          return (
                            <span
                              key={id}
                              className="al-tag"
                              style={{ background: `${a.color}1f`, color: a.color }}
                            >
                              <Icon size={13} strokeWidth={2} />
                              <span>{a.label}</span>
                              <button
                                className="al-tag-x"
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
                      placeholder="帮您处理什么?"
                      className="al-composer-input"
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <label className="al-chip as-select" title="当前租户">
                        <Building2 size={14} strokeWidth={1.8} />
                        <select value={tenant} onChange={event => onTenantChange(event.target.value)} aria-label="选择租户">
                          {TENANTS.map(name => <option key={name} value={name}>{name}</option>)}
                        </select>
                      </label>
                      <button className="al-chip" title="附件">
                        <Paperclip size={14} strokeWidth={1.8} />
                        <span>上传文件</span>
                      </button>
                      <button className="al-chip" title="知识库">
                        <Database size={14} strokeWidth={1.8} />
                        <span>知识库</span>
                      </button>
                    </div>
                    <button
                      className="al-send-button"
                      aria-label="发送"
                      onClick={handleSend}
                    >
                      <ArrowUp size={18} strokeWidth={2.2} color="#fff" />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {quickActions.map(({ id, icon: Icon, label, color }) => (
                    <button
                      key={id}
                      className={`al-quick-pill${tags.includes(id) ? ' active' : ''}`}
                      onClick={() => toggleTag(id)}
                    >
                      <Icon size={16} strokeWidth={1.8} color={color} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>

                <p className="al-hero-hint">
                  {tenant} · {projects.filter(project => !project.deletedAt && project.tenant === tenant).length} 个项目可用 ·
                  项目对话由启用中的员工组主管统一拆解与调度
                </p>
              </div>
            </section>
          ) : (
            <WorkspaceView view={activeNav} onOpenProject={onOpenProject} onNewProject={onNewProject} onNavigate={onActiveNavChange} />
          )}

        </main>

      </div>
    </div>
  )
}
