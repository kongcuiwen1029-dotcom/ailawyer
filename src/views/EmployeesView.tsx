import { useMemo, useState } from 'react'
import { Bot, CheckCircle2, CircleDot, Link2, Play, Plus, Power, ShieldAlert, Trash2, Unlink } from 'lucide-react'
import { useWorkspace, type Employee } from '../state/workspace'
import { Badge, DetailShell, Empty, Field, Modal, Pager, Section, ViewHead, usePaged } from '../ui/parts'

export const EMPLOYEE_BUDGET = [
  { label: '单次任务最多步数', value: '8 步' },
  { label: '模型调用次数', value: '32 次' },
  { label: '单次任务时长', value: '15 分钟' },
  { label: '员工内部委派', value: '0 次（员工不再向下委派）' },
  { label: '并行工具调用', value: '最多 4 个' },
]

const INSTRUCTION_LIMIT = 20000

export default function EmployeesView({ onDebug, onOpenTeam, initialOpenId }: { onDebug: (employee: Employee) => void; onOpenTeam: (teamId: string) => void; initialOpenId?: string }) {
  const { employees, createEmployee, pushEmployee, disableEmployee, deleteEmployee } = useWorkspace()
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null)
  const [creating, setCreating] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftDesc, setDraftDesc] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Employee | null>(null)

  const open = employees.find(employee => employee.id === openId) ?? null
  const { page, setPage, pageCount, pageItems, total } = usePaged(employees, 5)

  if (open) return <EmployeeDetail key={open.id} employee={open} onBack={() => setOpenId(null)} onDebug={onDebug} onOpenTeam={onOpenTeam} />

  return (
    <>
      <ViewHead
        view="employees"
        meta="每个员工就是一个独立的单 Agent 执行身份：一个主模型 + 若干已发布资源 + 一段固定指令，任务期间不再向下委派。"
        action={<button className="wv-btn primary" onClick={() => setCreating(true)}><Plus size={14} strokeWidth={2} /> 新建员工</button>}
      />

      <div className="wv-kv cards">
        {EMPLOYEE_BUDGET.slice(0, 3).map(item => (
          <div key={item.label}><span>{item.label}</span><b>{item.value}</b></div>
        ))}
      </div>

      {!pageItems.length && <Empty text="还没有数字员工。" />}

      <div className="wv-list">
        {pageItems.map(employee => {
          const model = employee.bindings
            .map(binding => binding.resourceId)
            .length
          const active = employee.status === 'active'
          return (
            <div className="wv-row" key={employee.id}>
              <div className="wv-ico"><Bot size={18} strokeWidth={1.8} /></div>
              <div className="wv-row-main">
                <p className="wv-row-title">
                  {employee.name}
                  {active
                    ? <Badge kind="ok"><CheckCircle2 size={11} strokeWidth={2.2} /> active</Badge>
                    : <Badge kind="draft"><CircleDot size={11} strokeWidth={2.2} /> draft</Badge>}
                </p>
                <p className="wv-row-sub">{employee.key} · r{employee.revision} · 更新于 {employee.updated} · {model} 项绑定</p>
                <p className="wv-row-desc">{employee.description}</p>
              </div>
              <div className="wv-row-actions">
                <button className="wv-btn" onClick={() => setOpenId(employee.id)}>配置</button>
                <button className="wv-btn" onClick={() => onDebug(employee)}><Play size={13} strokeWidth={1.9} /> 调试</button>
                {active
                  ? <button className="wv-btn" onClick={() => disableEmployee(employee.id)}><Power size={13} strokeWidth={1.9} /> 停用</button>
                  : <button className="wv-btn primary" onClick={() => pushEmployee(employee.id)}>发布</button>}
                <button className="wv-btn ghost danger" disabled={active} onClick={() => setConfirmDelete(employee)}><Trash2 size={13} strokeWidth={1.9} /></button>
              </div>
            </div>
          )
        })}
      </div>

      <Pager page={page} pageCount={pageCount} onPage={setPage} total={total} size={5} />

      {creating && (
        <Modal
          title="新建数字员工"
          desc="新建后是草稿状态，需要绑定一个主模型并填写执行指令才能发布。"
          onClose={() => setCreating(false)}
          footer={
            <>
              <button className="wv-btn" onClick={() => setCreating(false)}>取消</button>
              <button className="wv-btn primary" disabled={!draftName.trim()} onClick={() => { const id = createEmployee(draftName.trim(), draftDesc.trim()); setCreating(false); setOpenId(id) }}>
                创建并配置
              </button>
            </>
          }
        >
          <Field label="员工名称">
            <input className="wv-input" value={draftName} onChange={event => setDraftName(event.target.value)} placeholder="例如：劳动合规审查员" />
          </Field>
          <Field label="职责说明" hint="一句话说明这个员工负责哪类任务。">
            <textarea className="wv-textarea" rows={3} value={draftDesc} onChange={event => setDraftDesc(event.target.value)} />
          </Field>
        </Modal>
      )}

      {confirmDelete && (
        <Modal
          title="删除数字员工"
          desc="只有草稿状态的员工可以删除，已发布员工需要先停用。"
          onClose={() => setConfirmDelete(null)}
          footer={
            <>
              <button className="wv-btn" onClick={() => setConfirmDelete(null)}>取消</button>
              <button className="wv-btn danger" onClick={() => { deleteEmployee(confirmDelete.id); setConfirmDelete(null) }}>确认删除</button>
            </>
          }
        >
          <p className="wv-note">即将删除：{confirmDelete.name}</p>
        </Modal>
      )}
    </>
  )
}

/* ───────────────────────── employee detail ───────────────────────── */

function EmployeeDetail({ employee, onBack, onDebug, onOpenTeam }: { employee: Employee; onBack: () => void; onDebug: (employee: Employee) => void; onOpenTeam: (teamId: string) => void }) {
  const { resources, teams, updateEmployee, addEmployeeBinding, removeEmployeeBinding, pushEmployee, disableEmployee, notify } = useWorkspace()
  const [instructions, setInstructions] = useState(employee.instructions)
  const [binding, setBinding] = useState(false)
  const [resourceId, setResourceId] = useState('')
  const [purpose, setPurpose] = useState('')

  const boundResourceIds = new Set(employee.bindings.map(item => item.resourceId))
  const hasModel = employee.bindings.some(item => resources.find(resource => resource.id === item.resourceId)?.kind === 'model')
  const hostingTeams = teams.filter(team => team.members.some(member => member.employeeId === employee.id))
  const candidates = resources.filter(resource => resource.published && !boundResourceIds.has(resource.id))

  const dirty = instructions !== employee.instructions
  const overLimit = instructions.length > INSTRUCTION_LIMIT

  return (
    <DetailShell
      title={employee.name}
      subtitle={`${employee.key} · revision r${employee.revision} · 更新于 ${employee.updated}`}
      badges={employee.status === 'active' ? <Badge kind="ok">active</Badge> : <Badge kind="draft">draft</Badge>}
      actions={
        <>
          <button className="wv-btn" onClick={() => onDebug(employee)}><Play size={13} strokeWidth={1.9} /> 调试</button>
          {employee.status === 'active'
            ? <button className="wv-btn" onClick={() => disableEmployee(employee.id)}><Power size={13} strokeWidth={1.9} /> 停用</button>
            : <button className="wv-btn primary" onClick={() => pushEmployee(employee.id)}>发布新版本</button>}
        </>
      }
      onBack={onBack}
    >
      <p className="wv-note">{employee.description}</p>

      {hostingTeams.length > 0 && (
        <p className="wv-banner info">
          <ShieldAlert size={14} strokeWidth={2} />
          该员工正在 {hostingTeams.map(team => team.name).join('、')} 中担任成员，
          成员的资源绑定在启用中的组内由主管统一调度使用。
          <button className="wv-link" onClick={() => onOpenTeam(hostingTeams[0].id)}>查看员工组</button>
        </p>
      )}

      <Section title="执行指令" hint={`这是员工唯一的任务说明，最多 ${INSTRUCTION_LIMIT.toLocaleString('en-US')} 个字符；执行时不会再插入额外的 Router 或计划层。`}>
        <textarea
          className="wv-textarea"
          rows={7}
          value={instructions}
          onChange={event => setInstructions(event.target.value)}
          placeholder="说明任务范围、证据要求、输出结构与边界……"
        />
        <div className="wv-counter-row">
          <span className={overLimit ? 'wv-counter over' : 'wv-counter'}>{instructions.length.toLocaleString('en-US')} / {INSTRUCTION_LIMIT.toLocaleString('en-US')}</span>
          <div className="wv-toolbar">
            <button className="wv-btn" disabled={!dirty} onClick={() => setInstructions(employee.instructions)}>放弃修改</button>
            <button
              className="wv-btn primary"
              disabled={!dirty || overLimit}
              onClick={() => { updateEmployee(employee.id, { instructions }); notify('执行指令已保存，新版本从下一次任务开始生效。', 'ok') }}
            >
              保存指令
            </button>
          </div>
        </div>
      </Section>

      <Section
        title="资源绑定"
        hint="只能绑定已发布且在当前租户内可用的资源；一个员工只能有一个主模型。"
        action={<button className="wv-btn" onClick={() => { setResourceId(''); setPurpose(''); setBinding(true) }}><Plus size={13} strokeWidth={2} /> 添加绑定</button>}
      >
        {!employee.bindings.length && <Empty text="还没有绑定任何资源。至少绑定一个主模型后才能发布。" />}
        <div className="wv-list tight">
          {employee.bindings.map(item => {
            const resource = resources.find(candidate => candidate.id === item.resourceId)
            return (
              <div className="wv-row" key={item.resourceId}>
                <div className="wv-ico"><Link2 size={16} strokeWidth={1.8} /></div>
                <div className="wv-row-main">
                  <p className="wv-row-title">
                    {resource?.name ?? '资源已删除'}
                    {resource?.kind === 'model' ? <Badge kind="ok">主模型</Badge> : <Badge kind="draft">{resource ? kindOf(resource.kind) : '未知'}</Badge>}
                    {!resource?.published && <Badge kind="warn">未发布</Badge>}
                  </p>
                  <p className="wv-row-sub">{item.purpose || '未填写用途'} · {resource?.key ?? '—'}</p>
                </div>
                <div className="wv-row-actions">
                  <button className="wv-btn ghost danger" onClick={() => removeEmployeeBinding(employee.id, item.resourceId)}><Unlink size={12} strokeWidth={1.9} /> 解除</button>
                </div>
              </div>
            )
          })}
        </div>
        {!hasModel && <p className="wv-banner warn"><ShieldAlert size={14} strokeWidth={2} /> 尚未绑定主模型，当前无法发布。</p>}
      </Section>

      <Section title="执行预算" hint="由平台统一设定，员工不能自行提高；超限会显式中止而不是重试。">
        <div className="wv-kv">
          {EMPLOYEE_BUDGET.map(item => <div key={item.label}><span>{item.label}</span><b>{item.value}</b></div>)}
        </div>
      </Section>

      {binding && (
        <Modal
          title="添加资源绑定"
          desc="下拉里只列出已发布且尚未绑定的资源。"
          onClose={() => setBinding(false)}
          footer={
            <>
              <button className="wv-btn" onClick={() => setBinding(false)}>取消</button>
              <button
                className="wv-btn primary"
                disabled={!resourceId}
                onClick={() => { addEmployeeBinding(employee.id, resourceId, purpose.trim()); setBinding(false) }}
              >
                绑定
              </button>
            </>
          }
        >
          <Field label="资源" hint={candidates.length ? undefined : '当前没有可绑定的已发布资源，先到资源市场发布一个。'}>
            <select className="wv-select" value={resourceId} onChange={event => setResourceId(event.target.value)}>
              <option value="">请选择资源</option>
              {candidates.map(resource => (
                <option key={resource.id} value={resource.id}>{kindOf(resource.kind)} · {resource.name}（{resource.key}）</option>
              ))}
            </select>
          </Field>
          <Field label="用途" hint="说明这个资源在任务里承担什么角色，会显示在调试台的装配信息里。">
            <input className="wv-input" value={purpose} onChange={event => setPurpose(event.target.value)} placeholder="例如：条款风险判断方法" />
          </Field>
        </Modal>
      )}
    </DetailShell>
  )
}

function kindOf(kind: string) {
  return { kb: '知识库', skill: 'Skill', connector: 'Connector', sop: 'SOP', model: '模型' }[kind] ?? kind
}
