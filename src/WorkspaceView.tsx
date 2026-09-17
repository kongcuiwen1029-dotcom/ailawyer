import { useState } from 'react'
import type { ViewId } from './nav'
import { ToastHost } from './ui/parts'
import EmployeesView from './views/EmployeesView'
import FeedbackView from './views/FeedbackView'
import ProjectsView from './views/ProjectsView'
import ResourcesView from './views/ResourcesView'
import TeamsView from './views/TeamsView'
import UsersView from './views/UsersView'
import { useWorkspace, type Project } from './state/workspace'

export type { Project }

export default function WorkspaceView({
  view,
  cardStyle = 'classic',
  onOpenProject = () => undefined,
  onNavigate = () => undefined,
}: {
  view: ViewId
  cardStyle?: 'classic' | 'detail'
  onOpenProject?: (project: Project) => void
  onNavigate?: (view: ViewId) => void
}) {
  const { employees, teams } = useWorkspace()
  const [pending, setPending] = useState<{ view: ViewId; id: string } | null>(null)

  const employeeFocus = pending?.view === 'employees' ? pending.id : null
  const teamFocus = pending?.view === 'teams' ? pending.id : null

  return (
    <div className="wv-scroll">
      <div className="wv">
        {view === 'projects' && <ProjectsView cardStyle={cardStyle} onOpenProject={onOpenProject} />}

        {view === 'resources' && <ResourcesView />}

        {view === 'employees' && (
          <EmployeesView
            key={employeeFocus ?? 'employees'}
            initialOpenId={employeeFocus ?? undefined}
            onOpenTeam={teamId => { setPending({ view: 'teams', id: teamId }); onNavigate('teams') }}
          />
        )}

        {view === 'teams' && (
          <TeamsView
            key={teamFocus ?? 'teams'}
            initialOpenId={teamFocus ?? undefined}
            onOpenEmployee={employeeId => { setPending({ view: 'employees', id: employeeId }); onNavigate('employees') }}
          />
        )}

        {view === 'users' && <UsersView />}

        {view === 'feedback' && <FeedbackView />}

        {view === 'new' && (
          <p className="wv-empty">
            请在左侧「新建」开始一次对话；已经存在 {employees.filter(employee => employee.status === 'active').length} 位启用中的数字员工、
            {teams.filter(team => team.status === 'active').length} 个启用中的员工组。
          </p>
        )}
      </div>
      <ToastHost />
    </div>
  )
}
