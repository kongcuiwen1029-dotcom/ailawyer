import type { ReactNode } from 'react'

/* ── 「数字员工」的头像 ─────────────────────────────────────────────────────
   每个数字员工配一张自己的头像，好让思考轨迹里一眼看出是谁在做哪件事。参考的是 WorkBuddy 专家团「每个 AI 员工一张头像」的做法。

   这些是**占位图形**，不是真人照片。每张都是内联 SVG，不带外部请求 —— 单文件
   产物要能在 file:// 下离线打开，挂外链图片会在脱网或换目录时裂掉。也刻意不用
   任何 CSS 变量：头像要落在浅色、深色、灰色三套主题上，而灰色主题里
   --conversation-accent-soft 是半透明白，拿它当底色就是在白底上画白块（见
   index.css 里 .trace-detail-avatar 的注释）。所以每张图自带底色和描边，
   三套主题下表现一致。

   造型原则：24px 下能认出来，而且同一屏出现的三位绝不撞脸。九个角色的 id 来自
   ConversationView.tsx 的 thinkingAgents，一次只会同屏三位：
     Direct   → counsel / facts / checker
     Agentic  → materials / research / evidence
     Workflow → orchestrator / clause / delivery
   所以区分度只要在每一组内部成立就行，靠两样东西叠加：底色色相 + 一个签名特征
   （天线、耳机、护目镜、放大镜、盾徽、三点冠、竖缝眼、对勾嘴、核验印章）。
   缺 id 时退回一张中性剪影。 */

const AVATARS: Record<string, ReactNode> = {
  /* 法律顾问 · 天线球 —— 找人、拆问题的那个 */
  counsel: (
    <>
      <rect width="32" height="32" rx="10" fill="#6d63d6" />
      <line x1="16" y1="12" x2="16" y2="6.6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="5.2" r="2.1" fill="#fff" />
      <rect x="6.5" y="11" width="19" height="14" rx="5.5" fill="#fff" />
      <circle cx="12" cy="16.6" r="1.8" fill="#6d63d6" />
      <circle cx="20" cy="16.6" r="1.8" fill="#6d63d6" />
      <rect x="12.6" y="20.6" width="6.8" height="1.9" rx=".95" fill="#6d63d6" />
    </>
  ),
  /* 事实审阅员 · 护目镜 —— 逐条比对、只看事实的那个 */
  facts: (
    <>
      <rect width="32" height="32" rx="10" fill="#2f9a8e" />
      <rect x="3.6" y="14" width="3.4" height="8" rx="1.7" fill="#fff" />
      <rect x="25" y="14" width="3.4" height="8" rx="1.7" fill="#fff" />
      <rect x="6.5" y="11" width="19" height="14" rx="5.5" fill="#fff" />
      <rect x="10" y="14.6" width="12" height="5.6" rx="2.8" fill="#2f9a8e" />
    </>
  ),
  /* 结论核验员 · 核验印章 —— 这里故意不给它脸：条状的嘴在 24px 下只会读成
     「在笑」，读不出「已核验」，而一枚圆章 + 对勾一眼就是「核过了」。 */
  checker: (
    <>
      <rect width="32" height="32" rx="10" fill="#c4832f" />
      <circle cx="16" cy="16" r="9.6" fill="#fff" />
      <path d="M11.4 16.4l3.2 3.2 6-6.4" fill="none" stroke="#c4832f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  /* 材料审阅员 · 方眼 + 顶栏天线 —— 扫描案卷、登记解析状态的那个 */
  materials: (
    <>
      <rect width="32" height="32" rx="10" fill="#4a6fd0" />
      <rect x="11" y="4.6" width="10" height="3.4" rx="1.7" fill="#fff" />
      <rect x="6.5" y="10.5" width="19" height="15" rx="4.5" fill="#fff" />
      <rect x="11" y="15" width="3.4" height="3.4" rx="1" fill="#4a6fd0" />
      <rect x="17.6" y="15" width="3.4" height="3.4" rx="1" fill="#4a6fd0" />
      <rect x="11.6" y="21" width="8.8" height="1.8" rx=".9" fill="#4a6fd0" />
    </>
  ),
  /* 法规检索员 · 放大镜 —— 查法条、盯时效的那个。放大镜故意画得比脸还大，
     它就是这个角色的全部意思，看不清才奇怪。 */
  research: (
    <>
      <rect width="32" height="32" rx="10" fill="#3f9a54" />
      <rect x="6.5" y="9.5" width="19" height="15.5" rx="5.5" fill="#fff" />
      <circle cx="14" cy="16" r="3.6" fill="none" stroke="#3f9a54" strokeWidth="2" />
      <line x1="16.7" y1="18.7" x2="20" y2="22" stroke="#3f9a54" strokeWidth="2" strokeLinecap="round" />
      <circle cx="21.4" cy="14.4" r="1.5" fill="#3f9a54" />
    </>
  ),
  /* 证据核验员 · 盾徽 —— 检查证据覆盖、标缺口的那张。盾牌压在头顶，下半截被
     头挡住，正好读成一枚徽章而不是第二张图。 */
  evidence: (
    <>
      <rect width="32" height="32" rx="10" fill="#c05a76" />
      <path d="M16 3.4l4.6 1.8v3.4c0 2.4-1.9 4.1-4.6 5-2.7-.9-4.6-2.6-4.6-5V5.2z" fill="#fff" />
      <rect x="6.5" y="11" width="19" height="14" rx="5.5" fill="#fff" />
      <circle cx="12" cy="16.6" r="1.8" fill="#c05a76" />
      <circle cx="20" cy="16.6" r="1.8" fill="#c05a76" />
      <rect x="12.6" y="20.6" width="6.8" height="1.9" rx=".95" fill="#c05a76" />
    </>
  ),
  /* 流程编排员 · 三点冠 —— 按 SOP 排节点的那个，冠上三点就是它排的节点。 */
  orchestrator: (
    <>
      <rect width="32" height="32" rx="10" fill="#7a5cc4" />
      <circle cx="10.6" cy="6.8" r="1.6" fill="#fff" />
      <circle cx="16" cy="5" r="1.6" fill="#fff" />
      <circle cx="21.4" cy="6.8" r="1.6" fill="#fff" />
      <rect x="6.5" y="10.4" width="19" height="15" rx="5" fill="#fff" />
      <circle cx="12" cy="16" r="1.8" fill="#7a5cc4" />
      <circle cx="20" cy="16" r="1.8" fill="#7a5cc4" />
      <rect x="12.6" y="20.4" width="6.8" height="1.9" rx=".95" fill="#7a5cc4" />
    </>
  ),
  /* 条款审查员 · 竖缝眼 —— 逐条扫合同条款的那个，竖缝就是扫描头。 */
  clause: (
    <>
      <rect width="32" height="32" rx="10" fill="#2f6f9a" />
      <rect x="6.5" y="10.5" width="19" height="15" rx="5.5" fill="#fff" />
      <rect x="12" y="14" width="2.6" height="6.4" rx="1.3" fill="#2f6f9a" />
      <rect x="17.4" y="14" width="2.6" height="6.4" rx="1.3" fill="#2f6f9a" />
      <rect x="11.6" y="21.4" width="8.8" height="1.9" rx=".95" fill="#2f6f9a" />
    </>
  ),
  /* 交付复核员 · 对勾嘴 —— 和结论核验员同在一个意思上，但两者分别属于
     Workflow 和 Direct，永远不同屏，所以可以共用对勾这个符号。 */
  delivery: (
    <>
      <rect width="32" height="32" rx="10" fill="#3f7d6a" />
      <rect x="6.5" y="10.5" width="19" height="15" rx="5.5" fill="#fff" />
      <circle cx="12" cy="15" r="1.8" fill="#3f7d6a" />
      <circle cx="20" cy="15" r="1.8" fill="#3f7d6a" />
      <path d="M11 20l2.5 2.4 4.6-4.8" fill="none" stroke="#3f7d6a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
}

/* 没有匹配 id 时用的中性剪影 —— 宁可给一张没性格的，也不要给一张错的。 */
const FALLBACK: ReactNode = (
  <>
    <rect width="32" height="32" rx="10" fill="#6b6b78" />
    <circle cx="16" cy="13.4" r="4.6" fill="#fff" />
    <path d="M7.6 27c1-5 4.4-7.4 8.4-7.4s7.4 2.4 8.4 7.4z" fill="#fff" />
  </>
)

export default function AgentAvatar({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      {AVATARS[id] ?? FALLBACK}
    </svg>
  )
}
