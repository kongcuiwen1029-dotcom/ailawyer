import { useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  FileText,
  Plug,
  Plus,
  Play,
  Search,
  Server,
  ShieldAlert,
  Upload,
  Workflow,
  Wrench,
  Zap,
} from 'lucide-react'
import {
  useWorkspace,
  type GovernanceResource,
  type ResourceKind,
  type SopNode,
} from '../state/workspace'
import { Badge, DetailShell, Empty, Field, Modal, Pager, Section, ViewHead, usePaged } from '../ui/parts'

const TABS: { id: ResourceKind; label: string; icon: typeof Database }[] = [
  { id: 'kb', label: '知识库', icon: Database },
  { id: 'skill', label: 'Skill', icon: Wrench },
  { id: 'connector', label: 'Connector', icon: Plug },
  { id: 'sop', label: 'SOP', icon: Workflow },
  { id: 'model', label: '模型', icon: Cpu },
]

const KIND_TITLE: Record<ResourceKind, string> = { kb: '知识库', skill: 'Skill', connector: 'Connector', sop: 'SOP', model: '模型连接' }

export default function ResourcesView() {
  const { resources, createResource, toggleResourcePublished } = useWorkspace()
  const [tab, setTab] = useState<ResourceKind>('kb')
  const [query, setQuery] = useState('')
  const [publishedOnly, setPublishedOnly] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftSummary, setDraftSummary] = useState('')

  const open = resources.find(resource => resource.id === openId) ?? null

  const inTab = useMemo(() => resources.filter(resource => resource.kind === tab)
    .filter(resource => !publishedOnly || resource.published)
    .filter(resource => !query.trim() || `${resource.name}${resource.key}${resource.summary}`.toLowerCase().includes(query.trim().toLowerCase())),
  [resources, tab, publishedOnly, query])

  const { page, setPage, pageCount, pageItems, total } = usePaged(inTab, 5)

  if (open) return <ResourceDetail key={open.id} resource={open} onBack={() => setOpenId(null)} />

  return (
    <>
      <ViewHead
        view="resources"
        action={
          <>
            <button className="wv-btn" onClick={() => setPublishedOnly(value => !value)}>
              {publishedOnly ? '显示全部' : '只看已发布'}
            </button>
            <button className="wv-btn primary" onClick={() => { setCreating(true); setDraftName(''); setDraftSummary('') }}>
              <Plus size={14} strokeWidth={2} /> 创建资源
            </button>
          </>
        }
      />

      <div className="wv-tabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`wv-tab${tab === id ? ' active' : ''}`} onClick={() => { setTab(id); setPage(1) }}>
            <Icon size={14} strokeWidth={1.9} /> {label}
          </button>
        ))}
      </div>

      <div className="wv-filter">
        <div className="wv-search">
          <Search size={14} strokeWidth={1.9} />
          <input className="wv-input" placeholder={`搜索${KIND_TITLE[tab]}名称、key 或说明`} value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} />
        </div>
        <span className="wv-filter-note">共 {inTab.length} 个{KIND_TITLE[tab]}资源</span>
      </div>

      {!pageItems.length && <Empty text="没有符合条件的资源。" />}

      <div className="wv-list">
        {pageItems.map(resource => {
          const Icon = TABS.find(item => item.id === resource.kind)!.icon
          return (
            <div className="wv-row" key={resource.id}>
              <div className="wv-ico"><Icon size={18} strokeWidth={1.8} /></div>
              <div className="wv-row-main">
                <p className="wv-row-title">
                  {resource.name}
                  {resource.published ? <Badge kind="ok">已发布</Badge> : <Badge kind="draft">未发布</Badge>}
                  {resource.kind === 'sop' && (resource.validationErrors?.length ?? 0) > 0 && <Badge kind="warn">校验未通过</Badge>}
                  {resource.kind === 'model' && resource.capability?.status === 'warn' && <Badge kind="warn">连接未通过</Badge>}
                </p>
                <p className="wv-row-sub">{resource.key} · {resourceMeta(resource)} · r{resource.revision} · {resource.updated}</p>
                <p className="wv-row-desc">{resource.summary}</p>
              </div>
              <div className="wv-row-actions">
                <button className="wv-btn" onClick={() => setOpenId(resource.id)}>详情</button>
                <button className="wv-btn" onClick={() => toggleResourcePublished(resource.id)}>{resource.published ? '取消发布' : '发布'}</button>
              </div>
            </div>
          )
        })}
      </div>

      <Pager page={page} pageCount={pageCount} onPage={setPage} total={total} size={5} />

      {creating && (
        <Modal
          title={`创建${KIND_TITLE[tab]}资源`}
          desc="新建资源默认是未发布状态，配置完成并保存后才能发布。"
          onClose={() => setCreating(false)}
          footer={
            <>
              <button className="wv-btn" onClick={() => setCreating(false)}>取消</button>
              <button className="wv-btn primary" disabled={!draftName.trim()} onClick={() => { const id = createResource(tab, draftName.trim(), draftSummary.trim()); setCreating(false); setOpenId(id) }}>
                创建并配置
              </button>
            </>
          }
        >
          <Field label="资源名称">
            <input className="wv-input" value={draftName} onChange={event => setDraftName(event.target.value)} placeholder="例如：股权转让范本库" />
          </Field>
          <Field label="用途说明" hint="这段说明会出现在员工的绑定选择器里，建议写清楚适用场景。">
            <textarea className="wv-textarea" rows={3} value={draftSummary} onChange={event => setDraftSummary(event.target.value)} />
          </Field>
        </Modal>
      )}
    </>
  )
}

function resourceMeta(resource: GovernanceResource) {
  if (resource.kind === 'kb') return `${resource.files?.length ?? 0} 个文件`
  if (resource.kind === 'skill') return `${resource.files?.length ?? 0} 个文件 · 证据要求 + 输出 Schema`
  if (resource.kind === 'connector') return `${resource.connectorType?.toUpperCase()} · ${resource.tools?.length ?? 0} 个工具`
  if (resource.kind === 'sop') return `${resource.nodes?.length ?? 0} 个节点 · ${resource.edges?.length ?? 0} 条连线`
  return `${resource.models?.length ?? 0} 个 Model ID · 默认 ${resource.defaultModel || '未指定'}`
}

/* ───────────────────────── detail ───────────────────────── */

function ResourceDetail({ resource, onBack }: { resource: GovernanceResource; onBack: () => void }) {
  const { toggleResourcePublished } = useWorkspace()
  const blocked = resource.kind === 'sop' && (resource.validationErrors?.length ?? 0) > 0

  return (
    <DetailShell
      title={resource.name}
      subtitle={`${resource.key} · 负责人 ${resource.owner} · 更新于 ${resource.updated} · revision r${resource.revision}`}
      badges={
        <>
          <Badge kind={resource.published ? 'ok' : 'draft'}>{resource.published ? '已发布' : '未发布'}</Badge>
          {blocked && <Badge kind="warn">校验未通过</Badge>}
        </>
      }
      actions={
        <>
          <button className="wv-btn" onClick={() => toggleResourcePublished(resource.id)}>{resource.published ? '取消发布' : '发布'}</button>
        </>
      }
      onBack={onBack}
    >
      <p className="wv-note">{resource.summary}</p>

      {resource.kind === 'kb' && <KnowledgeBaseDetail resource={resource} />}
      {resource.kind === 'skill' && <SkillDetail resource={resource} />}
      {resource.kind === 'connector' && <ConnectorDetail resource={resource} />}
      {resource.kind === 'sop' && <SopDetail resource={resource} />}
      {resource.kind === 'model' && <ModelDetail resource={resource} />}
    </DetailShell>
  )
}

/* ── 知识库 ── */

function KnowledgeBaseDetail({ resource }: { resource: GovernanceResource }) {
  const { addKnowledgeFile, removeKnowledgeFile, notify } = useWorkspace()
  const inputRef = useRef<HTMLInputElement>(null)
  const files = resource.files ?? []

  function handleFiles(list: FileList | null) {
    if (!list) return
    const batch = new Map<string, File>()
    Array.from(list).forEach(file => {
      const allowed = /\.(md|txt)$/i.test(file.name)
      if (!allowed) {
        notify(`「${file.name}」不是 .md 或 .txt，已拒绝上传。`, 'warn')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        notify(`「${file.name}」超过 5 MiB 单文件上限，已拒绝上传。`, 'warn')
        return
      }
      batch.set(file.name, file)
    })
    batch.forEach(file => addKnowledgeFile(resource.id, file.name, `${Math.max(1, Math.round(file.size / 1024))} KB`))
  }

  return (
    <>
      <Section
        title="知识库文件"
        hint="只接受 .md 与 .txt，单文件不超过 5 MiB；文本切分与向量化由平台自动完成。"
        action={
          <>
            <input ref={inputRef} type="file" accept=".md,.txt" multiple hidden onChange={event => { handleFiles(event.target.files); event.target.value = '' }} />
            <button className="wv-btn primary" onClick={() => inputRef.current?.click()}><Upload size={13} strokeWidth={1.9} /> 上传文件</button>
          </>
        }
      >
        {!files.length && <Empty text="还没有文件，上传后员工才能检索到内容。" />}
        <div className="wv-list tight">
          {files.map(file => (
            <div className="wv-row" key={file.name}>
              <div className="wv-ico"><FileText size={16} strokeWidth={1.8} /></div>
              <div className="wv-row-main">
                <p className="wv-row-title">{file.name} {file.parsed ? <Badge kind="ok">已解析</Badge> : <Badge kind="warn">等待解析</Badge>}</p>
                <p className="wv-row-sub">{file.size} · 上传于 {file.uploadedAt}</p>
              </div>
              <div className="wv-row-actions">
                <button className="wv-btn ghost danger" onClick={() => removeKnowledgeFile(resource.id, file.name)}>删除</button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="员工侧可见范围" hint="知识库对员工只暴露只读工作区工具，不提供写入与执行能力。">
        <div className="wv-chips">
          {['stat', 'list_files', 'read_file', 'grep'].map(tool => <span className="wv-chip2" key={tool}>{tool}</span>)}
        </div>
        <p className="wv-note">会话内的知识库问答按 1024 token、90 秒、最多 8 步的固定预算执行；超时或超步会显式返回错误，不做隐式重试。</p>
      </Section>
    </>
  )
}

/* ── Skill ── */

function SkillDetail({ resource }: { resource: GovernanceResource }) {
  const files = resource.files ?? []
  const grouped = useMemo(() => {
    const map = new Map<string, typeof files>()
    files.forEach(file => {
      const dir = file.name.includes('/') ? file.name.slice(0, file.name.lastIndexOf('/')) : '根目录'
      map.set(dir, [...(map.get(dir) ?? []), file])
    })
    return Array.from(map.entries())
  }, [files])

  return (
    <>
      <Section title="Skill 目录" hint="上限：200 个文件、单文件 5 MiB、整棵目录 20 MiB、单个路径 240 字节。">
        {grouped.map(([dir, entries]) => (
          <div className="wv-tree" key={dir}>
            <p className="wv-tree-dir">{dir}</p>
            {entries.map(file => (
              <div className="wv-tree-row" key={file.name}>
                <FileText size={13} strokeWidth={1.8} />
                <span className="wv-tree-name">{file.name.split('/').pop()}</span>
                <span className="wv-tree-size">{file.size}</span>
              </div>
            ))}
          </div>
        ))}
        {!files.length && <Empty text="还没有 Skill 文件。SKILL.md 是必需的入口文件。" />}
      </Section>

      <Section title="使用约定" hint="Skill 决定证据要求与输出结构，员工只能绑定已发布的版本。">
        <ul className="wv-bullets">
          <li>入口文件必须是 <code>SKILL.md</code>，同伴文件按需读取。</li>
          <li>输出 Schema 由 <code>schema/output.json</code> 声明，运行时按 Schema 校验。</li>
          <li>Skill 内的指令不覆盖员工自身的执行指令；两者冲突时以员工指令为准。</li>
        </ul>
      </Section>
    </>
  )
}

/* ── Connector ── */

interface TestMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  trace?: { tool: string; args: string; result: string; ok: boolean }[]
}

function ConnectorDetail({ resource }: { resource: GovernanceResource }) {
  const { addConnectorTool, notify } = useWorkspace()
  const [toolName, setToolName] = useState('')
  const [toolDesc, setToolDesc] = useState('')
  const [toolWrite, setToolWrite] = useState(false)
  const [adding, setAdding] = useState(false)
  const [messages, setMessages] = useState<TestMessage[]>([])
  const [input, setInput] = useState('')
  const [toolsDisabled, setToolsDisabled] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const tools = resource.tools ?? []

  function send() {
    const text = input.trim()
    if (!text) return
    const willUseTool = !toolsDisabled && /检索|查|法条|案例|公司法|民法典/.test(text)
    const isBroken = !toolsDisabled && /错误|失败|超时/.test(text)
    const next: TestMessage[] = [...messages, { id: `u-${Date.now()}`, role: 'user', text }]

    if (isBroken) {
      next.push({
        id: `a-${Date.now()}`, role: 'assistant',
        text: '连接器调用返回错误。按契约本次不重试，连接器工具已在本会话内停用；你可以继续普通问答，或修复配置后重新发起测试会话。',
        trace: [{ tool: loaded ? 'search_law' : 'load_connector_tools', args: '{"query":"' + text.slice(0, 12) + '"}', result: 'CONNECTOR_TOOL_CALL_FAILED: 远端返回 502', ok: false }],
      })
      setToolsDisabled(true)
    } else if (willUseTool) {
      next.push({
        id: `a-${Date.now()}`, role: 'assistant',
        text: `已按需加载连接器工具并完成调用，命中 ${Math.floor(Math.random() * 4) + 3} 条来源，结果已标注来源与时效。`,
        trace: [
          ...(loaded ? [] : [{ tool: 'load_connector_tools', args: '{}', result: '注册连接器工具（本次会话首次调用）', ok: true }]),
          { tool: tools[0]?.name ?? 'search_law', args: JSON.stringify({ query: text.slice(0, 16) }), result: '返回 5 条结果', ok: true },
        ],
      })
      setLoaded(true)
    } else {
      next.push({
        id: `a-${Date.now()}`, role: 'assistant',
        text: toolsDisabled
          ? '普通问答回答：未使用连接器（本会话连接器工具已停用）。'
          : '普通问答回答：本次没有调用连接器，远端连接保持关闭，只有需要外部信息时才按需加载工具。',
      })
    }
    setMessages(next)
    setInput('')
  }

  return (
    <>
      <Section
        title="连接配置"
        hint="MCP 走 SSE 握手，HTTP 按方法 + Endpoint 调用；密钥在保存时加密，不回显明文。"
        action={
          <button
            className="wv-btn"
            onClick={() => notify(`已重新握手：${resource.endpoint || '未配置 Endpoint'}`, resource.endpoint ? 'ok' : 'warn')}
          >
            <Zap size={13} strokeWidth={1.9} /> 重新握手
          </button>
        }
      >
        <div className="wv-kv">
          <div><span>类型</span><b>{resource.connectorType === 'http' ? 'HTTP' : 'MCP（SSE）'}</b></div>
          <div><span>Endpoint</span><b>{resource.endpoint || '未配置'}</b></div>
          {resource.connectorType === 'http' && <div><span>请求方法</span><b>{resource.httpMethod ?? 'GET'}</b></div>}
          <div><span>握手状态</span><b>{resource.handshakeAt ?? '尚未握手'}</b></div>
          <div><span>调用方式</span><b>按需加载 · 不预连接</b></div>
        </div>
      </Section>

      <Section
        title="工具清单"
        hint="工具名在同一连接器内必须唯一；标记为写操作的工具在员工侧需要额外确认。"
        action={<button className="wv-btn" onClick={() => setAdding(true)}><Plus size={13} strokeWidth={2} /> 添加工具</button>}
      >
        {!tools.length && <Empty text="还没有注册工具。MCP 连接器握手后会自动发现工具；HTTP 连接器需要手工登记。" />}
        <div className="wv-list tight">
          {tools.map(tool => (
            <div className="wv-row" key={tool.name}>
              <div className="wv-ico"><Server size={16} strokeWidth={1.8} /></div>
              <div className="wv-row-main">
                <p className="wv-row-title">{tool.name} {tool.write ? <Badge kind="warn">写操作</Badge> : <Badge kind="ok">只读</Badge>}</p>
                <p className="wv-row-sub">{tool.description}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="测试会话" hint="只在测试会话里按需加载工具：首次调用远端时才注册，失败后本会话不再重试，工具同时停用。">
        {toolsDisabled && (
          <p className="wv-banner warn"><ShieldAlert size={14} strokeWidth={2} /> 本会话连接器工具已停用（上一次调用失败且不重试）。重新打开测试会话可恢复。</p>
        )}
        <div className="wv-chat">
          {!messages.length && <p className="wv-empty">试着输入「检索公司法关于股东出资的规定」，或输入「调用失败」看错误处理。</p>}
          {messages.map(message => (
            <div className={`wv-chat-msg ${message.role}`} key={message.id}>
              <p>{message.text}</p>
              {message.trace && (
                <div className="wv-chat-trace">
                  {message.trace.map((entry, index) => (
                    <div className={`wv-chat-tool${entry.ok ? '' : ' bad'}`} key={index}>
                      {entry.ok ? <CheckCircle2 size={12} strokeWidth={2.2} /> : <AlertTriangle size={12} strokeWidth={2.2} />}
                      <code>{entry.tool}</code>
                      <span className="wv-chat-args">{entry.args}</span>
                      <span className="wv-chat-result">{entry.result}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="wv-chat-input">
          <input
            className="wv-input"
            value={input}
            placeholder="在这个测试会话里提问……"
            onChange={event => setInput(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') send() }}
          />
          <button className="wv-btn primary" disabled={!input.trim()} onClick={send}>发送</button>
          <button className="wv-btn ghost" onClick={() => { setMessages([]); setToolsDisabled(false); setLoaded(false) }}>重开会话</button>
        </div>
      </Section>

      {adding && (
        <Modal
          title="添加工具"
          desc="工具名会作为函数名暴露给模型，重名会被拒绝。"
          onClose={() => setAdding(false)}
          footer={
            <>
              <button className="wv-btn" onClick={() => setAdding(false)}>取消</button>
              <button
                className="wv-btn primary"
                disabled={!toolName.trim()}
                onClick={() => { addConnectorTool(resource.id, { name: toolName.trim(), description: toolDesc.trim() || '未填写说明', write: toolWrite }); setAdding(false); setToolName(''); setToolDesc(''); setToolWrite(false) }}
              >
                添加
              </button>
            </>
          }
        >
          <Field label="工具名" hint="建议 snake_case，例如 search_law。">
            <input className="wv-input" value={toolName} onChange={event => setToolName(event.target.value)} />
          </Field>
          <Field label="工具说明" hint="模型依据这句话决定何时调用，写清楚输入与返回。">
            <textarea className="wv-textarea" rows={3} value={toolDesc} onChange={event => setToolDesc(event.target.value)} />
          </Field>
          <label className="wv-check">
            <input type="checkbox" checked={toolWrite} onChange={event => setToolWrite(event.target.checked)} />
            <span>这是写操作（会修改外部系统）</span>
          </label>
        </Modal>
      )}
    </>
  )
}

/* ── SOP ── */

const NODE_KIND_LABEL: Record<SopNode['kind'], string> = {
  start: '开始', end: '结束', agent: 'Agent 节点', tool: '工具节点', workflow: '子流程', condition: '条件分支', loop: '循环',
}

function SopDetail({ resource }: { resource: GovernanceResource }) {
  const { notify } = useWorkspace()
  const nodes = resource.nodes ?? []
  const edges = resource.edges ?? []
  const errors = resource.validationErrors ?? []
  const blocked = errors.length > 0

  const order = useMemo(() => {
    const byId = new Map(nodes.map(node => [node.id, node]))
    const start = nodes.find(node => node.kind === 'start') ?? nodes[0]
    const visited: SopNode[] = []
    const seen = new Set<string>()
    const queue: SopNode[] = start ? [start] : []
    while (queue.length) {
      const node = queue.shift()!
      if (!node || seen.has(node.id)) continue
      seen.add(node.id)
      visited.push(node)
      edges.filter(edge => edge.from === node.id).forEach(edge => {
        const next = byId.get(edge.to)
        if (next) queue.push(next)
      })
    }
    nodes.filter(node => !seen.has(node.id)).forEach(node => visited.push(node))
    return visited
  }, [nodes, edges])

  return (
    <>
      {blocked && (
        <p className="wv-banner warn">
          <AlertTriangle size={14} strokeWidth={2} />
          校验未通过：{errors.join('；')} 保存、发布与试跑都会被阻止。
        </p>
      )}
      {!blocked && <p className="wv-banner ok"><CheckCircle2 size={14} strokeWidth={2} /> 校验通过：主流程从开始走到结束，所有分支已汇合。</p>}

      <Section title="编译预览" hint="业务语言的条件与循环在保存时编译成 DSL；编译失败会以节点错误的形式返回，不需要手工改 DSL。">
        <ol className="wv-flow">
          {order.map((node, index) => (
            <li className={`wv-flow-item${node.wired ? '' : ' unwired'}`} key={node.id}>
              <span className="wv-flow-index">{index + 1}</span>
              <div className="wv-flow-body">
                <p className="wv-flow-title">
                  {node.title}
                  <span className="wv-chip2">{NODE_KIND_LABEL[node.kind]}</span>
                  {!node.wired && <Badge kind="warn">游离节点</Badge>}
                </p>
                {node.ref && <p className="wv-row-sub">引用：{node.ref}</p>}
                {node.note && <p className="wv-row-sub">条件：{node.note}</p>}
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="节点与连线" hint="节点 id 与连线只用于画布展示，运行期按编译后的步骤执行。">
        <div className="wv-kv">
          <div><span>节点数</span><b>{nodes.length}</b></div>
          <div><span>连线数</span><b>{edges.length}</b></div>
          <div><span>游离节点</span><b>{nodes.filter(node => !node.wired).length}</b></div>
        </div>
        <div className="wv-list tight">
          {edges.map(edge => (
            <div className="wv-edge" key={`${edge.from}-${edge.to}`}>
              <code>{edge.from}</code>
              <span>→</span>
              <code>{edge.to}</code>
            </div>
          ))}
        </div>
      </Section>

      <Section title="依赖资源" hint="依赖在运行前解析；被依赖资源取消发布不会影响已冻结的版本。">
        {(resource.dependencies ?? []).length ? (
          <div className="wv-chips">
            {resource.dependencies!.map(dependency => <span className="wv-chip2" key={dependency}>{dependency}</span>)}
          </div>
        ) : <Empty text="没有声明依赖资源。" />}
      </Section>

      <div className="wv-toolbar end">
        <button
          className="wv-btn"
          onClick={() => notify(blocked ? '试跑被阻止：请先修复校验错误。' : '已发起试跑。', blocked ? 'warn' : 'ok')}
        >
          <Play size={13} strokeWidth={1.9} /> 试跑
        </button>
      </div>
    </>
  )
}

/* ── 模型 ── */

function ModelDetail({ resource }: { resource: GovernanceResource }) {
  const { updateResource, notify } = useWorkspace()
  const [testing, setTesting] = useState(false)

  return (
    <>
      <Section title="连接配置" hint="Endpoint Host 需要落在平台允许列表内，否则保存会被拒绝。">
        <div className="wv-kv">
          <div><span>Base URL</span><b>{resource.baseUrl || '未填写'}</b></div>
          <div><span>密钥</span><b>{resource.keyMasked}</b></div>
          <div><span>默认 Model ID</span><b>{resource.defaultModel || '未指定'}</b></div>
          <div><span>已登记 Model ID</span><b>{(resource.models ?? []).join('、') || '无'}</b></div>
        </div>
        <div className="wv-toolbar">
          <button
            className="wv-btn primary"
            disabled={testing}
            onClick={() => {
              const missing = !resource.baseUrl
                ? 'Base URL 未填写'
                : (resource.models ?? []).length === 0 ? '尚未登记任何 Model ID' : ''
              const failure = missing
                ? `${missing}，无法完成能力测试`
                : resource.capability?.status === 'warn' ? resource.capability.note : ''
              setTesting(true)
              window.setTimeout(() => {
                updateResource(resource.id, {
                  capability: failure
                    ? { status: 'warn', note: failure }
                    : { status: 'ok', latencyMs: 700 + Math.floor(Math.random() * 700), note: '能力测试通过 · 流式与工具调用可用' },
                })
                notify(failure ? `能力测试失败：${failure}。` : '能力测试通过：流式输出与工具调用均可用。', failure ? 'warn' : 'ok')
                setTesting(false)
              }, 900)
            }}
          >
            <Zap size={13} strokeWidth={1.9} /> {testing ? '测试中…' : '测试能力'}
          </button>
        </div>
      </Section>

      <Section title="能力状态" hint="只有保存成功且测试通过的模型才能发布，然后被数字员工绑定为主模型。">
        <div className={`wv-banner ${resource.capability?.status === 'warn' ? 'warn' : resource.capability?.status === 'ok' ? 'ok' : 'info'}`}>
          {resource.capability?.status === 'ok' ? <CheckCircle2 size={14} strokeWidth={2} /> : resource.capability?.status === 'warn' ? <AlertTriangle size={14} strokeWidth={2} /> : <Cpu size={14} strokeWidth={2} />}
          {resource.capability?.note ?? '尚未测试'}
          {resource.capability?.latencyMs ? ` · 首字延迟约 ${resource.capability.latencyMs} ms` : ''}
        </div>
      </Section>
    </>
  )
}
