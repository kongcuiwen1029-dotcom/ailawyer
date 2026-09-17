import {
  Bot,
  Boxes,
  Briefcase,
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
    ],
  },
  {
    title: '运维',
    items: [{ id: 'users', icon: ShieldCheck, label: '平台用户' }],
  },
  {
    title: '其他',
    items: [{ id: 'feedback', icon: MessageCircle, label: '产品反馈' }],
  },
]

export const viewTitles: Record<ViewId, { title: string }> = {
  new: { title: '新建' },
  conversation: { title: '项目会话' },
  projects: { title: '项目' },
  resources: { title: '资源市场' },
  employees: { title: '数字员工' },
  teams: { title: '员工组' },
  users: { title: '平台用户' },
  feedback: { title: '产品反馈' },
}
