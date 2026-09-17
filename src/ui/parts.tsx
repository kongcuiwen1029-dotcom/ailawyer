import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { viewTitles, type ViewId } from '../nav'
import { useWorkspace } from '../state/workspace'

export type BadgeKind = 'ok' | 'run' | 'draft' | 'warn'

export function Badge({ kind, children }: { kind: BadgeKind; children: ReactNode }) {
  return <span className={`wv-badge ${kind}`}>{children}</span>
}

/* 页头只留标题与操作区。这里原先还渲染一行 14px 的视图说明（来自 viewTitles 的 sub）
   和一行 12.5px 的补充说明（调用点的 meta），2026-09-17 按用户要求全部去掉——菜单页
   标题下面不再挂任何辅助文案。这两行是 wv-sub / wv-sub-meta 唯一的消费方，相关 CSS
   也一并删了；要加回来得连 index.css 里的规则一起恢复。 */
export function ViewHead({ view, action }: { view: ViewId; action?: ReactNode }) {
  const { title } = viewTitles[view]
  return (
    <div className="wv-head">
      <div>
        <h1 className="wv-h1">{title}</h1>
      </div>
      {action && <div className="wv-toolbar">{action}</div>}
    </div>
  )
}

/* 详情页头部。传了 `crumbs` 的视图（资源市场）用面包屑替掉「返回列表」按钮，
   并把操作区提到标题那一行——两条都是 2026-09-17 对齐真实应用资源详情页时加的。
   `with-crumbs` 只在此时出现，员工与员工组两份详情页的头部因此一行没动，仍是
   原来的纵向堆叠。 */
export function DetailShell({
  title,
  subtitle,
  badges,
  actions,
  crumbs,
  onBack,
  children,
}: {
  title: string
  subtitle?: ReactNode
  badges?: ReactNode
  actions?: ReactNode
  crumbs?: ReactNode
  onBack: () => void
  children: ReactNode
}) {
  return (
    <div className="wv-detail">
      <div className={`wv-detail-head${crumbs ? ' with-crumbs' : ''}`}>
        {crumbs ? (
          <nav className="wv-crumbs" aria-label="面包屑">{crumbs}</nav>
        ) : (
          <button className="wv-btn ghost" onClick={onBack}>
            <ArrowLeft size={14} strokeWidth={2} /> 返回列表
          </button>
        )}
        <div className="wv-detail-title">
          <h2>{title}</h2>
          {badges && <span className="wv-detail-badges">{badges}</span>}
        </div>
        {subtitle && <p className="wv-detail-sub">{subtitle}</p>}
        {actions && <div className="wv-toolbar">{actions}</div>}
      </div>
      <div className="wv-detail-body">{children}</div>
    </div>
  )
}

export function Section({ title, hint, action, children }: { title: string; hint?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="wv-section">
      <div className="wv-section-head">
        <div>
          <h3>{title}</h3>
          {hint && <p className="wv-section-hint">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="wv-field">
      <span className="wv-field-label">{label}</span>
      {children}
      {hint && <span className="wv-field-hint">{hint}</span>}
    </label>
  )
}

export function Modal({
  title,
  desc,
  onClose,
  footer,
  children,
  width,
}: {
  title: string
  desc?: string
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
  width?: number
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="wv-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="wv-modal" style={width ? { maxWidth: width } : undefined} onClick={event => event.stopPropagation()}>
        <div className="wv-modal-head">
          <div>
            <h2>{title}</h2>
            {desc && <p className="wv-modal-desc">{desc}</p>}
          </div>
          <button className="wv-icon-btn" onClick={onClose} aria-label="关闭">
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        <div className="wv-modal-body">{children}</div>
        {footer && <div className="wv-modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

/** 右侧抽屉。骨架与配色整套复用 `.wv-modal`（两套主题的底色、描边、阴影都定义
    在那儿），`.wv-drawer` 只改几何：贴右、限宽、占满高度。 */
export function Drawer({
  title,
  desc,
  onClose,
  children,
}: {
  title: string
  desc?: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="wv-overlay right" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <aside className="wv-modal wv-drawer" onClick={event => event.stopPropagation()}>
        <div className="wv-modal-head">
          <div>
            <h2>{title}</h2>
            {desc && <p className="wv-modal-desc">{desc}</p>}
          </div>
          <button className="wv-icon-btn" onClick={onClose} aria-label="关闭">
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        <div className="wv-drawer-body">{children}</div>
      </aside>
    </div>
  )
}

export function usePaged<T>(items: T[], size = 6) {
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(items.length / size))
  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])
  const pageItems = useMemo(() => items.slice((page - 1) * size, page * size), [items, page, size])
  return { page, setPage, pageCount, pageItems, total: items.length }
}

export function Pager({ page, pageCount, onPage, total, size = 6 }: { page: number; pageCount: number; onPage: (page: number) => void; total: number; size?: number }) {
  if (total === 0) return null
  const from = (page - 1) * size + 1
  const to = Math.min(page * size, total)
  return (
    <div className="wv-pager">
      <span className="wv-pager-count">第 {from}–{to} 条，共 {total} 条</span>
      <div className="wv-pager-controls">
        <button className="wv-btn ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft size={14} strokeWidth={2} /> 上一页
        </button>
        {Array.from({ length: pageCount }, (_, index) => index + 1).map(number => (
          <button key={number} className={`wv-page${number === page ? ' active' : ''}`} onClick={() => onPage(number)}>
            {number}
          </button>
        ))}
        <button className="wv-btn ghost" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
          下一页 <ChevronRight size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}

export function Empty({ text }: { text: string }) {
  return <p className="wv-empty">{text}</p>
}

/** Global toast host — every action reports its result here. */
export function ToastHost() {
  const { notices, dismissNotice } = useWorkspace()
  if (!notices.length) return null
  return (
    <div className="wv-toasts">
      {notices.map(notice => (
        <button key={notice.id} className={`wv-toast ${notice.tone}`} onClick={() => dismissNotice(notice.id)}>
          {notice.text}
        </button>
      ))}
    </div>
  )
}
