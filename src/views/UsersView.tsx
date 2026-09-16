import { useMemo, useState, type ReactNode } from 'react'
import { KeyRound, LogOut, Plus, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { CURRENT_USER_ID, KNOWN_CAPABILITIES, ROLE_CAPABILITIES, TENANTS, useWorkspace, type AdminUser, type AuditEntry, type ScopeGrant } from '../state/workspace'
import { Badge, Empty, Field, Modal, Pager, Section, ViewHead, usePaged } from '../ui/parts'

const ROLES = ['super_admin', 'admin', 'lawyer_admin', 'governance_super_admin', 'user'] as const

const ROLE_LABEL: Record<string, string> = {
  super_admin: '超级管理员',
  admin: '租户管理员',
  lawyer_admin: '律师管理员',
  governance_super_admin: '治理超级管理员',
  user: '普通用户',
}

const SCOPE_LABEL: Record<ScopeGrant['type'], string> = { platform: '平台', tenant: '租户', project: '项目' }

export default function UsersView() {
  const { users, loginAudit, adminAudit, projects, createUser, replaceAuthorization, resetUserPassword, toggleUserStatus, revokeUserSessions } = useWorkspace()
  const [tab, setTab] = useState<'accounts' | 'login' | 'admin'>('accounts')
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')

  const visible = useMemo(() => users.filter(user => !query.trim() || `${user.name}${user.email}${user.roles.join()}`.toLowerCase().includes(query.trim().toLowerCase())), [users, query])
  const { page, setPage, pageCount, pageItems, total } = usePaged(visible, 8)

  const editor = editing ? users.find(user => user.id === editing.id) ?? editing : null

  return (
    <>
      <ViewHead
        view="users"
        meta="角色、作用域、密码与会话都由同一处治理；一次保存即整体生效，不会出现改了一半的授权。"
        action={
          <button className="wv-btn primary" onClick={() => setCreating(true)}>
            <UserPlus size={14} strokeWidth={1.9} /> 新建账号
          </button>
        }
      />

      <div className="wv-tabs">
        <button className={`wv-tab${tab === 'accounts' ? ' active' : ''}`} onClick={() => setTab('accounts')}>账号</button>
        <button className={`wv-tab${tab === 'login' ? ' active' : ''}`} onClick={() => setTab('login')}>登录审计</button>
        <button className={`wv-tab${tab === 'admin' ? ' active' : ''}`} onClick={() => setTab('admin')}>管理操作审计</button>
      </div>

      {tab === 'accounts' && (
        <>
          <div className="wv-filter">
            <input className="wv-input" placeholder="搜索姓名、邮箱或角色" value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} />
            <span className="wv-filter-note">共 {users.length} 个账号，其中启用 {users.filter(user => user.status === 'active').length} 个</span>
          </div>

          {!pageItems.length && <Empty text="没有符合条件的账号。" />}

          <table className="wv-table">
            <thead>
              <tr><th>姓名</th><th>邮箱</th><th>角色</th><th>作用域</th><th>状态</th><th>最近登录</th><th>操作</th></tr>
            </thead>
            <tbody>
              {pageItems.map(user => (
                <tr key={user.id}>
                  <td style={{ fontWeight: 600 }}>
                    {user.name}
                    {user.id === CURRENT_USER_ID && <Badge kind="run">当前登录</Badge>}
                  </td>
                  <td className="wv-mono">{user.email}</td>
                  <td>
                    <div className="wv-chips">
                      {user.roles.map(role => <span className="wv-chip2" key={role}>{ROLE_LABEL[role] ?? role}</span>)}
                    </div>
                  </td>
                  <td>
                    <div className="wv-chips">
                      {user.scopes.map(scope => <span className="wv-chip2" key={`${scope.type}-${scope.target}`}>{SCOPE_LABEL[scope.type]} · {scope.target}</span>)}
                    </div>
                  </td>
                  <td>{user.status === 'active'
                    ? <Badge kind="ok">启用</Badge>
                    : <Badge kind="draft">已停用</Badge>}</td>
                  <td>{user.lastLogin}{user.mustChangePassword && <Badge kind="warn">待改密</Badge>}</td>
                  <td>
                    <div className="wv-row-actions">
                      <button className="wv-btn ghost" onClick={() => setEditing(user)}>授权</button>
                      <button className="wv-btn ghost" onClick={() => resetUserPassword(user.id)}><KeyRound size={12} strokeWidth={1.9} /> 重置密码</button>
                      <button className="wv-btn ghost" disabled={!user.sessions.length} onClick={() => revokeUserSessions(user.id)}><LogOut size={12} strokeWidth={1.9} /> 吊销会话</button>
                      <button className="wv-btn ghost danger" disabled={user.id === CURRENT_USER_ID} onClick={() => toggleUserStatus(user.id)}>
                        {user.status === 'active' ? '停用' : '启用'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pager page={page} pageCount={pageCount} onPage={setPage} total={total} size={8} />
        </>
      )}

      {tab === 'login' && (
        <AuditTable
          entries={loginAudit}
          columns={['时间', '账号', '事件', '目标', '详情']}
          render={entry => [entry.time, entry.actor, <code key="a" className="wv-mono">{entry.action}</code>, entry.target, entry.detail]}
        />
      )}

      {tab === 'admin' && (
        <AuditTable
          entries={adminAudit}
          columns={['时间', '操作人', '动作', '对象', '变更内容']}
          render={entry => [entry.time, entry.actor, <code key="a" className="wv-mono">{entry.action}</code>, entry.target, entry.detail]}
        />
      )}

      {editor && <AuthorizationModal user={editor} onClose={() => setEditing(null)} onSubmit={replaceAuthorization} />}

      {creating && (
        <CreateUserModal
          onClose={() => setCreating(false)}
          onSubmit={createUser}
          projectNames={projects.filter(project => !project.deletedAt).map(project => project.name)}
        />
      )}
    </>
  )
}

function AuditTable({ entries, columns, render }: { entries: AuditEntry[]; columns: string[]; render: (entry: AuditEntry) => ReactNode[] }) {
  const { page, setPage, pageCount, pageItems, total } = usePaged(entries, 8)
  return (
    <>
      {!pageItems.length && <Empty text="暂无记录。" />}
      <table className="wv-table">
        <thead>
          <tr>{columns.map(column => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {pageItems.map(entry => (
            <tr key={entry.id}>{render(entry).map((cell, index) => <td key={index}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
      <Pager page={page} pageCount={pageCount} onPage={setPage} total={total} size={8} />
    </>
  )
}

/* ───────────────────────── authorization ───────────────────────── */

function AuthorizationModal({ user, onClose, onSubmit }: {
  user: AdminUser
  onClose: () => void
  onSubmit: (id: string, roles: string[], scopes: ScopeGrant[]) => void
}) {
  const { projects } = useWorkspace()
  const [roles, setRoles] = useState<string[]>(user.roles)
  const [scopes, setScopes] = useState<ScopeGrant[]>(user.scopes)
  const [newType, setNewType] = useState<ScopeGrant['type']>('tenant')
  const [newTarget, setNewTarget] = useState(TENANTS[0])

  const isSelf = user.id === CURRENT_USER_ID
  const capabilities = useMemo(() => {
    const set = new Set<string>()
    roles.forEach(role => (ROLE_CAPABILITIES[role] ?? []).forEach(capability => set.add(capability)))
    return Array.from(set)
  }, [roles])
  const canPlatform = roles.some(role => role === 'admin' || role === 'super_admin')

  const targets = newType === 'tenant' ? TENANTS : newType === 'project' ? projects.map(project => project.name) : ['平台']

  function toggleRole(role: string) {
    setRoles(current => current.includes(role) ? current.filter(item => item !== role) : [...current, role])
  }

  return (
    <Modal
      title={`授权 · ${user.name}`}
      desc={isSelf
        ? '不能修改自己的授权：请让另一位超级管理员代为操作。'
        : '角色与作用域会在一次提交里整体替换，旧会话立即失效；只删除角色不影响账号本身。'}
      width={720}
      onClose={onClose}
      footer={
        <>
          <button className="wv-btn" onClick={onClose}>取消</button>
          <button
            className="wv-btn primary"
            disabled={isSelf || (!roles.length && !scopes.length)}
            onClick={() => { onSubmit(user.id, roles, scopes); onClose() }}
          >
            保存授权
          </button>
        </>
      }
    >
      <Section title="角色" hint="角色决定能做什么；点击可增删，至少保留一个角色。">
        <div className="wv-chips">
          {ROLES.map(role => (
            <button key={role} className={`wv-toggle${roles.includes(role) ? ' on' : ''}`} onClick={() => toggleRole(role)}>
              {ROLE_LABEL[role]}
            </button>
          ))}
        </div>
        <div className="wv-cap-list">
          {capabilities.length
            ? capabilities.map(capability => <code className="wv-chip2" key={capability}>{capability}</code>)
            : <span className="wv-filter-note">普通用户没有平台管理能力。</span>}
        </div>
        <p className="wv-note">共 {KNOWN_CAPABILITIES.length} 项平台能力可被角色组合出来；没有出现在上面的能力，该账号一律不具备。</p>
      </Section>

      <Section title="作用域" hint="作用域决定能看到谁的数据；平台级作用域只对管理员角色有效，保存时会被自动降级为租户级。">
        <div className="wv-list tight">
          {scopes.map(scope => (
            <div className="wv-row" key={`${scope.type}-${scope.target}`}>
              <div className="wv-row-main">
                <p className="wv-row-title">{SCOPE_LABEL[scope.type]} · {scope.target}{scope.type === 'platform' && !canPlatform && <Badge kind="warn">保存时会降级</Badge>}</p>
              </div>
              <div className="wv-row-actions">
                <button className="wv-btn ghost danger" onClick={() => setScopes(current => current.filter(item => !(item.type === scope.type && item.target === scope.target)))}>
                  <Trash2 size={12} strokeWidth={1.9} /> 移除
                </button>
              </div>
            </div>
          ))}
          {!scopes.length && <Empty text="没有任何作用域，账号登录后看不到数据。" />}
        </div>
        <div className="wv-inline-form">
          <select className="wv-select" value={newType} onChange={event => { const value = event.target.value as ScopeGrant['type']; setNewType(value); setNewTarget(value === 'tenant' ? TENANTS[0] : value === 'project' ? projects[0]?.name ?? '' : '平台') }}>
            <option value="platform">平台</option>
            <option value="tenant">租户</option>
            <option value="project">项目</option>
          </select>
          <select className="wv-select" value={newTarget} onChange={event => setNewTarget(event.target.value)}>
            {targets.map(target => <option key={target}>{target}</option>)}
          </select>
          <button
            className="wv-btn"
            disabled={!newTarget || scopes.some(scope => scope.type === newType && scope.target === newTarget)}
            onClick={() => setScopes(current => [...current, { type: newType, target: newTarget }])}
          >
            <Plus size={13} strokeWidth={2} /> 添加
          </button>
        </div>
      </Section>

      {user.roles.includes('super_admin') && !roles.includes('super_admin') && (
        <p className="wv-banner warn">
          <ShieldCheck size={14} strokeWidth={2} />
          这会移除该账号的超级管理员角色。如果它是最后一个活跃的超级管理员，保存会被拒绝并整体回滚（SUPER_ADMIN_REQUIRED）。
        </p>
      )}
    </Modal>
  )
}

function CreateUserModal({ onClose, onSubmit, projectNames }: {
  onClose: () => void
  onSubmit: (name: string, email: string, roles: string[], scopes: ScopeGrant[]) => void
  projectNames: string[]
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [roles, setRoles] = useState<string[]>(['user'])
  const [scopes, setScopes] = useState<ScopeGrant[]>([{ type: 'tenant', target: TENANTS[0] }])
  const [scopeType, setScopeType] = useState<ScopeGrant['type']>('tenant')
  const [scopeTarget, setScopeTarget] = useState(TENANTS[0])

  const targets = scopeType === 'tenant' ? TENANTS : scopeType === 'project' ? projectNames : ['平台']

  return (
    <Modal
      title="新建账号"
      desc="创建后系统生成临时密码并要求首次登录修改；密码不会在日志里出现。"
      width={640}
      onClose={onClose}
      footer={
        <>
          <button className="wv-btn" onClick={onClose}>取消</button>
          <button
            className="wv-btn primary"
            disabled={!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}
            onClick={() => { onSubmit(name.trim(), email.trim(), roles, scopes); onClose() }}
          >
            创建
          </button>
        </>
      }
    >
      <div className="wv-field-row">
        <Field label="姓名"><input className="wv-input" value={name} onChange={event => setName(event.target.value)} /></Field>
        <Field label="邮箱" hint="邮箱重复会返回 409。"><input className="wv-input" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example-law.cn" /></Field>
      </div>
      <Section title="角色">
        <div className="wv-chips">
          {ROLES.map(role => (
            <button key={role} className={`wv-toggle${roles.includes(role) ? ' on' : ''}`} onClick={() => setRoles(current => current.includes(role) ? current.filter(item => item !== role) : [...current, role])}>
              {ROLE_LABEL[role]}
            </button>
          ))}
        </div>
      </Section>
      <Section title="作用域">
        <div className="wv-list tight">
          {scopes.map(scope => (
            <div className="wv-row" key={`${scope.type}-${scope.target}`}>
              <div className="wv-row-main"><p className="wv-row-title">{SCOPE_LABEL[scope.type]} · {scope.target}</p></div>
              <div className="wv-row-actions">
                <button className="wv-btn ghost danger" onClick={() => setScopes(current => current.filter(item => !(item.type === scope.type && item.target === scope.target)))}>移除</button>
              </div>
            </div>
          ))}
        </div>
        <div className="wv-inline-form">
          <select className="wv-select" value={scopeType} onChange={event => { const value = event.target.value as ScopeGrant['type']; setScopeType(value); setScopeTarget(value === 'tenant' ? TENANTS[0] : value === 'project' ? projectNames[0] ?? '' : '平台') }}>
            <option value="platform">平台</option>
            <option value="tenant">租户</option>
            <option value="project">项目</option>
          </select>
          <select className="wv-select" value={scopeTarget} onChange={event => setScopeTarget(event.target.value)}>
            {targets.map(target => <option key={target}>{target}</option>)}
          </select>
          <button
            className="wv-btn"
            disabled={scopes.some(scope => scope.type === scopeType && scope.target === scopeTarget)}
            onClick={() => setScopes(current => [...current, { type: scopeType, target: scopeTarget }])}
          >
            <Plus size={13} strokeWidth={2} /> 添加
          </button>
        </div>
      </Section>
    </Modal>
  )
}
