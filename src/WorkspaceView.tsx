import { useState } from 'react'
import type { ViewId } from './nav'
import { ToastHost } from './ui/parts'
import DatasetsView from './views/DatasetsView'
import EmployeesView from './views/EmployeesView'
import FeedbackView from './views/FeedbackView'
import ProjectsView from './views/ProjectsView'
import ResourcesView from './views/ResourcesView'
import TeamsView from './views/TeamsView'
import TracesView from './views/TracesView'
import UsersView from './views/UsersView'
import { useWorkspace, type Project, type TraceFocus } from './state/workspace'

export type { Project }

export default function WorkspaceView({
  view,
  cardStyle = 'classic',
  onOpenProject = () => undefined,
  onNewProject = () => undefined,
  onNavigate = () => undefined,
}: {
  view: ViewId
  cardStyle?: 'classic' | 'detail'
  onOpenProject?: (project: Project) => void
  onNewProject?: () => void
  onNavigate?: (view: ViewId) => void
}) {
  const { employees, teams, setTraceFocus } = useWorkspace()
  const [pending, setPending] = useState<{ view: ViewId; id: string } | null>(null)

  const employeeFocus = pending?.view === 'employees' ? pending.id : null
  const teamFocus = pending?.view === 'teams' ? pending.id : null

  function openTrace(focus: TraceFocus) {
    setTraceFocus(focus)
    onNavigate('traces')
  }

  return (
    <div className="wv-scroll">
      <div className="wv">
        {view === 'projects' && <ProjectsView cardStyle={cardStyle} onOpenProject={onOpenProject} onNewProject={onNewProject} />}

        {view === 'resources' && <ResourcesView />}

        {view === 'employees' && (
          <EmployeesView
            key={employeeFocus ?? 'employees'}
            initialOpenId={employeeFocus ?? undefined}
            onDebug={employee => openTrace({ kind: 'employee', id: employee.id })}
            onOpenTeam={teamId => { setPending({ view: 'teams', id: teamId }); onNavigate('teams') }}
          />
        )}

        {view === 'teams' && (
          <TeamsView
            key={teamFocus ?? 'teams'}
            initialOpenId={teamFocus ?? undefined}
            onDebug={team => openTrace({ kind: 'team', id: team.id })}
            onOpenEmployee={employeeId => { setPending({ view: 'employees', id: employeeId }); onNavigate('employees') }}
          />
        )}

        {view === 'datasets' && <DatasetsView />}

        {view === 'traces' && <TracesView />}

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
