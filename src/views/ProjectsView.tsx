import { useMemo, useState } from 'react'
import { Briefcase, Clock, LayoutGrid, MessageSquare, RotateCcw, Search, Table as TableIcon, Trash2 } from 'lucide-react'
import { TENANTS, useWorkspace, type Project } from '../state/workspace'
import { Badge, Empty, Field, Modal, Pager, ViewHead, usePaged } from '../ui/parts'
import ProjectCard from '../ui/ProjectCard'

export default function ProjectsView({ onOpenProject, cardStyle = 'classic' }: {
  onOpenProject: (project: Project) => void
  cardStyle?: 'classic' | 'detail'
}) {
  const { projects, updateProject, deleteProject, restoreProject, purgeProject, emptyRecycleBin, createProject, notify } = useWorkspace()
  const [mode, setMode] = useState<'card' | 'table'>('card')
  const [tab, setTab] = useState<'active' | 'recycle'>('active')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Project | null>(null)
  const [editName, setEditName] = useState('')
  const [editSummary, setEditSummary] = useState('')
  const [confirmPurge, setConfirmPurge] = useState<Project | null>(null)
  const [creating, setCreating] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftSummary, setDraftSummary] = useState('')

  const scoped = useMemo(() => projects.filter(project => tab === 'recycle' ? Boolean(project.deletedAt) : !project.deletedAt), [projects, tab])

  const visible = useMemo(() => scoped.filter(project => {
    if (query.trim() && !`${project.name}${project.desc}`.toLowerCase().includes(query.trim().toLowerCase())) return false
    return true
  }), [scoped, query])

  const { page, setPage, pageCount, pageItems, total } = usePaged(visible, 6)

  /* 新建项目在列表页就地弹窗，和编辑、彻底删除一样，不再跳回首页输入区。
     创建后把列表拉回「我的项目」第一页并清掉搜索词：否则在回收站页签、被搜索过滤
     掉、或停在第二页的时候建完，新项目根本不在眼前。 */
  function openCreate() {
    setDraftName('')
    setDraftSummary('')
    setCreating(true)
  }

  function submitCreate() {
    const name = draftName.trim()
    if (!name) {
      notify('项目名称不能为空。', 'warn')
      return
    }
    createProject(name, draftSummary.trim(), TENANTS[0])
    setCreating(false)
    setTab('active')
    setQuery('')
    setPage(1)
  }

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
      <button className="wv-btn primary" onClick={openCreate}>新建项目</button>
    </>
  )

  return (
    <>
      <ViewHead view="projects" action={action} />

      <div className="wv-filter">
        <div className="wv-tabs inline">
          <button className={`wv-tab${tab === 'active' ? ' active' : ''}`} onClick={() => { setTab('active'); setPage(1) }}>我的项目</button>
          <button className={`wv-tab${tab === 'recycle' ? ' active' : ''}`} onClick={() => { setTab('recycle'); setPage(1) }}>回收站</button>
        </div>
        <div className="wv-search">
          <Search size={14} strokeWidth={1.9} />
          <input className="wv-input" placeholder="搜索项目名称或说明" value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} />
        </div>
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
              onEdit={() => { setEditing(project); setEditName(project.name); setEditSummary(project.desc) }}
              onDelete={() => deleteProject(project.id)}
            />
          ) : (
            <article className="wv-card" key={project.id} onClick={() => onOpenProject(project)} role="button" tabIndex={0} onKeyDown={event => { if (event.key === 'Enter') onOpenProject(project) }}>
              <div className="wv-card-top">
                <div className="wv-ico"><Briefcase size={18} strokeWidth={1.8} /></div>
                <Badge kind={project.status.kind}>{project.status.label}</Badge>
              </div>
              <h3 className="wv-card-title">{project.name}</h3>
              <p className="wv-card-desc">{project.desc || '暂无摘要'}</p>
              <div className="wv-card-meta">
                <span><MessageSquare size={13} strokeWidth={1.8} /> {project.sessions} 会话</span>
                <span><Clock size={13} strokeWidth={1.8} /> {project.updated}</span>
              </div>
              <div className="wv-card-actions">
                <button className="wv-btn ghost" onClick={event => { event.stopPropagation(); setEditing(project); setEditName(project.name); setEditSummary(project.desc) }}>
                  编辑
                </button>
                <button className="wv-btn ghost danger" onClick={event => { event.stopPropagation(); deleteProject(project.id) }}>
                  删除
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {tab === 'active' && mode === 'table' && (
        <table className="wv-table">
          <thead>
            <tr><th>项目名称</th><th>会话</th><th>更新时间</th><th>状态</th><th>操作</th></tr>
          </thead>
          <tbody>
            {pageItems.map(project => (
              <tr key={project.id} onClick={() => onOpenProject(project)} className="wv-click-row">
                <td style={{ fontWeight: 600 }}>{project.name}</td>
                <td>{project.sessions}</td>
                <td>{project.updated}</td>
                <td><Badge kind={project.status.kind}>{project.status.label}</Badge></td>
                <td>
                  <div className="wv-row-actions">
                    <button className="wv-btn ghost" onClick={event => { event.stopPropagation(); setEditing(project); setEditName(project.name); setEditSummary(project.desc) }}>编辑</button>
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
            <tr><th>项目名称</th><th>删除时间</th><th>保留</th><th>操作</th></tr>
          </thead>
          <tbody>
            {pageItems.map(project => (
              <tr key={project.id}>
                <td style={{ fontWeight: 600 }}>{project.name}</td>
                <td>{project.deletedAt}</td>
                <td>30 天后自动清理</td>
                <td>
                  <div className="wv-row-actions">
                    <button className="wv-btn ghost" onClick={() => restoreProject(project.id)}>恢复</button>
                    <button className="wv-btn ghost danger" onClick={() => setConfirmPurge(project)}>彻底删除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Pager page={page} pageCount={pageCount} onPage={setPage} total={total} />

      {editing && (
        <Modal
          title="编辑项目"
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="wv-btn" onClick={() => setEditing(null)}>取消</button>
              <button
                className="wv-btn primary"
                disabled={!editName.trim()}
                onClick={() => { updateProject(editing.id, editName.trim(), editSummary.trim()); setEditing(null) }}
              >
                保存
              </button>
            </>
          }
        >
          <Field label="项目名称">
            <input
              className="wv-input"
              autoFocus
              value={editName}
              onChange={event => setEditName(event.target.value)}
              placeholder="例如：跨境投资"
            />
          </Field>
          <Field label="项目摘要">
            <textarea
              className="wv-textarea"
              rows={3}
              value={editSummary}
              onChange={event => setEditSummary(event.target.value)}
              placeholder="可选"
            />
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

      {creating && (
        <Modal
          title="新项目"
          onClose={() => setCreating(false)}
          footer={
            <>
              <button className="wv-btn" onClick={() => setCreating(false)}>取消</button>
              <button className="wv-btn primary" onClick={submitCreate}>创建</button>
            </>
          }
        >
          <Field label="项目名称">
            <input
              className="wv-input"
              autoFocus
              value={draftName}
              onChange={event => setDraftName(event.target.value)}
              placeholder="例如：跨境投资"
            />
          </Field>
          <Field label="项目摘要">
            <textarea
              className="wv-textarea"
              rows={3}
              value={draftSummary}
              onChange={event => setDraftSummary(event.target.value)}
              placeholder="可选"
            />
          </Field>
        </Modal>
      )}
    </>
  )
}
