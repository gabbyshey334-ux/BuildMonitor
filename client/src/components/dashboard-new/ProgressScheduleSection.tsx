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
    <Card className="dark:bg-zinc-800/50 dark:border-zinc-700 bg-white border-slate-200 col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle className="dark:text-white text-slate-800 font-bold">Progress & Schedule</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <section>
            <h3 className="text-lg font-semibold mb-3 dark:text-white text-slate-800">Phases Overview</h3>
            <div className="space-y-4">
              {phases.length > 0 ? (
                phases.map((phase) => (
                  <div key={phase.id} className="flex items-center space-x-4">
                    <div className="w-2/5 font-medium dark:text-white text-slate-800">{phase.name}</div>
                    <div className="flex-1">
                      <Progress value={phase.percentComplete} className="h-2 rounded-full" />
                      <span className="text-sm dark:text-[#CBD5E1] text-slate-600 mt-1 block">
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
                      {phase.status === 'pending' ? 'Not Started' : phase.status === 'in-progress' ? 'In-progress' : phase.status.charAt(0).toUpperCase() + phase.status.slice(1)}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="dark:text-[#94A3B8] text-slate-500">No tasks created yet. Add tasks from Settings or log progress via WhatsApp.</p>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3 dark:text-white text-slate-800">Upcoming Milestones</h3>
            <div className="space-y-3">
              {upcomingMilestones.length > 0 ? (
                upcomingMilestones.map((milestone) => (
                  <div key={milestone.id} className="flex items-center p-3 dark:border-zinc-700 border-slate-200 border rounded-lg shadow-sm">
                    <Calendar className="text-ocean-pine mr-3 flex-shrink-0" size={20} />
                    <div className="flex-1">
                      <p className="font-medium dark:text-white text-slate-800">{milestone.title}</p>
                      <p className="text-sm dark:text-[#CBD5E1] text-slate-600">
                        Due: {new Date(milestone.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
                <p className="dark:text-[#94A3B8] text-slate-500">No upcoming milestones.</p>
              )}
            </div>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}


