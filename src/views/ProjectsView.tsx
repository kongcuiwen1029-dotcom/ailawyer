import { useMemo, useState } from 'react'
import { Briefcase, Clock, LayoutGrid, MessageSquare, Pencil, RotateCcw, Table as TableIcon, Trash2, Undo2 } from 'lucide-react'
import { TENANTS, useWorkspace, type Project } from '../state/workspace'
import { Badge, Empty, Field, Modal, Pager, ViewHead, usePaged } from '../ui/parts'
import ProjectCard from '../ui/ProjectCard'

export default function ProjectsView({ onOpenProject, onNewProject, cardStyle = 'classic' }: {
  onOpenProject: (project: Project) => void
  onNewProject: () => void
  cardStyle?: 'classic' | 'detail'
}) {
  const { projects, renameProject, deleteProject, restoreProject, purgeProject, emptyRecycleBin } = useWorkspace()
  const [mode, setMode] = useState<'card' | 'table'>('card')
  const [tab, setTab] = useState<'active' | 'recycle'>('active')
  const [tenant, setTenant] = useState('全部租户')
  const [query, setQuery] = useState('')
  const [renaming, setRenaming] = useState<Project | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmPurge, setConfirmPurge] = useState<Project | null>(null)

  const scoped = useMemo(() => projects.filter(project => tab === 'recycle' ? Boolean(project.deletedAt) : !project.deletedAt), [projects, tab])

  const visible = useMemo(() => scoped.filter(project => {
    if (tenant !== '全部租户' && project.tenant !== tenant) return false
    if (query.trim() && !`${project.name}${project.desc}`.toLowerCase().includes(query.trim().toLowerCase())) return false
    return true
  }), [scoped, tenant, query])

  const { page, setPage, pageCount, pageItems, total } = usePaged(visible, 6)

  const action = (
    <>
      <div className="wv-seg">
        <button className={mode === 'card' ? 'active' : ''} onClick={() => setMode('card')}>
          <LayoutGrid size={14} strokeWidth={1.9} /> 卡片
        </button>
        <button className={mode === 'table' ? 'active' : ''} onClick={() => setMode('table')}>
          <TableIcon size={14} strokeWidth={1.9} /> 表格
        </button>
      </div>
      <button className="wv-btn primary" onClick={onNewProject}>新建项目</button>
    </>
  )

  return (
    <>
      <ViewHead view="projects" action={action} meta={`当前账号可访问 ${projects.filter(project => !project.deletedAt).length} 个项目，回收站 ${projects.filter(project => project.deletedAt).length} 个`} />

      <div className="wv-filter">
        <div className="wv-tabs inline">
          <button className={`wv-tab${tab === 'active' ? ' active' : ''}`} onClick={() => { setTab('active'); setPage(1) }}>我的项目</button>
          <button className={`wv-tab${tab === 'recycle' ? ' active' : ''}`} onClick={() => { setTab('recycle'); setPage(1) }}>回收站</button>
        </div>
        <input className="wv-input" placeholder="搜索项目名称或说明" value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} />
        <select className="wv-select" value={tenant} onChange={event => { setTenant(event.target.value); setPage(1) }}>
          <option>全部租户</option>
          {TENANTS.map(name => <option key={name}>{name}</option>)}
        </select>
        {tab === 'recycle' && (
          <button className="wv-btn danger" disabled={!scoped.length} onClick={emptyRecycleBin}>
            <Trash2 size={13} strokeWidth={1.9} /> 清空回收站
          </button>
        )}
      </div>

      {!pageItems.length && <Empty text={tab === 'recycle' ? '回收站为空。删除的项目会在这里保留 30 天。' : '没有符合筛选条件的项目。'} />}

      {tab === 'active' && mode === 'card' && (
        <div className="wv-grid">
          {pageItems.map(project => cardStyle === 'detail' ? (
            <ProjectCard
              key={project.id}
              project={project}
              onOpen={() => onOpenProject(project)}
              onRename={() => { setRenaming(project); setRenameValue(project.name) }}
              onDelete={() => deleteProject(project.id)}
            />
          ) : (
            <article className="wv-card" key={project.id} onClick={() => onOpenProject(project)} role="button" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter') onOpenProject(project) }}>
              <div className="wv-card-top">
                <div className="wv-ico"><Briefcase size={18} strokeWidth={1.8} /></div>
                <Badge kind={project.status.kind}>{project.status.label}</Badge>
              </div>
              <h3 className="wv-card-title">{project.name}</h3>
              <p className="wv-card-desc">{project.desc}</p>
              <div className="wv-card-meta">
                <span><MessageSquare size={13} strokeWidth={1.8} /> {project.sessions} 会话</span>
                <span><Clock size={13} strokeWidth={1.8} /> {project.updated}</span>
                <span className="wv-card-tenant">{project.tenant}</span>
              </div>
              <div className="wv-card-actions">
                <button className="wv-btn ghost" onClick={event => { event.stopPropagation(); setRenaming(project); setRenameValue(project.name) }}>
                  <Pencil size={12} strokeWidth={1.9} /> 重命名
                </button>
                <button className="wv-btn ghost danger" onClick={event => { event.stopPropagation(); deleteProject(project.id) }}>
                  <Trash2 size={12} strokeWidth={1.9} /> 删除
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {tab === 'active' && mode === 'table' && (
        <table className="wv-table">
          <thead>
            <tr><th>项目名称</th><th>租户</th><th>会话</th><th>更新时间</th><th>状态</th><th>操作</th></tr>
          </thead>
          <tbody>
            {pageItems.map(project => (
              <tr key={project.id} onClick={() => onOpenProject(project)} className="wv-click-row">
                <td style={{ fontWeight: 600 }}>{project.name}</td>
                <td>{project.tenant}</td>
                <td>{project.sessions}</td>
                <td>{project.updated}</td>
                <td><Badge kind={project.status.kind}>{project.status.label}</Badge></td>
                <td>
                  <div className="wv-row-actions">
                    <button className="wv-btn ghost" onClick={event => { event.stopPropagation(); setRenaming(project); setRenameValue(project.name) }}>重命名</button>
                    <button className="wv-btn ghost danger" onClick={event => { event.stopPropagation(); deleteProject(project.id) }}>删除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'recycle' && (
        <table className="wv-table">
          <thead>
            <tr><th>项目名称</th><th>租户</th><th>删除时间</th><th>保留</th><th>操作</th></tr>
          </thead>
          <tbody>
            {pageItems.map(project => (
              <tr key={project.id}>
                <td style={{ fontWeight: 600 }}>{project.name}</td>
                <td>{project.tenant}</td>
                <td>{project.deletedAt}</td>
                <td>30 天后自动清理</td>
                <td>
                  <div className="wv-row-actions">
                    <button className="wv-btn ghost" onClick={() => restoreProject(project.id)}><Undo2 size={12} strokeWidth={1.9} /> 恢复</button>
                    <button className="wv-btn ghost danger" onClick={() => setConfirmPurge(project)}><Trash2 size={12} strokeWidth={1.9} /> 彻底删除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Pager page={page} pageCount={pageCount} onPage={setPage} total={total} />

      {renaming && (
        <Modal
          title="重命名项目"
          desc="项目名称会同步到会话列表与案卷视图。"
          onClose={() => setRenaming(null)}
          footer={
            <>
              <button className="wv-btn" onClick={() => setRenaming(null)}>取消</button>
              <button
                className="wv-btn primary"
                disabled={!renameValue.trim()}
                onClick={() => { renameProject(renaming.id, renameValue.trim()); setRenaming(null) }}
              >
                保存
              </button>
            </>
          }
        >
          <Field label="项目名称">
            <input className="wv-input" value={renameValue} onChange={event => setRenameValue(event.target.value)} />
          </Field>
        </Modal>
      )}

      {confirmPurge && (
        <Modal
          title="彻底删除项目"
          desc="该操作不可撤销，关联的会话、运行记录与项目案卷会一并清理。"
          onClose={() => setConfirmPurge(null)}
          footer={
            <>
              <button className="wv-btn" onClick={() => setConfirmPurge(null)}>取消</button>
              <button className="wv-btn danger" onClick={() => { purgeProject(confirmPurge.id); setConfirmPurge(null) }}>
                <RotateCcw size={13} strokeWidth={1.9} /> 确认彻底删除
              </button>
            </>
          }
        >
          <p className="wv-note">即将删除：{confirmPurge.name}</p>
        </Modal>
      )}
    </>
  )
}
