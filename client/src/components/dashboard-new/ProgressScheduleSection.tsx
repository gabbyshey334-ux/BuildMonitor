import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Calendar } from 'lucide-react';

interface Phase {
  id: string;
  name: string;
  percentComplete: number;
  status: 'pending' | 'in-progress' | 'completed' | 'delayed';
  daysDelayed?: number;
  delayReason?: string;
}

interface Milestone {
  id: string;
  title: string;
  dueDate: Date;
  priority: 'low' | 'medium' | 'high';
}

interface ProgressScheduleSectionData {
  phases: Phase[];
  upcomingMilestones: Milestone[];
}

export function ProgressScheduleSection({ data }: { data?: ProgressScheduleSectionData }) {
  const { phases = [], upcomingMilestones = [] } = data || {};

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle>Progress & Schedule</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <section>
            <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">Phases Overview</h3>
            <div className="space-y-4">
              {phases.length > 0 ? (
                phases.map((phase) => (
                  <div key={phase.id} className="flex items-center space-x-4">
                    <div className="w-2/5 font-medium text-gray-700 dark:text-gray-300">{phase.name}</div>
                    <div className="flex-1">
                      <Progress value={phase.percentComplete} className="h-2 rounded-full" />
                      <span className="text-sm text-gray-500 dark:text-gray-400 mt-1 block">
                        {phase.percentComplete}% Complete
                      </span>
                    </div>
                    <Badge
                      className={`
                        ${phase.status === 'completed' && 'bg-success-green hover:bg-success-green/80'}
                        ${phase.status === 'in-progress' && 'bg-blue-500 hover:bg-blue-500/80'}
                        ${phase.status === 'delayed' && 'bg-alert-red hover:bg-alert-red/80'}
                        ${phase.status === 'pending' && 'bg-warning-yellow hover:bg-warning-yellow/80'}
                        text-white
                      `}
                    >
                      {phase.status.charAt(0).toUpperCase() + phase.status.slice(1)}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No phase data available.</p>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">Upcoming Milestones</h3>
            <div className="space-y-3">
              {upcomingMilestones.length > 0 ? (
                upcomingMilestones.map((milestone) => (
                  <div key={milestone.id} className="flex items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                    <Calendar className="text-blue-500 mr-3 flex-shrink-0" size={20} />
                    <div className="flex-1">
                      <p className="font-medium text-gray-800 dark:text-gray-200">{milestone.title}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Due: {new Date(milestone.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      className={`
                        ${milestone.priority === 'high' && 'bg-alert-red hover:bg-alert-red/80'}
                        ${milestone.priority === 'medium' && 'bg-warning-yellow hover:bg-warning-yellow/80'}
                        ${milestone.priority === 'low' && 'bg-success-green hover:bg-success-green/80'}
                        text-white
                      `}
                    >
                      {milestone.priority.charAt(0).toUpperCase() + milestone.priority.slice(1)} Priority
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No upcoming milestones.</p>
              )}
            </div>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}


