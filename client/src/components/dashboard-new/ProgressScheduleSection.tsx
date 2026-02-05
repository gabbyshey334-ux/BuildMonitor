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

