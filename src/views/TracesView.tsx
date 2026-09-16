import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, Copy, Lock, Search } from 'lucide-react'
import { useWorkspace, type SpanKind, type TraceRun, type TraceSpan } from '../state/workspace'
import { Badge, DetailShell, Empty, Pager, Section, ViewHead, usePaged } from '../ui/parts'

const KIND_LABEL: Record<SpanKind, string> = {
  agent: 'Agent', model: '模型调用', 'model-request': '模型请求', tool: '工具', workflow: '流程', processor: '处理器',
}

const KIND_TONE: Record<SpanKind, string> = {
  agent: 'violet', model: 'blue', 'model-request': 'amber', tool: 'green', workflow: 'teal', processor: 'slate',
}

export default function TracesView() {
  const { traces, notify, traceFocus: focus, setTraceFocus } = useWorkspace()
  const [executorFilter, setExecutorFilter] = useState<'all' | 'employee' | 'team'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'succeeded' | 'failed'>('all')
  const [query, setQuery] = useState('')
  const [openTraceId, setOpenTraceId] = useState<string | null>(null)

  useEffect(() => {
    if (!focus) return
    setExecutorFilter(focus.kind)
    setQuery('')
    setOpenTraceId(null)
  }, [focus])

  const focusName = focus
    ? traces.find(trace => trace.executorId === focus.id)?.executorName ?? focus.id
    : ''

  const visible = useMemo(() => traces.filter(trace => {
    const focusMatch = focus
      ? trace.executorId === focus.id
      : true
    if (!focusMatch) return false
    if (focus && executorFilter !== trace.executorKind) return false
    if (executorFilter !== 'all' && trace.executorKind !== executorFilter) return false
    if (statusFilter !== 'all' && trace.status !== statusFilter) return false
    if (query.trim() && !`${trace.traceId}${trace.executorName}${trace.tenant}`.toLowerCase().includes(query.trim().toLowerCase())) return false
    return true
  }), [traces, executorFilter, statusFilter, query, focus])

  const { page, setPage, pageCount, pageItems, total } = usePaged(visible, 8)
  const open = traces.find(trace => trace.traceId === openTraceId) ?? null

  if (open) return <TraceDetail trace={open} onBack={() => setOpenTraceId(null)} />

  return (
    <>
      <ViewHead
        view="traces"
        meta="调试台的所有查询都是只读的：非 GET 请求会被拒绝（403），超出本人作用域的 traceId 一律返回 404。"
        action={
          <button className="wv-btn" onClick={() => notify('traceId 已复制到剪贴板。', 'ok')}>
            <Lock size={13} strokeWidth={1.9} /> 只读查询
          </button>
        }
      />

      {focus && (
        <p className="wv-banner info">
          <Activity size={14} strokeWidth={2} />
          正在按执行者筛选：{focus.kind === 'team' ? '员工组' : '数字员工'} {focusName}
          {pageItems.length > 0 && (
            <button className="wv-link" onClick={() => setOpenTraceId(pageItems[0].traceId)}>打开最近一次运行</button>
          )}
          <button className="wv-link" onClick={() => { setTraceFocus(null); setQuery(''); setExecutorFilter('all') }}>清除筛选</button>
        </p>
      )}

      <div className="wv-filter">
        <div className="wv-seg">
          <button className={executorFilter === 'all' ? 'active' : ''} onClick={() => { setExecutorFilter('all'); setPage(1) }}>全部</button>
          <button className={executorFilter === 'employee' ? 'active' : ''} onClick={() => { setExecutorFilter('employee'); setPage(1) }}>数字员工</button>
          <button className={executorFilter === 'team' ? 'active' : ''} onClick={() => { setExecutorFilter('team'); setPage(1) }}>员工组</button>
        </div>
        <div className="wv-seg">
          <button className={statusFilter === 'all' ? 'active' : ''} onClick={() => { setStatusFilter('all'); setPage(1) }}>全部结果</button>
          <button className={statusFilter === 'failed' ? 'active' : ''} onClick={() => { setStatusFilter('failed'); setPage(1) }}>失败</button>
        </div>
        <div className="wv-input-affix">
          <Search size={14} strokeWidth={1.9} />
          <input className="wv-input" placeholder="按 traceId、执行者或租户搜索" value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} />
        </div>
      </div>

      {!pageItems.length && <Empty text={focus ? `没有${focusName}的运行记录。` : '没有符合条件的运行记录。'} />}

      <table className="wv-table">
        <thead>
          <tr><th>traceId</th><th>执行者</th><th>租户</th><th>开始时间</th><th>耗时</th><th>Span</th><th>结果</th></tr>
        </thead>
        <tbody>
          {pageItems.map(trace => (
            <tr key={trace.traceId} className="wv-click-row" onClick={() => setOpenTraceId(trace.traceId)}>
              <td className="wv-mono">{trace.traceId.slice(0, 12)}…</td>
              <td>
                <span className="wv-chip2">{trace.executorKind === 'team' ? '员工组' : '数字员工'}</span> {trace.executorName}
              </td>
              <td>{trace.tenant}</td>
              <td>{trace.startedAt}</td>
              <td>{(trace.durationMs / 1000).toFixed(1)} s</td>
              <td>{trace.spans.length}</td>
              <td>{trace.status === 'succeeded'
                ? <Badge kind="ok">succeeded</Badge>
                : <Badge kind="warn">failed</Badge>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Pager page={page} pageCount={pageCount} onPage={setPage} total={total} size={8} />
    </>
  )
}

/* ───────────────────────── detail ───────────────────────── */

function TraceDetail({ trace, onBack }: { trace: TraceRun; onBack: () => void }) {
  const { notify } = useWorkspace()
  const [selectedId, setSelectedId] = useState(trace.spans[0]?.id ?? '')
  const selected = trace.spans.find(span => span.id === selectedId) ?? trace.spans[0]
  const totalDuration = Math.max(1, ...trace.spans.map(span => span.startMs + span.durationMs))
  const modelRequests = trace.spans.filter(span => span.kind === 'model-request').length

  return (
    <DetailShell
      title={`运行 ${trace.traceId.slice(0, 16)}…`}
      subtitle={`${trace.executorKind === 'team' ? '员工组' : '数字员工'} · ${trace.executorName} · ${trace.tenant} · ${trace.startedAt} · 耗时 ${(trace.durationMs / 1000).toFixed(1)} 秒`}
      badges={trace.status === 'succeeded' ? <Badge kind="ok">succeeded</Badge> : <Badge kind="warn">failed</Badge>}
      actions={
        <button className="wv-btn" onClick={() => notify(`已复制 traceId ${trace.traceId}`, 'ok')}>
          <Copy size={13} strokeWidth={1.9} /> 复制 traceId
        </button>
      }
      onBack={onBack}
    >
      <div className="wv-kv cards">
        <div><span>Span 数量</span><b>{trace.spans.length}</b></div>
        <div><span>模型请求记录</span><b>{modelRequests}</b></div>
        <div><span>总耗时</span><b>{(trace.durationMs / 1000).toFixed(1)} 秒</b></div>
        <div><span>查询接口</span><b>GET /api/observability/traces/:traceId</b></div>
      </div>

      <div className="wv-split">
        <Section title="Span 时间线" hint="点击任一 Span 查看它的输入、输出与元数据。">
          <div className="wv-spans">
            {trace.spans.map(span => {
              const depth = depthOf(trace.spans, span)
              return (
                <button
                  key={span.id}
                  className={`wv-span${span.id === selected?.id ? ' active' : ''}`}
                  style={{ paddingLeft: 12 + depth * 18 }}
                  onClick={() => setSelectedId(span.id)}
                >
                  <span className={`wv-span-kind ${KIND_TONE[span.kind]}`}>{KIND_LABEL[span.kind]}</span>
                  <span className="wv-span-name">{span.name}</span>
                  <span className="wv-span-bar">
                    <span
                      className={`wv-span-bar-fill ${KIND_TONE[span.kind]}`}
                      style={{ left: `${(span.startMs / totalDuration) * 100}%`, width: `${Math.max(2, (span.durationMs / totalDuration) * 100)}%` }}
                    />
                  </span>
                  <span className="wv-span-ms">{formatMs(span.durationMs)}</span>
                </button>
              )
            })}
          </div>
        </Section>

        <Section title="Span 详情" hint={selected ? `${selected.name} · ${formatMs(selected.durationMs)}` : undefined}>
          {!selected && <Empty text="没有可展示的 Span。" />}
          {selected && (
            <>
              <div className="wv-kv">
                <div><span>类型</span><b>{KIND_LABEL[selected.kind]}</b></div>
                <div><span>开始偏移</span><b>{selected.startMs} ms</b></div>
                <div><span>持续时间</span><b>{formatMs(selected.durationMs)}</b></div>
              </div>
              <div className="wv-io">
                <p className="wv-io-label">输入</p>
                <pre className="wv-pre">{selected.input}</pre>
                <p className="wv-io-label">输出</p>
                <pre className="wv-pre">{selected.output}</pre>
              </div>
              {Object.keys(selected.metadata).length > 0 && (
                <>
                  <p className="wv-io-label">元数据</p>
                  <div className="wv-kv">
                    {Object.entries(selected.metadata).map(([key, value]) => (
                      <div key={key}><span>{key}</span><b className="wv-mono">{value}</b></div>
                    ))}
                  </div>
                </>
              )}
              {selected.kind === 'model-request' && (
                <p className="wv-banner info">
                  <AlertTriangle size={14} strokeWidth={2} />
                  harness 记录的是发往模型的原始请求体：工具集合与选择策略、温度、输出上限都在这里，用于复现一次运行。
                </p>
              )}
            </>
          )}
        </Section>
      </div>

      {trace.status === 'failed' && (
        <p className="wv-banner warn">
          <AlertTriangle size={14} strokeWidth={2} />
          失败运行不做隐式重试；错误按原样写入本 trace，可在 Span 详情里看到被拦截的原因。
        </p>
      )}
      {trace.status === 'succeeded' && (
        <p className="wv-banner ok">
          <CheckCircle2 size={14} strokeWidth={2} />
          运行正常结束，全部 Span 已落库并可复现。
        </p>
      )}
    </DetailShell>
  )
}

function depthOf(spans: TraceSpan[], target: TraceSpan) {
  let depth = 0
  let current = target
  while (current.parentId) {
    const parent = spans.find(span => span.id === current.parentId)
    if (!parent) break
    depth += 1
    current = parent
  }
  return depth
}

function formatMs(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${value} ms`
}
