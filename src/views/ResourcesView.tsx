import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Database,
  FileText,
  Minus,
  Plug,
  Plus,
  Play,
  Search,
  Server,
  ShieldAlert,
  Sparkles,
  Trash2,
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
import { Badge, DetailShell, Drawer, Empty, Field, Modal, Pager, Section, ViewHead, usePaged } from '../ui/parts'

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
  const { toggleResourcePublished, deleteResource } = useWorkspace()
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const blocked = resource.kind === 'sop' && (resource.validationErrors?.length ?? 0) > 0

  return (
    <>
      <DetailShell
        crumbs={
          <>
            <button type="button" onClick={onBack}>资源市场</button>
            <span className="wv-crumb-sep" aria-hidden="true">›</span>
            <button type="button" onClick={onBack}>{KIND_TITLE[resource.kind]}</button>
            <span className="wv-crumb-sep" aria-hidden="true">›</span>
            <span className="wv-crumb-here" title={resource.name}>{resource.name}</span>
          </>
        }
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
            <button className="wv-btn" onClick={() => setDetailsOpen(true)}>详情</button>
            <button
              className="wv-btn ghost danger"
              disabled={resource.published}
              title={resource.published ? '已发布的资源不能删除，请先取消发布' : undefined}
              onClick={() => setConfirming(true)}
            >
              删除
            </button>
          </>
        }
        onBack={onBack}
      >
        {resource.kind === 'kb' && <KnowledgeBaseDetail resource={resource} />}
        {resource.kind === 'skill' && <SkillDetail resource={resource} />}
        {resource.kind === 'connector' && <ConnectorDetail resource={resource} />}
        {resource.kind === 'sop' && <SopDetail resource={resource} />}
        {resource.kind === 'model' && <ModelDetail resource={resource} />}
      </DetailShell>

      {detailsOpen && <ResourceMetaSheet resource={resource} onClose={() => setDetailsOpen(false)} />}

      {confirming && (
        <Modal
          title="删除资源"
          desc="删除后无法恢复，请确认这个资源已经不再需要。"
          onClose={() => setConfirming(false)}
          footer={
            <>
              <button className="wv-btn" onClick={() => setConfirming(false)}>取消</button>
              <button
                className="wv-btn danger"
                onClick={() => { setConfirming(false); deleteResource(resource.id); onBack() }}
              >
                确认删除
              </button>
            </>
          }
        >
          <p className="wv-note" style={{ marginTop: 0 }}>「{resource.name}」会从资源市场移除；已绑定它的数字员工会同时解除绑定。</p>
        </Modal>
      )}
    </>
  )
}

/* 资源元数据抽屉，对应真实应用资源详情页 Header 上的「详情」按钮。字段只取原型数据
   模型里真有的：基本信息那五条与真实应用那张 Sheet 一一对应，「内容修订」对应
   `revision`、「更新时间」对应 `updated`。真实应用的 Sheet 另有创建时间与发布
   时间，原型没有这两个字段，这里就不显示，也不另造演示值。 */
function ResourceMetaSheet({ resource, onClose }: { resource: GovernanceResource; onClose: () => void }) {
  const kind = KIND_TITLE[resource.kind]
  return (
    <Drawer title={`${kind}详情`} desc={`查看当前${kind}的编辑、发布和内容修订信息。`} onClose={onClose}>
      <div className="wv-meta-group">
        <h3>基本信息</h3>
        <dl className="wv-meta-list">
          <MetaRow label="名称" value={resource.name} />
          <MetaRow label="资源标识" value={resource.key} />
          <MetaRow label="描述" value={resource.summary || '暂无描述'} />
          <MetaRow label="资源 ID" value={resource.id} />
          <MetaRow label="所有者" value={resource.owner} />
        </dl>
      </div>

      <div className="wv-meta-group">
        <h3>编辑与发布</h3>
        <dl className="wv-meta-list">
          <div className="wv-meta-row">
            <dt>发布状态</dt>
            <dd><Badge kind={resource.published ? 'ok' : 'draft'}>{resource.published ? '已发布' : '未发布'}</Badge></dd>
          </div>
          <MetaRow label="内容修订" value={`#${resource.revision}`} />
          <MetaRow label="更新时间" value={resource.updated} />
        </dl>
        {/* 真实应用把这句话夹在「发布状态」与「内容修订」之间，这里挪到列表末尾：一句话
            插在中间会把字段列表切成两张卡，第一张只剩孤零零一行。字段的内容和先后都没变。 */}
        {resource.kind === 'kb' && (
          <p className="wv-meta-note">文件上传或移除时会同步更新当前结构；发布只切换在线状态。</p>
        )}
      </div>
    </Drawer>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="wv-meta-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

/* ── 知识库 ── */

/* 知识库详情的正文工作区，对齐真实应用的三栏：左「文件」、中「文件名 + 正文」、
   右「文件问答」，两条分隔条都能拖。宽度取真实应用那套默认值与上下限（左 17rem
   / 13–30rem，右 22rem / 18–44rem），中栏自适应；左栏可以折成一条窄列，折起来
   还要留宽度——不然展开按钮自己没有落脚的地方。 */
const FILES_DEFAULT = 272
const FILES_MIN = 208
const FILES_MAX = 480
const FILES_COLLAPSED = 44
const CHAT_DEFAULT = 352
const CHAT_MIN = 288
const CHAT_MAX = 704

interface WorkspaceMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** 拖动分隔条。用指针增量改宽度，上下限交给调用方——两个分隔条方向相反，
    钳制规则只能由持有那个宽度的地方给。 */
function Divider({ label, gap, onDrag }: { label: string; gap?: boolean; onDrag: (deltaX: number) => void }) {
  return (
    <div
      className={`wv-ws-divider${gap ? ' gap' : ''}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      onPointerDown={event => {
        event.preventDefault()
        let last = event.clientX
        const move = (moveEvent: PointerEvent) => {
          onDrag(moveEvent.clientX - last)
          last = moveEvent.clientX
        }
        const stop = () => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', stop)
          document.body.classList.remove('wv-resizing')
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', stop)
        document.body.classList.add('wv-resizing')
      }}
    />
  )
}

/* 原型不装 markdown 渲染器，这里按行做最小渲染：`#` 标题、`- ` 列表、`> ` 引用，
   其余按段落。非 .md 的文件（.txt）一律走 `pre` 保留原始排版，真实应用也是这么分的。 */
function DocumentBody({ name, content }: { name: string; content: string }) {
  if (!/\.md$/i.test(name)) return <pre className="wv-ws-pre">{content}</pre>

  const lines = content.split('\n').map(line => line.trim())
  const blocks: ReactNode[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.startsWith('- ')) {
      const items: string[] = []
      while (index < lines.length && lines[index].startsWith('- ')) {
        items.push(lines[index].slice(2))
        index += 1
      }
      index -= 1
      blocks.push(<ul key={`ul-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul>)
      continue
    }
    if (!line) continue
    if (line.startsWith('### ')) blocks.push(<h4 key={index}>{line.slice(4)}</h4>)
    else if (line.startsWith('## ')) blocks.push(<h3 key={index}>{line.slice(3)}</h3>)
    else if (line.startsWith('# ')) blocks.push(<h2 key={index}>{line.slice(2)}</h2>)
    else if (line.startsWith('> ')) blocks.push(<blockquote key={index}>{line.slice(2)}</blockquote>)
    else blocks.push(<p key={index}>{line}</p>)
  }

  return <div className="wv-ws-doc">{blocks}</div>
}

function KnowledgeBaseDetail({ resource }: { resource: GovernanceResource }) {
  const { addKnowledgeFile, removeKnowledgeFile, notify } = useWorkspace()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const files = resource.files ?? []
  const [selected, setSelected] = useState<string | null>(files[0]?.name ?? null)
  const [filesWidth, setFilesWidth] = useState(FILES_DEFAULT)
  const [chatWidth, setChatWidth] = useState(CHAT_DEFAULT)
  const [filesOpen, setFilesOpen] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [thread, setThread] = useState<WorkspaceMessage[]>([])
  const [aiOpen, setAiOpen] = useState(false)
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiThread, setAiThread] = useState<WorkspaceMessage[]>([])

  const current = files.find(file => file.name === selected) ?? null

  /* 当前选中的文件被删掉（或换了一个知识库）时退回第一个文件，真实应用同样是这个
     行为——否则中栏会停在一个已经不存在的文件名上。 */
  useEffect(() => {
    if (selected && files.some(file => file.name === selected)) return
    setSelected(files[0]?.name ?? null)
  }, [files, selected])

  async function handleFiles(list: FileList | null) {
    if (!list?.length) return
    const batch = new Map<string, File>()
    Array.from(list).forEach(file => {
      /* 目录上传带出 webkitRelativePath，丢掉第一段目录名——真实应用只保留根目录
         以内的相对路径，原型照做，否则 Skill 那类带路径的文件名会多一层壳。 */
      const path = file.webkitRelativePath ? file.webkitRelativePath.slice(file.webkitRelativePath.indexOf('/') + 1) : file.name
      if (!path) return
      if (!/\.(md|txt)$/i.test(path)) {
        notify(`「${path}」不是 .md 或 .txt，已拒绝上传。`, 'warn')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        notify(`「${path}」超过 5 MiB 单文件上限，已拒绝上传。`, 'warn')
        return
      }
      batch.set(path, file)
    })
    for (const [path, file] of batch) {
      addKnowledgeFile(resource.id, path, `${Math.max(1, Math.round(file.size / 1024))} KB`, await file.text())
    }
  }

  /* 演示回复只说这一轮会怎么执行，不声称检索到了什么。真实执行才会产生来源与引用
     位置，原型编一份出来就等于伪造证据链。 */
  function ask(target: 'panel' | 'float') {
    const value = target === 'panel' ? question : aiQuestion
    const text = value.trim()
    if (!text) return
    if (target === 'panel') setQuestion('')
    else setAiQuestion('')
    const reply = target === 'panel'
      ? '已收到。这一轮按 1024 token、90 秒、最多 8 步的预算在当前知识库内检索，命中的来源文件与段落位置会随答案标注；原型不执行真实检索，所以这里不返回具体条文。'
      : '已收到。这个会话说明当前知识库的用法——添加资料、整理结构与发布流程，它不上传文件也不修改知识库；原型不接模型，所以这里不返回生成结果。'
    const push = (current: WorkspaceMessage[]) => [
      ...current,
      { id: `q-${Date.now()}`, role: 'user' as const, text },
      { id: `a-${Date.now()}`, role: 'assistant' as const, text: reply },
    ]
    if (target === 'panel') setThread(push)
    else setAiThread(push)
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.txt"
        multiple
        hidden
        onChange={event => { handleFiles(event.target.files); event.target.value = '' }}
      />
      <input
        ref={folderInputRef}
        type="file"
        hidden
        {...{ webkitdirectory: '', directory: '' }}
        onChange={event => { handleFiles(event.target.files); event.target.value = '' }}
      />

      <div className="wv-workspace">
        <section
          className="wv-ws-pane wv-ws-files"
          style={{ width: filesOpen ? filesWidth : FILES_COLLAPSED }}
          aria-label="知识库文件"
        >
          {filesOpen ? (
            <>
              <header className="wv-ws-head">
                <h2>文件</h2>
                <div className="wv-ws-head-actions">
                  <div className="wv-ws-menu">
                    <button
                      className="wv-icon-btn"
                      aria-label="上传文件"
                      aria-expanded={uploadOpen}
                      onClick={() => setUploadOpen(open => !open)}
                    >
                      <Upload size={14} strokeWidth={2} />
                    </button>
                    {uploadOpen && (
                      <>
                        <button className="wv-ws-scrim" aria-label="关闭上传菜单" onClick={() => setUploadOpen(false)} />
                        <div className="wv-menu">
                          <button onClick={() => { setUploadOpen(false); fileInputRef.current?.click() }}>上传文件</button>
                          <button onClick={() => { setUploadOpen(false); folderInputRef.current?.click() }}>上传文件夹</button>
                        </div>
                      </>
                    )}
                  </div>
                  <button className="wv-icon-btn" aria-label="折叠文件面板" onClick={() => setFilesOpen(false)}>
                    <ChevronLeft size={14} strokeWidth={2} />
                  </button>
                </div>
              </header>

              <div className="wv-ws-scroll">
                {!files.length && <Empty text="暂无文件" />}
                {files.map(file => (
                  <div className={`wv-ws-file${file.name === selected ? ' active' : ''}`} key={file.name}>
                    <button
                      className="wv-ws-file-main"
                      onClick={() => setSelected(file.name)}
                      title={`${file.name} · ${file.size} · ${file.parsed ? '已解析' : '等待解析'}`}
                    >
                      <FileText size={13} strokeWidth={1.9} />
                      <span className="wv-ws-file-name">{file.name}</span>
                    </button>
                    {removing === file.name ? (
                      <>
                        <button className="wv-btn ghost danger" onClick={() => { setRemoving(null); removeKnowledgeFile(resource.id, file.name) }}>确认</button>
                        <button className="wv-btn ghost" onClick={() => setRemoving(null)}>取消</button>
                      </>
                    ) : (
                      <button className="wv-icon-btn wv-ws-file-del" aria-label={`删除 ${file.name}`} onClick={() => setRemoving(file.name)}>
                        <Trash2 size={13} strokeWidth={1.9} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="wv-ws-collapsed">
              <button className="wv-icon-btn" aria-label="展开文件面板" onClick={() => setFilesOpen(true)}>
                <ChevronRight size={14} strokeWidth={2} />
              </button>
            </div>
          )}
        </section>

        <Divider label="调整文件面板宽度" onDrag={delta => setFilesWidth(width => clamp(width + delta, FILES_MIN, FILES_MAX))} />

        <section className="wv-ws-pane wv-ws-preview" aria-label="知识库文件预览">
          <header className="wv-ws-head">
            <FileText size={13} strokeWidth={1.9} />
            <h2>{current?.name ?? '文件预览'}</h2>
            {current && !current.parsed && <Badge kind="warn">等待解析</Badge>}
          </header>
          <div className="wv-ws-scroll">
            {!current ? <Empty text="请先在左侧选择一个文件。" />
              : current.content ? <DocumentBody name={current.name} content={current.content} />
              : <Empty text="这份文件没有可预览的正文。" />}
          </div>
        </section>

        <Divider gap label="调整问答面板宽度" onDrag={delta => setChatWidth(width => clamp(width - delta, CHAT_MIN, CHAT_MAX))} />

        <aside className="wv-ws-pane" style={{ width: chatWidth }} aria-label="知识库文件问答">
          <header className="wv-ws-head">
            <h2>文件问答</h2>
            {thread.length > 0 && <button className="wv-btn ghost" onClick={() => setThread([])}>清空</button>}
          </header>
          <div className="wv-ws-scroll">
            {!thread.length ? (
              <div className="wv-ws-empty">
                <p className="wv-ws-empty-title">读取当前知识库</p>
                <p className="wv-ws-empty-desc">输入问题，获取基于当前知识库证据生成的答案。</p>
              </div>
            ) : (
              <div className="wv-chat">
                {thread.map(message => (
                  <div className={`wv-chat-msg ${message.role}`} key={message.id}><p>{message.text}</p></div>
                ))}
              </div>
            )}
          </div>
          <footer className="wv-ws-composer">
            <input
              className="wv-input"
              aria-label="知识库问题"
              value={question}
              placeholder="输入知识库问题，回车发送"
              onChange={event => setQuestion(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter') ask('panel') }}
            />
            <button className="wv-btn primary" disabled={!question.trim()} onClick={() => ask('panel')}>发送</button>
          </footer>
        </aside>
      </div>

      {aiOpen ? (
        <aside className="wv-modal wv-ai-float" role="dialog" aria-label="知识库 AI 使用会话">
          <div className="wv-modal-head">
            <h2>知识库 AI 助手</h2>
            <button className="wv-icon-btn" aria-label="收起 AI 会话" onClick={() => setAiOpen(false)}>
              <Minus size={16} strokeWidth={2} />
            </button>
          </div>
          <div className="wv-ai-float-body">
            {!aiThread.length ? (
              <div className="wv-ws-empty">
                <p className="wv-ws-empty-title">询问如何使用当前知识库</p>
                <p className="wv-ws-empty-desc">AI 会结合当前知识库状态说明如何添加资料、整理结构和使用；本会话不上传文件，也不修改知识库。</p>
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
              value={aiQuestion}
              placeholder="例如：怎样添加资料并让员工使用？"
              onChange={event => setAiQuestion(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter') ask('float') }}
            />
            <button className="wv-btn primary" disabled={!aiQuestion.trim()} onClick={() => ask('float')}>发送</button>
          </div>
        </aside>
      ) : (
        <button className="wv-ai-fab" onClick={() => setAiOpen(true)}>
          <Sparkles size={14} strokeWidth={2} /> AI 会话
        </button>
      )}
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
