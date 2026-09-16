import {
  Activity,
  Bot,
  Boxes,
  Briefcase,
  ClipboardList,
  MessageCircle,
  Plus,
  ShieldCheck,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type ViewId =
  | 'new'
  | 'conversation'
  | 'projects'
  | 'resources'
  | 'employees'
  | 'teams'
  | 'datasets'
  | 'traces'
  | 'users'
  | 'feedback'

export type NavItem = { id: ViewId; icon: LucideIcon; label: string }
export type NavSection = { title: string; items: NavItem[] }

export const navSections: NavSection[] = [
  {
    title: '工作区',
    items: [
      { id: 'new', icon: Plus, label: '新建' },
      { id: 'projects', icon: Briefcase, label: '项目' },
    ],
  },
  {
    title: '治理中心',
    items: [
      { id: 'resources', icon: Boxes, label: '资源市场' },
      { id: 'employees', icon: Bot, label: '数字员工' },
      { id: 'teams', icon: Users, label: '员工组' },
      { id: 'datasets', icon: ClipboardList, label: '评估数据集' },
    ],
  },
  {
    title: '运维',
    items: [
      { id: 'traces', icon: Activity, label: '调试台' },
      { id: 'users', icon: ShieldCheck, label: '平台用户' },
    ],
  },
  {
    title: '其他',
    items: [{ id: 'feedback', icon: MessageCircle, label: '产品反馈' }],
  },
]

export const viewTitles: Record<ViewId, { title: string; sub: string }> = {
  new: { title: '新建', sub: '' },
  conversation: { title: '项目会话', sub: '在项目上下文中与 Nomos 协作，查看证据与运行状态' },
  projects: { title: '项目', sub: '管理你有权访问的法律项目、会话与产物' },
  resources: { title: '资源市场', sub: '统一维护可复用的知识库、Skill、Connector、SOP 与模型；发布后才能被员工绑定' },
  employees: { title: '数字员工', sub: '单 Agent 执行身份：绑定一个主模型与若干资源，按固定指令完成一类法律任务' },
  teams: { title: '员工组', sub: '由主管统一调度的数字员工团队；同一租户最多启用一个' },
  datasets: { title: '评估数据集', sub: '可重复的测试样本与不可变版本' },
  traces: { title: '调试台', sub: '按 traceId 查看一次运行的完整 Span，包含 harness 记录的模型请求' },
  users: { title: '平台用户', sub: '账号、角色与作用域治理；授权改动原子保存并即时失效旧会话' },
  feedback: { title: '产品反馈', sub: '把使用中的问题和建议告诉我们' },
}
