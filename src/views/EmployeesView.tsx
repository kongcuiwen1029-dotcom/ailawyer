import { useMemo, useState } from 'react'
import { Bot, CheckCircle2, ChevronRight, CircleDot, Folder, Minus, Plus, Power, ShieldAlert, Sparkles } from 'lucide-react'
import { useWorkspace, type Employee, type EmployeeBinding, type ResourceKind } from '../state/workspace'
import { Badge, DetailShell, Empty, Field, Modal, Pager, ViewHead, usePaged } from '../ui/parts'

const INSTRUCTION_LIMIT = 20000

/* 列表页的状态筛选，对齐真实应用（`?status=` 三个取值，默认 all）。真实应用的计数
   取自一次独立的全量查询，原型本来就是全量数据，直接算即可。 */
const STATUS_TABS: { id: 'all' | 'active' | 'draft'; label: string; empty: string }[] = [
  { id: 'all', label: '全部', empty: '还没有数字员工。' },
  { id: 'active', label: '已发布', empty: '没有已发布的数字员工。' },
  { id: 'draft', label: '未发布', empty: '没有未发布的数字员工。' },
]

export default function EmployeesView({ onOpenTeam, initialOpenId }: { onOpenTeam: (teamId: string) => void; initialOpenId?: string }) {
  const { employees, createEmployee, pushEmployee, disableEmployee, deleteEmployee } = useWorkspace()
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null)
  const [statusTab, setStatusTab] = useState<'all' | 'active' | 'draft'>('all')
  const [creating, setCreating] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftDesc, setDraftDesc] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Employee | null>(null)

  const open = employees.find(employee => employee.id === openId) ?? null
  const inTab = useMemo(
    () => employees.filter(employee => statusTab === 'all' || employee.status === statusTab),
    [employees, statusTab],
  )
  const { page, setPage, pageCount, pageItems, total } = usePaged(inTab, 5)

  if (open) return <EmployeeDetail key={open.id} employee={open} onBack={() => setOpenId(null)} onOpenTeam={onOpenTeam} />

  return (
    <>
      <ViewHead
        view="employees"
        action={<button className="wv-btn primary" onClick={() => setCreating(true)}><Plus size={14} strokeWidth={2} /> 新建员工</button>}
      />

      <div className="wv-tabs">
        {STATUS_TABS.map(({ id, label }) => (
          <button
            key={id}
            className={`wv-tab${statusTab === id ? ' active' : ''}`}
            onClick={() => { setStatusTab(id); setPage(1) }}
          >
            {label}
            <span className="wv-tab-count">
              {id === 'all' ? employees.length : employees.filter(employee => employee.status === id).length}
            </span>
          </button>
        ))}
      </div>

      {!pageItems.length && <Empty text={STATUS_TABS.find(item => item.id === statusTab)!.empty} />}

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
                    ? <Badge kind="ok"><CheckCircle2 size={11} strokeWidth={2.2} /> 已发布</Badge>
                    : <Badge kind="draft"><CircleDot size={11} strokeWidth={2.2} /> 未发布</Badge>}
                </p>
                <p className="wv-row-sub">{employee.key} · r{employee.revision} · 更新于 {employee.updated} · {model} 项绑定</p>
                <p className="wv-row-desc">{employee.description}</p>
              </div>
              <div className="wv-row-actions">
                <button className="wv-btn" onClick={() => setOpenId(employee.id)}>配置</button>
                {active
                  ? <button className="wv-btn" onClick={() => disableEmployee(employee.id)}>停用</button>
                  : <button className="wv-btn primary" onClick={() => pushEmployee(employee.id)}>发布</button>}
                <button className="wv-btn ghost danger" disabled={active} onClick={() => setConfirmDelete(employee)}>删除</button>
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

/* 「资源绑定」的五个槽位。文案与顺序对齐真实应用的子页签：主模型排在最前，因为其余四
   类可以留空，而主模型没有就发布不了（workspace.pushEmployee 会拒绝）。 */
const BINDING_SLOTS: { id: ResourceKind; label: string }[] = [
  { id: 'model', label: '主模型' },
  { id: 'kb', label: '知识库' },
  { id: 'skill', label: 'Skill' },
  { id: 'connector', label: '连接器' },
  { id: 'sop', label: 'SOP' },
]

/* 「通用执行要求」的正文。逐字取自真实应用的 `EMPLOYEE_SYSTEM_INSTRUCTIONS`
   （apps/server/src/modules/governance/employees/runtime/employee-instructions.ts）：
   它由平台统一下发、配置页只读展示，不是这个员工自己的任务指令。 */
const PLATFORM_INSTRUCTIONS = `完成当前用户或组主管交给你的任务，保持原任务范围，不自行添加研究要求。
可以直接回答不需要外部证据的问题；需要资料时使用当前员工已绑定的知识库、Skill 和连接器，可以连续使用必要工具。
涉及绑定知识库的问题先检查该知识库 Workspace；全局法律检索是独立的可选来源，不能冒充绑定文件的检索结果。
证据足以回答后，直接给出答案及实际文件或来源引用，不强制额外规划、反思或无关检索。
任务适合已绑定 SOP 时，选择合法流程并准备业务输入；必要输入缺失时先询问。流程的节点顺序、分支和恢复由 Workflow 引擎执行。
用户明确指定或应用要求执行 SOP 时，必须执行对应流程；不能以普通回答替代，也不能自行换流程。
如实传递执行结果、挂起和错误；不调用备用模型、不用常识或缓存答案掩盖失败。`

type ChatMessage = { id: number; role: 'user' | 'assistant'; text: string }

function EmployeeDetail({ employee, onBack, onOpenTeam }: { employee: Employee; onBack: () => void; onOpenTeam: (teamId: string) => void }) {
  const { resources, teams, updateEmployee, pushEmployee, disableEmployee, deleteEmployee, notify } = useWorkspace()
  const [tab, setTab] = useState<'config' | 'debug'>('config')
  const [slot, setSlot] = useState<ResourceKind>('model')
  const [name, setName] = useState(employee.name)
  const [description, setDescription] = useState(employee.description)
  const [instructions, setInstructions] = useState(employee.instructions)
  const [bindings, setBindings] = useState<EmployeeBinding[]>(employee.bindings)
  const [requirementsOpen, setRequirementsOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [resourceId, setResourceId] = useState('')
  const [purpose, setPurpose] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [aiThread, setAiThread] = useState<ChatMessage[]>([])
  const [debugInput, setDebugInput] = useState('')
  const [debugThread, setDebugThread] = useState<ChatMessage[]>([])

  const kindOfId = (id: string) => resources.find(resource => resource.id === id)?.kind
  const slotLabel = BINDING_SLOTS.find(item => item.id === slot)!.label
  const hostingTeams = teams.filter(team => team.members.some(member => member.employeeId === employee.id))
  const slotBindings = bindings.filter(item => kindOfId(item.resourceId) === slot)
  const boundIds = new Set(bindings.map(item => item.resourceId))
  const candidates = resources.filter(resource => resource.published && resource.kind === slot && !boundIds.has(resource.id))
  const hasModel = bindings.some(item => kindOfId(item.resourceId) === 'model')

  /* 需求文档 7.2 要求「员工配置、资源绑定和执行计划应一次事务提交」，真实应用的配置页
     也是本地 form + 一次「保存更改」，所以下面几处增删都只改本地草稿。 */
  const dirty = name !== employee.name || description !== employee.description
    || instructions !== employee.instructions || bindings !== employee.bindings

  function save() {
    updateEmployee(employee.id, { name: name.trim(), description: description.trim(), instructions, bindings })
    notify('员工配置已保存，新版本从下一次任务开始生效。', 'ok')
  }

  function addBinding() {
    const resource = resources.find(item => item.id === resourceId)
    if (!resource) return
    const isModel = resource.kind === 'model'
    setBindings(current => [
      ...(isModel ? current.filter(item => kindOfId(item.resourceId) !== 'model') : current),
      { resourceId: resource.id, purpose: purpose.trim(), enabled: true },
    ])
    setPicking(false)
    notify(`已${isModel && hasModel ? '替换主模型为' : '加入'}「${resource.name}」，保存后生效。`, 'ok')
  }

  function removeBinding(id: string) {
    const resource = resources.find(item => item.id === id)
    setBindings(current => current.filter(item => item.resourceId !== id))
    notify(`已移除「${resource?.name ?? '该资源'}」，保存后生效。`)
  }

  function push(target: 'debug' | 'ai') {
    const text = (target === 'debug' ? debugInput : aiInput).trim()
    if (!text) return
    const reply = target === 'debug'
      ? `原型不驱动真实运行时：不调用模型、不执行工具、也没有 Agent stream。真实应用会用当前保存的配置（${employee.key} · r${employee.revision}）在 author_preview 上下文里执行一次，结果不写入正式项目会话。`
      : '原型不连接模型，这里不返回建议。真实应用中 AI 依据当前已保存的配置给出建议，由你编辑并保存。'
    if (target === 'debug') {
      setDebugInput('')
      setDebugThread(current => [...current, { id: current.length + 1, role: 'user', text }, { id: current.length + 2, role: 'assistant', text: reply }])
    } else {
      setAiInput('')
      setAiThread(current => [...current, { id: current.length + 1, role: 'user', text }, { id: current.length + 2, role: 'assistant', text: reply }])
    }
  }

  return (
    <DetailShell
      crumbs={
        <>
          <button onClick={onBack}>数字员工</button>
          <span className="wv-crumb-sep" aria-hidden="true">›</span>
          <span className="wv-crumb-here" title={employee.name}>{employee.name}</span>
        </>
      }
      title={employee.name}
      subtitle={`${employee.key} · revision r${employee.revision} · 更新于 ${employee.updated}`}
      badges={employee.status === 'active' ? <Badge kind="ok">已发布</Badge> : <Badge kind="draft">未发布</Badge>}
      actions={
        <>
          {employee.status === 'active'
            ? <button className="wv-btn" disabled={dirty} onClick={() => disableEmployee(employee.id)}><Power size={13} strokeWidth={1.9} /> 停用</button>
            : <button className="wv-btn primary" disabled={dirty} onClick={() => pushEmployee(employee.id)}>发布</button>}
          {employee.status === 'draft' && <button className="wv-btn ghost danger" disabled={dirty} onClick={() => setConfirmDelete(true)}>删除</button>}
        </>
      }
      onBack={onBack}
    >
      {hostingTeams.length > 0 && (
        <p className="wv-banner info">
          <ShieldAlert size={14} strokeWidth={2} />
          该员工正在 {hostingTeams.map(team => team.name).join('、')} 中担任成员，
          成员的资源绑定在启用中的组内由主管统一调度使用。
          <button className="wv-link" onClick={() => onOpenTeam(hostingTeams[0].id)}>查看员工组</button>
        </p>
      )}

      <div className="wv-tabs">
        <button className={`wv-tab${tab === 'config' ? ' active' : ''}`} onClick={() => setTab('config')}>配置</button>
        <button className={`wv-tab${tab === 'debug' ? ' active' : ''}`} onClick={() => setTab('debug')}>对话调试</button>
        <button className="wv-btn primary wv-tabs-tail" disabled={!dirty || !name.trim()} onClick={save}>保存更改</button>
      </div>

      {tab === 'config' ? (
        <div className="wv-es-board">
          <div className="wv-es-col">
            <section className="wv-ws-pane">
              <div className="wv-ws-head"><h2>基本信息</h2></div>
              <div className="wv-es-body">
                <label className="wv-es-field">
                  <span>名称</span>
                  <input className="wv-input" aria-label="员工名称" value={name} onChange={event => setName(event.target.value)} />
                </label>
                <label className="wv-es-field top">
                  <span>说明</span>
                  <textarea className="wv-textarea" aria-label="员工说明" rows={3} value={description} onChange={event => setDescription(event.target.value)} />
                </label>
              </div>
            </section>

            <section className="wv-ws-pane grow">
              <div className="wv-ws-head"><h2>资源绑定</h2></div>

              {/* 「添加X」跟子页签同行（真实应用是 justify-between 的一行），页签区
                  自己横向滚动，按钮固定在行的右端。 */}
              <div className="wv-es-subbar">
                <div className="wv-es-subtabs" role="tablist" aria-label="资源类型">
                  {BINDING_SLOTS.map(item => (
                    <button
                      key={item.id}
                      role="tab"
                      aria-selected={slot === item.id}
                      className={`wv-es-subtab${slot === item.id ? ' active' : ''}`}
                      onClick={() => setSlot(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <button className="wv-btn sm" onClick={() => { setResourceId(''); setPurpose(''); setPicking(true) }}>
                  添加{slotLabel}
                </button>
              </div>

              <div className="wv-es-table-wrap">
                <table className="wv-es-table">
                  <thead><tr><th>资源</th><th>操作</th></tr></thead>
                  <tbody>
                    {slotBindings.map(item => {
                      const resource = resources.find(candidate => candidate.id === item.resourceId)
                      return (
                        <tr key={item.resourceId}>
                          <td>
                            <span className="wv-es-res-name">{resource?.name ?? '资源已删除'}</span>
                            {/* 用途只在槽位名之外还有信息时才显示：主模型槽位下每行的用途都
                                是「主模型」，再印一遍只是噪音。 */}
                            {item.purpose && item.purpose !== slotLabel && <span className="wv-es-res-purpose">{item.purpose}</span>}
                          </td>
                          <td><button className="wv-btn ghost danger" onClick={() => removeBinding(item.resourceId)}>移除</button></td>
                        </tr>
                      )
                    })}
                    {!slotBindings.length && <tr><td className="wv-es-table-empty" colSpan={2}>暂无绑定</td></tr>}
                  </tbody>
                </table>
              </div>

              <div className="wv-es-foot">
                <span className="wv-es-foot-label"><Folder size={13} strokeWidth={1.9} /> 当前项目案卷</span>
                <span className="wv-es-pill" title="仅限有权限的当前项目">默认可读</span>
              </div>
            </section>
          </div>

          <div className="wv-es-col">
            <section className="wv-ws-pane grow">
              <div className="wv-ws-head">
                <h2>任务指令</h2>
                <span className="wv-es-note wv-ws-head-actions">Markdown</span>
              </div>
              <textarea
                className="wv-es-editor"
                aria-label="任务指令"
                placeholder="输入任务指令…"
                maxLength={INSTRUCTION_LIMIT}
                value={instructions}
                onChange={event => setInstructions(event.target.value)}
              />
              <div className="wv-es-foot stack">
                <button className="wv-es-toggle" aria-expanded={requirementsOpen} onClick={() => setRequirementsOpen(open => !open)}>
                  <ChevronRight size={13} strokeWidth={2.2} className={requirementsOpen ? 'open' : undefined} />
                  通用执行要求
                  <span className="wv-es-note">只读</span>
                </button>
                {requirementsOpen && <p className="wv-es-req">{PLATFORM_INSTRUCTIONS}</p>}
              </div>
            </section>
          </div>
        </div>
      ) : (
        <div className="wv-es-board">
          <div className="wv-es-col">
            <section className="wv-ws-pane grow">
              <div className="wv-ws-head"><h2>对话调试</h2></div>
              <div className="wv-ws-scroll">
                {debugThread.length ? (
                  <div className="wv-chat">
                    {debugThread.map(message => (
                      <div className={`wv-chat-msg ${message.role}`} key={message.id}><p>{message.text}</p></div>
                    ))}
                  </div>
                ) : (
                  <div className="wv-ws-empty">
                    <p className="wv-ws-empty-title">对话调试</p>
                    <p className="wv-ws-empty-desc">
                      {dirty ? '请先保存修改，再调试当前配置。' : '输入任务，使用当前保存的配置执行。'}
                    </p>
                  </div>
                )}
              </div>
              <div className="wv-ws-composer">
                <input
                  className="wv-input"
                  aria-label="调试任务"
                  placeholder="输入任务，回车测试"
                  disabled={dirty}
                  value={debugInput}
                  onChange={event => setDebugInput(event.target.value)}
                  onKeyDown={event => { if (event.key === 'Enter') push('debug') }}
                />
                <button className="wv-btn primary" disabled={dirty || !debugInput.trim()} onClick={() => push('debug')}>发送</button>
              </div>
            </section>
          </div>

          <div className="wv-es-col">
            <section className="wv-ws-pane grow">
              <div className="wv-ws-head"><h2>Traces 数据</h2></div>
              <div className="wv-ws-scroll">
                <div className="wv-ws-empty">
                  <p className="wv-ws-empty-title">没有 Trace 数据</p>
                  <p className="wv-ws-empty-desc">原型不接运行时；真实应用中这里显示本次调试的执行轨迹。</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {aiOpen ? (
        <aside className="wv-modal wv-ai-float" role="dialog" aria-label="数字员工 AI 创建会话">
          <div className="wv-modal-head">
            <h2>数字员工 AI 助手</h2>
            <button className="wv-icon-btn" aria-label="收起 AI 会话" onClick={() => setAiOpen(false)}>
              <Minus size={16} strokeWidth={2} />
            </button>
          </div>
          <div className="wv-ai-float-body">
            {!aiThread.length ? (
              <div className="wv-ws-empty">
                <p className="wv-ws-empty-title">描述你想创建的数字员工</p>
                <p className="wv-ws-empty-desc">AI 依据当前已保存的配置提出建议，由你编辑并保存；不会自动装配、测试或启用。</p>
              </div>
            ) : (
              <div className="wv-chat">
                {aiThread.map(message => (
                  <div className={`wv-chat-msg ${message.role}`} key={message.id}><p>{message.text}</p></div>
                ))}
              </div>
            )}
          </div>
          <div className="wv-ai-float-foot">
            <input
              className="wv-input"
              aria-label="AI 会话消息"
              value={aiInput}
              placeholder="例如：帮我做一个劳动合规审查员"
              onChange={event => setAiInput(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter') push('ai') }}
            />
            <button className="wv-btn primary" disabled={!aiInput.trim()} onClick={() => push('ai')}>发送</button>
          </div>
        </aside>
      ) : (
        <button className="wv-ai-fab" onClick={() => setAiOpen(true)}>
          <Sparkles size={14} strokeWidth={2} /> AI 会话
        </button>
      )}

      {picking && (
        <Modal
          title={`添加${slotLabel}`}
          desc="下拉里只列出该类已发布、且尚未绑定的资源。"
          onClose={() => setPicking(false)}
          footer={
            <>
              <button className="wv-btn" onClick={() => setPicking(false)}>取消</button>
              <button className="wv-btn primary" disabled={!resourceId} onClick={addBinding}>绑定</button>
            </>
          }
        >
          <Field label="资源" hint={candidates.length ? undefined : '该类下没有可绑定的已发布资源。'}>
            <select className="wv-select" value={resourceId} onChange={event => setResourceId(event.target.value)}>
              <option value="">请选择资源</option>
              {candidates.map(resource => (
                <option key={resource.id} value={resource.id}>{resource.name}（{resource.key}）</option>
              ))}
            </select>
          </Field>
          <Field label="用途" hint="说明这个资源在任务里承担什么角色，会写入装配信息。">
            <input className="wv-input" value={purpose} onChange={event => setPurpose(event.target.value)} placeholder="例如：条款风险判断方法" />
          </Field>
        </Modal>
      )}

      {confirmDelete && (
        <Modal
          title="删除数字员工"
          desc="只有未发布的员工可以删除，已发布员工需要先停用。"
          onClose={() => setConfirmDelete(false)}
          footer={
            <>
              <button className="wv-btn" onClick={() => setConfirmDelete(false)}>取消</button>
              <button className="wv-btn danger" onClick={() => deleteEmployee(employee.id)}>确认删除</button>
            </>
          }
        >
          <p className="wv-note">即将删除：{employee.name}</p>
        </Modal>
      )}
    </DetailShell>
  )
}
