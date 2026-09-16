import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { FolderOpen, MessageSquare, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { Project } from '../state/workspace'

/* 卡片只承载服务端 `Project` 真正有的字段：名称、案件类型、摘要、最近编辑时间，
   加上原型自身的会话数。菜单与真实应用一致（打开 / 重命名 / 删除），
   删除走回收站而不是物理删除。 */
export default function ProjectCard({
  project,
  onOpen,
  onRename,
  onDelete,
}: {
  project: Project
  onOpen: () => void
  onRename: () => void
  onDelete: () => void
}) {
  const [menu, setMenu] = useState(false)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!menu) return
    function onPointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setMenu(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenu(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menu])

  function pick(action: () => void) {
    return (event: ReactMouseEvent) => {
      event.stopPropagation()
      setMenu(false)
      action()
    }
  }

  return (
    <article
      ref={ref}
      className="wv-card wv-pcard"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={event => { if (event.key === 'Enter') onOpen() }}
    >
      <div className="wv-card-top">
        <span className={`wv-badge ${project.status.kind}`}>{project.status.label}</span>
        <span className="wv-pcard-menu-wrap">
          <button
            className={`wv-pcard-more${menu ? ' open' : ''}`}
            aria-label="更多操作"
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={event => { event.stopPropagation(); setMenu(value => !value) }}
          >
            <MoreHorizontal size={16} strokeWidth={2} />
          </button>
          {menu && (
            <div className="wv-menu" role="menu" onClick={event => event.stopPropagation()}>
              <button role="menuitem" onClick={pick(onOpen)}><FolderOpen size={13} strokeWidth={1.9} /> 打开</button>
              <button role="menuitem" onClick={pick(onRename)}><Pencil size={13} strokeWidth={1.9} /> 重命名</button>
              <div className="wv-menu-sep" />
              <button role="menuitem" className="danger" onClick={pick(onDelete)}><Trash2 size={13} strokeWidth={1.9} /> 删除</button>
            </div>
          )}
        </span>
      </div>

      <h3 className="wv-card-title">{project.name}</h3>
      {project.caseType && (
        <div className="wv-pcard-subline">
          <span className="wv-pcard-case-type">{project.caseType}</span>
        </div>
      )}
      <p className="wv-pcard-desc">{project.desc || '暂无摘要'}</p>

      <div className="wv-pcard-foot">
        <span className="wv-pcard-edited">最近编辑 {project.updated}</span>
        <span className="wv-pcard-sessions"><MessageSquare size={12} strokeWidth={1.8} /> {project.sessions} 会话</span>
      </div>
    </article>
  )
}
