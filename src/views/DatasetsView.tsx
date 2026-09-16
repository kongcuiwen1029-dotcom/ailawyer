import { useState } from 'react'
import { Archive, ArchiveRestore, ClipboardList, Download, GitBranch, Upload } from 'lucide-react'
import { useWorkspace, type Dataset } from '../state/workspace'
import { Badge, DetailShell, Empty, Field, Modal, Pager, Section, ViewHead, usePaged } from '../ui/parts'

export default function DatasetsView() {
  const { datasets, createDatasetVersion, importCases, toggleDatasetArchived } = useWorkspace()
  const [openId, setOpenId] = useState<string | null>(null)
  const [importing, setImporting] = useState<Dataset | null>(null)
  const [count, setCount] = useState(20)
  const [source, setSource] = useState('trace')

  const open = datasets.find(dataset => dataset.id === openId) ?? null
  const { page, setPage, pageCount, pageItems, total } = usePaged(datasets, 6)

  if (open) return <DatasetDetail dataset={open} onBack={() => setOpenId(null)} />

  return (
    <>
      <ViewHead
        view="datasets"
        meta="数据集是可重复评测的基础：版本一旦冻结就不再变化，评测报告永远指向某个具体版本的 hash。"
      />

      {!pageItems.length && <Empty text="还没有数据集。" />}

      <div className="wv-list">
        {pageItems.map(dataset => (
          <div className="wv-row" key={dataset.id}>
            <div className="wv-ico"><ClipboardList size={18} strokeWidth={1.8} /></div>
            <div className="wv-row-main">
              <p className="wv-row-title">
                {dataset.name}
                {dataset.archived
                  ? <Badge kind="draft"><Archive size={11} strokeWidth={2} /> 已归档</Badge>
                  : <Badge kind="ok">启用中</Badge>}
              </p>
              <p className="wv-row-sub">{dataset.scope} · {dataset.cases} 个 Case · {dataset.versions.length} 个版本 · 最新 {dataset.versions[0]?.version}（{dataset.versions[0]?.hash}）</p>
            </div>
            <div className="wv-row-actions">
              <button className="wv-btn" onClick={() => setOpenId(dataset.id)}>详情</button>
              <button className="wv-btn" onClick={() => setImporting(dataset)}><Upload size={13} strokeWidth={1.9} /> 导入 Case</button>
              <button className="wv-btn primary" onClick={() => createDatasetVersion(dataset.id)}>新建版本</button>
            </div>
          </div>
        ))}
      </div>

      <Pager page={page} pageCount={pageCount} onPage={setPage} total={total} size={6} />

      {importing && (
        <Modal
          title={`导入 Case · ${importing.name}`}
          desc="导入的 Case 会直接进入当前工作版本，冻结版本不会被改动。"
          onClose={() => setImporting(null)}
          footer={
            <>
              <button className="wv-btn" onClick={() => setImporting(null)}>取消</button>
              <button className="wv-btn primary" onClick={() => { importCases(importing.id, count); setImporting(null) }}>
                导入 {count} 个 Case
              </button>
            </>
          }
        >
          <Field label="来源" hint="从运行记录导入可以把线上一次真实执行变成可重复的回归样本。">
            <select className="wv-select" value={source} onChange={event => setSource(event.target.value)}>
              <option value="trace">从调试台运行导入</option>
              <option value="file">上传 JSON 文件</option>
              <option value="manual">手工填写</option>
            </select>
          </Field>
          <Field label="数量" hint="单次最多 200 个。">
            <input className="wv-input" type="number" min={1} max={200} value={count} onChange={event => setCount(Math.max(1, Math.min(200, Number(event.target.value) || 1)))} />
          </Field>
          {source === 'trace' && <p className="wv-note">将从最近的运行里抽取 3 条 trace 作为样本来源，保留输入、期望输出与调用链快照。</p>}
        </Modal>
      )}
    </>
  )
}

function DatasetDetail({ dataset, onBack }: { dataset: Dataset; onBack: () => void }) {
  const { createDatasetVersion, importCases, toggleDatasetArchived, notify } = useWorkspace()

  return (
    <DetailShell
      title={dataset.name}
      subtitle={`${dataset.scope} · ${dataset.cases} 个 Case · ${dataset.versions.length} 个版本`}
      badges={dataset.archived ? <Badge kind="draft">已归档</Badge> : <Badge kind="ok">启用中</Badge>}
      actions={
        <>
          <button className="wv-btn" onClick={() => importCases(dataset.id, 20)}><Upload size={13} strokeWidth={1.9} /> 导入 20 个 Case</button>
          <button className="wv-btn primary" onClick={() => createDatasetVersion(dataset.id)}><GitBranch size={13} strokeWidth={1.9} /> 冻结新版本</button>
        </>
      }
      onBack={onBack}
    >
      <Section title="版本历史" hint="冻结后不可修改；如需调整请新建版本，历史报告仍然指向旧版本的 hash。">
        {dataset.cases !== (dataset.versions[0]?.cases ?? dataset.cases) && (
          <p className="wv-banner info">
            工作版本有 {dataset.cases} 个 Case，最新冻结版本 {dataset.versions[0]?.version} 仍是 {dataset.versions[0]?.cases} 个；冻结新版本后两者才会一致。
          </p>
        )}
        <table className="wv-table">
          <thead>
            <tr><th>版本</th><th>Case 数</th><th>manifest hash</th><th>冻结时间</th><th>操作</th></tr>
          </thead>
          <tbody>
            {dataset.versions.map(version => (
              <tr key={version.version}>
                <td className="wv-mono">{version.version}</td>
                <td>{version.cases}</td>
                <td className="wv-mono">{version.hash}</td>
                <td>{version.frozenAt}</td>
                <td>
                  <button className="wv-btn ghost" onClick={() => notify(`已开始导出 ${version.version} 的 manifest 与 Case 明细。`, 'ok')}>
                    <Download size={12} strokeWidth={1.9} /> 导出
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="评测使用方式" hint="报告会记录数据集版本、执行者 revision 与运行快照，保证可复现。">
        <ul className="wv-bullets">
          <li>选择数据集版本与数字员工的 revision 后发起评测，按 Case 逐一执行。</li>
          <li>同一个 Case 多次运行都保留独立结果，不会互相覆盖。</li>
          <li>归档后不能再发起新的评测，但历史报告仍然可读。</li>
        </ul>
        <div className="wv-toolbar end">
          <button className="wv-btn" onClick={() => toggleDatasetArchived(dataset.id)}>
            {dataset.archived ? <><ArchiveRestore size={13} strokeWidth={1.9} /> 恢复启用</> : <><Archive size={13} strokeWidth={1.9} /> 归档</>}
          </button>
        </div>
      </Section>
    </DetailShell>
  )
}
