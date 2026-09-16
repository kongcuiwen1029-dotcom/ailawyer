import { useState } from 'react'
import { CheckCircle2, Send } from 'lucide-react'
import { Badge, Empty, Field, Section, ViewHead } from '../ui/parts'

const CATEGORIES = ['功能缺失', '交互不顺', '结果不准确', '性能问题', '其他']

interface FeedbackEntry {
  id: string
  category: string
  text: string
  at: string
  status: '已收到' | '处理中' | '已解决'
}

const seedHistory: FeedbackEntry[] = [
  { id: 'f-1', category: '交互不顺', text: '希望项目列表能直接看到所属租户，切换时不用再点进去确认。', at: '昨天', status: '处理中' },
  { id: 'f-2', category: '功能缺失', text: '数字员工希望能看到最近一次执行的 traceId，方便排查。', at: '3 天前', status: '已解决' },
]

export default function FeedbackView() {
  const [category, setCategory] = useState(CATEGORIES[0])
  const [text, setText] = useState('')
  const [contact, setContact] = useState('')
  const [history, setHistory] = useState(seedHistory)
  const [sent, setSent] = useState(false)

  function submit() {
    setHistory(current => [{ id: `f-${Date.now()}`, category, text: text.trim(), at: '刚刚', status: '已收到' }, ...current])
    setSent(true)
    setText('')
    setContact('')
  }

  return (
    <>
      <ViewHead view="feedback" meta="每条反馈都会带上当前页面与版本信息，方便我们复现。" />

      <div className="wv-feedback">
        {sent ? (
          <div className="wv-feedback-done">
            <CheckCircle2 size={40} strokeWidth={1.6} />
            <p>感谢反馈，我们已经收到了。</p>
            <button className="wv-btn" onClick={() => setSent(false)}>再提一条</button>
          </div>
        ) : (
          <>
            <Field label="问题类型">
              <div className="wv-chips">
                {CATEGORIES.map(item => (
                  <button key={item} className={`wv-toggle${category === item ? ' on' : ''}`} onClick={() => setCategory(item)}>{item}</button>
                ))}
              </div>
            </Field>
            <Field label="具体描述" hint="写清楚你当时在做什么、期望的结果和实际结果。">
              <textarea
                className="wv-textarea"
                value={text}
                onChange={event => setText(event.target.value)}
                placeholder="描述你遇到的问题或想要的功能……"
                rows={6}
              />
            </Field>
            <Field label="联系方式（可选）" hint="如果希望我们回访，留一个邮箱或企业微信。">
              <input className="wv-input" value={contact} onChange={event => setContact(event.target.value)} placeholder="name@example-law.cn" />
            </Field>
            <div className="wv-toolbar end">
              <button className="wv-btn primary" disabled={!text.trim()} onClick={submit}>
                <Send size={14} strokeWidth={1.9} /> 提交反馈
              </button>
            </div>
          </>
        )}
      </div>

      <Section title="我提交过的反馈" hint="处理进展会在这里更新。">
        {!history.length && <Empty text="还没有提交过反馈。" />}
        <div className="wv-list tight">
          {history.map(entry => (
            <div className="wv-row" key={entry.id}>
              <div className="wv-row-main">
                <p className="wv-row-title">
                  {entry.category}
                  <Badge kind={entry.status === '已解决' ? 'ok' : entry.status === '处理中' ? 'run' : 'draft'}>{entry.status}</Badge>
                </p>
                <p className="wv-row-sub">{entry.text}</p>
              </div>
              <span className="wv-filter-note">{entry.at}</span>
            </div>
          ))}
        </div>
      </Section>
    </>
  )
}
