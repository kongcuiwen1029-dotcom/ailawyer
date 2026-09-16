import { useState } from 'react'
import { AlertTriangle, Bot, CheckCircle2, CircleDot, Power, Play, Plus, ShieldAlert, Users } from 'lucide-react'
import { useWorkspace, type Employee, type Team } from '../state/workspace'
import { Badge, DetailShell, Empty, Field, Modal, Pager, Section, ViewHead, usePaged } from '../ui/parts'

export default function TeamsView({ onDebug, onOpenEmployee, initialOpenId }: { onDebug: (team: Team) => void; onOpenEmployee: (employeeId: string) => void; initialOpenId?: string }) {
  const { teams, employees, createTeam, activateTeam, disableTeam } = useWorkspace()
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null)
  const [creating, setCreating] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftDesc, setDraftDesc] = useState('')

  const open = teams.find(team => team.id === openId) ?? null
  const { page, setPage, pageCount, pageItems, total } = usePaged(teams, 4)
  const hasActive = teams.some(team => team.status === 'active')

  if (open) return <TeamDetail key={open.id} team={open} onBack={() => setOpenId(null)} onDebug={onDebug} onOpenEmployee={onOpenEmployee} />

  return (
    <>
      <ViewHead
        view="teams"
        meta="每个租户最多启用一个员工组；组内的主管就是项目 Copilot，负责拆解任务、委派成员、汇总结果。"
        action={<button className="wv-btn primary" onClick={() => { setCreating(true); setDraftName(''); setDraftDesc('') }}><Plus size={14} strokeWidth={2} /> 新建员工组</button>}
      />

      {!hasActive && (
        <p className="wv-banner warn">
          <ShieldAlert size={14} strokeWidth={2} />
          当前租户没有启用中的员工组，项目会话会直接失败并返回 GOVERNANCE_ACTIVE_TEAM_UNAVAILABLE，不会退回单轮问答。
        </p>
      )}

      {!pageItems.length && <Empty text="还没有员工组。" />}

      <div className="wv-list">
        {pageItems.map(team => {
          const memberNames = team.members
            .map(member => employees.find(employee => employee.id === member.employeeId)?.name ?? '已删除成员')
          return (
            <div className="wv-row" key={team.id} style={{ alignItems: 'flex-start' }}>
              <div className="wv-ico"><Users size={18} strokeWidth={1.8} /></div>
              <div className="wv-row-main">
                <p className="wv-row-title">
                  {team.name}
                  {team.status === 'active'
                    ? <Badge kind="ok"><CheckCircle2 size={11} strokeWidth={2.2} /> 已启用</Badge>
                    : <Badge kind="draft"><CircleDot size={11} strokeWidth={2.2} /> 草稿</Badge>}
                  {!team.modelResourceId && <Badge kind="warn">主管模型未指定</Badge>}
                </p>
                <p className="wv-row-sub">r{team.revision} · 委派上限 {team.maxDelegations} · 并行上限 {team.maxParallel} · 总时长 180 秒</p>
                <div className="wv-chips" style={{ marginTop: 10 }}>
                  {memberNames.length
                    ? memberNames.map((name, index) => <span className="wv-chip2" key={`${name}-${index}`}><Bot size={11} strokeWidth={2} /> {name}</span>)
                    : <span className="wv-chip2">尚未添加成员</span>}
                </div>
                <p className="wv-row-desc">{team.description}</p>
              </div>
              <div className="wv-row-actions">
                <button className="wv-btn" onClick={() => setOpenId(team.id)}>配置</button>
                <button className="wv-btn" onClick={() => onDebug(team)}><Play size={13} strokeWidth={1.9} /> 调试</button>
                {team.status === 'active'
                  ? <button className="wv-btn" onClick={() => disableTeam(team.id)}><Power size={13} strokeWidth={1.9} /> 停用</button>
                  : <button className="wv-btn primary" onClick={() => activateTeam(team.id)}>启用</button>}
              </div>
            </div>
          )
        })}
      </div>

      <Pager page={page} pageCount={pageCount} onPage={setPage} total={total} size={4} />

      {creating && (
        <Modal
          title="新建员工组"
          desc="创建后需要指定主管模型并挑选成员，校验通过后才会成为租户的启用组。"
          onClose={() => setCreating(false)}
          footer={
            <>
              <button className="wv-btn" onClick={() => setCreating(false)}>取消</button>
              <button className="wv-btn primary" disabled={!draftName.trim()} onClick={() => { const id = createTeam(draftName.trim(), draftDesc.trim()); setCreating(false); setOpenId(id) }}>
                创建并配置
              </button>
            </>
          }
        >
          <Field label="员工组名称">
            <input className="wv-input" value={draftName} onChange={event => setDraftName(event.target.value)} placeholder="例如：知识产权小组" />
          </Field>
          <Field label="职责说明">
            <textarea className="wv-textarea" rows={3} value={draftDesc} onChange={event => setDraftDesc(event.target.value)} />
          </Field>
        </Modal>
      )}
    </>
  )
}

/* ───────────────────────── team detail ───────────────────────── */

function TeamDetail({ team, onBack, onDebug, onOpenEmployee }: { team: Team; onBack: () => void; onDebug: (team: Team) => void; onOpenEmployee: (employeeId: string) => void }) {
  const { resources, employees, updateTeam, activateTeam, disableTeam, toggleTeamMember, notify } = useWorkspace()
  const [delegations, setDelegations] = useState(team.maxDelegations)
  const [parallel, setParallel] = useState(team.maxParallel)

  const modelOptions = resources.filter(resource => resource.kind === 'model' && resource.published)
  const dirty = delegations !== team.maxDelegations || parallel !== team.maxParallel
  const activeMembers = team.members.filter(member => employees.find(employee => employee.id === member.employeeId)?.status === 'active')

  return (
    <DetailShell
      title={team.name}
      subtitle={`revision r${team.revision} · 更新于 ${team.updated} · 主管由项目 Copilot 兼任`}
      badges={team.status === 'active' ? <Badge kind="ok">已启用</Badge> : <Badge kind="draft">草稿</Badge>}
      actions={
        <>
          <button className="wv-btn" onClick={() => onDebug(team)}><Play size={13} strokeWidth={1.9} /> 调试</button>
          {team.status === 'active'
            ? <button className="wv-btn" onClick={() => disableTeam(team.id)}><Power size={13} strokeWidth={1.9} /> 停用</button>
            : <button className="wv-btn primary" onClick={() => activateTeam(team.id)}>启用该组</button>}
        </>
      }
      onBack={onBack}
    >
      <p className="wv-note">{team.description}</p>

      <Section title="主管模型" hint="主管负责拆解与汇总，成员各自使用自己绑定的主模型。">
        <select
          className="wv-select"
          value={team.modelResourceId}
          onChange={event => updateTeam(team.id, { modelResourceId: event.target.value })}
        >
          <option value="">未指定（无法启用）</option>
          {modelOptions.map(resource => <option key={resource.id} value={resource.id}>{resource.name}</option>)}
        </select>
        {!modelOptions.length && <p className="wv-banner warn"><AlertTriangle size={14} strokeWidth={2} /> 没有可用的已发布模型，请先到资源市场发布。 </p>}
      </Section>

      <Section
        title="成员"
        hint="成员必须是已发布的数字员工；成员自身的绑定在组内由主管统一调度使用。"
        action={<span className="wv-filter-note">{activeMembers.length} / {team.members.length} 位成员处于 active</span>}
      >
        <div className="wv-list tight">
          {employees.map(employee => {
            const selected = team.members.find(member => member.employeeId === employee.id)
            return (
              <div className="wv-row" key={employee.id}>
                <div className="wv-ico"><Bot size={16} strokeWidth={1.8} /></div>
                <div className="wv-row-main">
                  <p className="wv-row-title">
                    {employee.name}
                    {employee.status === 'active' ? <Badge kind="ok">active</Badge> : <Badge kind="draft">draft</Badge>}
                    {selected && <Badge kind="run">已加入</Badge>}
                  </p>
                  <p className="wv-row-sub">{employee.description}</p>
                  {selected && (
                    <input
                      className="wv-input inline"
                      value={selected.duty}
                      placeholder="填写该成员在组内的分工，例如：证据检索"
                      onChange={event => updateTeam(team.id, {
                        members: team.members.map(member => member.employeeId === employee.id ? { ...member, duty: event.target.value } : member),
                      })}
                    />
                  )}
                </div>
                <div className="wv-row-actions">
                  <button className="wv-btn" onClick={() => onOpenEmployee(employee.id)}>详细配置</button>
                  <button className={`wv-btn${selected ? '' : ' primary'}`} onClick={() => toggleTeamMember(team.id, employee.id)}>
                    {selected ? '移出组' : '加入组'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="预算" hint="超出预算会显式中止并写入调试台；主管不会在超限后自行重试。">
        <div className="wv-field-row">
          <Field label="最多委派次数" hint="1–32 次；每次委派对应一个成员的完整子任务。">
            <input
              className="wv-input"
              type="number"
              min={1}
              max={32}
              value={delegations}
              onChange={event => setDelegations(Math.max(1, Math.min(32, Number(event.target.value) || 1)))}
            />
          </Field>
          <Field label="最大并行数" hint="1–200；成员同时运行的子任务上限。">
            <input
              className="wv-input"
              type="number"
              min={1}
              max={200}
              value={parallel}
              onChange={event => setParallel(Math.max(1, Math.min(200, Number(event.target.value) || 1)))}
            />
          </Field>
          <Field label="单轮总时长" hint="固定 180 秒。">
            <input className="wv-input" value="180 秒" readOnly />
          </Field>
        </div>
        <div className="wv-toolbar end">
          <button className="wv-btn" disabled={!dirty} onClick={() => { setDelegations(team.maxDelegations); setParallel(team.maxParallel) }}>放弃修改</button>
          <button
            className="wv-btn primary"
            disabled={!dirty}
            onClick={() => { updateTeam(team.id, { maxDelegations: delegations, maxParallel: parallel }); notify('预算已保存。', 'ok') }}
          >
            保存预算
          </button>
        </div>
      </Section>
    </DetailShell>
  )
}
