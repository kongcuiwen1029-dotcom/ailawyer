import { useState } from 'react'
import NomosMark from './NomosMark'
import WorkspaceView, { type Project } from './WorkspaceView'
import { navSections, type ViewId } from './nav'
import { useEnterToSend } from './ui/useEnterToSend'
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
  X,
} from 'lucide-react'

/* 深色版与灰色版共用的首页。2026-09-17 用户要求「把深色版和浅色版的所有组件/文字
   对齐」，方向是**以深色版为准**，所以这里的标记、图标、字号与内联样式全部来自原来的
   `AppDark.tsx`，逐字照搬，只把类名前缀 `dk-` 换成按主题取的 `${p}-`。

   两套主题过去各有一个组件（`AppDark.tsx` / `WelcomeGray.tsx`），灰色那版是另一套结构：
   侧边栏页脚是「头像 + 我的账户 + 齿轮」、导航用 `新建对话`/`我的项目`、section 之间有
   分隔线、hero 没有面板、composer 拆成 wrap/body/toolbar 三段。合并成一个组件之后，
   这类漂移不可能再出现——两边渲染的是同一棵 DOM。

   只允许配色不同，全部走 CSS，不留在标记里：
   - 品牌名、页脚、箭头 —— 由 `.dk-*` / `.gy-*` 两条规则分别给。
   - 四个快捷入口的图标色、以及点选后落进 composer 的 tag 色 —— 两版共用同一组色值，
     靠 `data-action` 选择器上色（`2026-09-17` 用户要求两版同步；灰色要留紫色强调色，
     见 memory: nomos-gray-keep-purple）。填充与描边的透明档位按各自底色定，色相不变。

   改这里之前先确认：任何新增的差异都应该能用「一条配色规则」表达。如果某个差异需要
   不同的 DOM，它就不属于这个文件——它会重新把两个主题拆开。 */

const quickActions = [
  { id: 'consult',  icon: Scale,         label: '法律咨询' },
  { id: 'search',   icon: Search,        label: '法律检索' },
  { id: 'review',   icon: FileSearch,    label: '文件审查' },
  { id: 'contract', icon: FileSignature, label: '合同起草' },
]

type WelcomeProps = {
  theme: 'dark' | 'gray'
  activeNav: ViewId
  onActiveNavChange: (view: ViewId) => void
  onStartConversation: (text: string, shortcutId?: string) => void
  projects: Project[]
  onOpenProject: (project: Project) => void
}

export default function Welcome({ theme, activeNav, onActiveNavChange, onStartConversation, projects, onOpenProject }: WelcomeProps) {
  const [query, setQuery] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [knowledgeBase, setKnowledgeBase] = useState(true)
  const [collapsed, setCollapsed] = useState(false)

  const p = theme === 'dark' ? 'dk' : 'gy'

  /* Single-select, like the gray theme: the four shortcuts are entry points,
     not a stack, so picking one replaces the previous pick rather than adding
     to it. */
  function toggleTag(id: string) {
    setTags(t => (t.includes(id) ? [] : [id]))
  }

  function handleSend() {
    if (query.trim() || tags.length) onStartConversation(query, tags[0])
    setQuery('')
    setTags([])
  }

  const enterToSend = useEnterToSend(handleSend)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好'

  return (
    <div className={`${p}-root`}>
      <div className={`${p}-page`}>
        <div className={`${p}-layout${collapsed ? ' collapsed' : ''}`}>

          {/* Sidebar */}
          <aside className={`${p}-glass ${p}-sidebar`}>
            <div className={`brand-row${collapsed ? ' is-collapsed' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '2px 2px 22px' }}>
              <NomosMark size={34} />
              {!collapsed && (
                <div className={`${p}-brand-name`} style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>
                  Nomos
                </div>
              )}
            </div>

            <div className="nav-scroll">
              {navSections.map(section => (
                <div key={section.title}>
                  {!collapsed && (
                    <div className={`${p}-section-label`} style={{ margin: '4px 2px 10px', fontSize: 11, fontWeight: 600 }}>
                      {section.title}
                    </div>
                  )}
                  <div style={{ display: 'grid', gap: 7, marginBottom: collapsed ? 10 : 18 }}>
                    {section.items.map(({ id, icon: Icon, label }) => (
                      <button
                        key={id}
                        className={`${p}-nav-item${collapsed ? ' collapsed' : ''}${activeNav === id ? ' active' : ''}`}
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
            <div className={`sidebar-footer${collapsed ? ' is-collapsed' : ''}`} style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 6px 4px' }}>
              <User size={20} strokeWidth={1.6} />
              <button className="collapse-btn" onClick={() => setCollapsed(c => !c)} aria-label={collapsed ? '展开菜单' : '收起菜单'} title={collapsed ? '展开菜单' : '收起菜单'}>
                {collapsed ? <PanelLeftOpen size={20} strokeWidth={1.6} /> : <PanelLeftClose size={20} strokeWidth={1.6} />}
              </button>
            </div>
          </aside>

          {/* Main */}
          <main className={`${p}-main${activeNav !== 'new' ? ' has-view' : ''}`}>
            {activeNav === 'new' ? (
              <section className={`${p}-hero-panel`}>
                <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
                  <NomosMark size={56} />
                </div>

                <h1 className={`${p}-hero-title`} style={{ position: 'relative', zIndex: 1 }}>
                  {greeting}，我是 <span className="accent">Nomos</span>
                </h1>

                <div style={{ display: 'grid', gap: 22, justifyItems: 'center', position: 'relative', zIndex: 1 }}>
                  <div className={`${p}-composer`}>
                    <div className={`${p}-composer-body`}>
                      {tags.length > 0 && (
                        <div className={`${p}-tags`}>
                          {tags.map(id => {
                            const a = quickActions.find(q => q.id === id)!
                            const Icon = a.icon
                            return (
                              <span key={id} className={`${p}-tag`} data-action={id}>
                                <Icon size={13} strokeWidth={2} />
                                <span>{a.label}</span>
                                <button className={`${p}-tag-x`} aria-label={`移除${a.label}`} onClick={() => toggleTag(id)}>
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
                        className={`${p}-composer-input`}
                        {...enterToSend}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, position: 'relative', zIndex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          className={`${p}-chip${knowledgeBase ? ' active' : ''}`}
                          aria-pressed={knowledgeBase}
                          onClick={() => setKnowledgeBase(value => !value)}
                          title={knowledgeBase ? '已开启知识库检索，点击切换为不走知识库' : '已关闭知识库检索，点击切换为走知识库'}
                        >
                          <Database size={14} strokeWidth={1.8} />
                          <span>知识库</span>
                        </button>
                      </div>
                      <button className={`${p}-send-button`} aria-label="发送" onClick={handleSend}>
                        <ArrowUp size={18} strokeWidth={2.2} />
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {quickActions.map(({ id, icon: Icon, label }) => (
                      <button
                        key={id}
                        className={`${p}-quick-pill${tags.includes(id) ? ' active' : ''}`}
                        onClick={() => toggleTag(id)}
                        aria-pressed={tags.includes(id)}
                        data-action={id}
                      >
                        <Icon size={15} strokeWidth={1.8} />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            ) : (
              <WorkspaceView cardStyle="detail" view={activeNav} onOpenProject={onOpenProject} onNavigate={onActiveNavChange} />
            )}

          </main>

        </div>
      </div>
    </div>
  )
}
