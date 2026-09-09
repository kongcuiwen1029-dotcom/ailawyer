import {
  Plus,
  Briefcase,
  Boxes,
  Bot,
  Users,
  ClipboardList,
  MessageCircle,
  type LucideIcon,
} from 'lucide-react'

export type ViewId =
  | 'new'
  | 'conversation'
  | 'projects'
  | 'resources'
  | 'employees'
  | 'teams'
  | 'datasets'
  | 'feedback'

export interface NavItem {
  id: ViewId
  icon: LucideIcon
  label: string
}

export interface NavSection {
  title: string
  items: NavItem[]
}

/**
 * Shared navigation model for all three themes, derived from the product
 * requirements: 工作区 (project workbench) + 治理中心 (governance control plane).
 */
export const navSections: NavSection[] = [
  {
    title: '工作区',
    items: [
      { id: 'new',      icon: Plus,      label: '新建' },
      { id: 'projects', icon: Briefcase, label: '项目' },
    ],
  },
  {
    title: '治理中心',
    items: [
      { id: 'resources', icon: Boxes,         label: '资源市场' },
      { id: 'employees', icon: Bot,           label: '数字员工' },
      { id: 'teams',     icon: Users,         label: '员工组' },
      { id: 'datasets',  icon: ClipboardList, label: '评估数据集' },
    ],
  },
  {
    title: '其他',
    items: [
      { id: 'feedback', icon: MessageCircle, label: '产品反馈' },
    ],
  },
]

export const viewTitles: Record<ViewId, { title: string; sub: string }> = {
  new:       { title: '新建', sub: '' },
  conversation: { title: '项目会话', sub: '在项目上下文中与 Nomos 协作，查看证据与运行状态' },
  projects:  { title: '项目', sub: '管理你有权访问的法律项目、会话与产物' },
  resources: { title: '资源市场', sub: '统一维护可复用的知识库、Skill、Connector、SOP 与模型' },
  employees: { title: '数字员工', sub: '可发布的 AI 执行身份，绑定资源并按三条路线运行' },
  teams:     { title: '员工组', sub: '由 Team Supervisor 统一调度的数字员工团队' },
  datasets:  { title: '评估数据集', sub: '可重复的测试样本与不可变版本' },
  feedback:  { title: '产品反馈', sub: '把使用中的问题和建议告诉我们' },
}
