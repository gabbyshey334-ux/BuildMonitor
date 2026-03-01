import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Plus, Circle, AlertCircle, CheckCircle } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

interface Issue {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'inProgress' | 'resolved';
  priority: 'low' | 'medium' | 'high' | 'critical';
  reportedBy: string;
  reportedDate: Date;
  type: string; // Added for issue type breakdown
}

interface IssueTypeCount {
  type: string;
  count: number;
  percentage: number;
}

interface IssuesRisksSectionProps {
  data?: {
    todo: Issue[];
    inProgress: Issue[];
    resolved: Issue[];
    criticalIssues: number;
    highIssues: number;
    openIssues: number;
    resolvedThisWeek: number;
    types: IssueTypeCount[];
  };
}

const ISSUE_TYPE_COLORS: { [key: string]: string } = {
  Design: '#93C54E',
  Safety: '#E53E3E',
  Quality: '#218598',
  Logistics: '#ECC94B',
  Environmental: '#48BB78',
};

const formatDate = (date: Date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const IssueCard = ({ issue }: { issue: Issue }) => (
  <Card className={`cursor-pointer hover:shadow-md transition-shadow dark:bg-zinc-800/50 dark:border-zinc-700 bg-white border-slate-200 ${
    issue.priority === 'critical' ? 'border-l-4 border-l-alert-red' :
    issue.priority === 'high' ? 'border-l-4 border-l-warning-yellow' :
    ''
  }`}>
    <CardContent className="p-3">
      <div className="flex items-start justify-between mb-2">
        <h5 className="font-medium text-sm font-heading dark:text-white text-slate-800">{issue.title}</h5>
        <Badge
          variant={ issue.priority === 'critical' ? 'destructive' : issue.priority === 'high' ? 'secondary' : 'secondary'}
          className={`text-xs ${issue.priority === 'critical' ? 'bg-alert-red/10 text-alert-red' : issue.priority === 'high' ? 'bg-warning-yellow/10 text-warning-yellow' : ''}`}
        >
          {issue.priority}
        </Badge>
      </div>
      <p className="text-xs dark:text-[#CBD5E1] text-slate-600 mb-2 font-body">{issue.description}</p>
      <div className="flex items-center justify-between text-xs dark:text-[#94A3B8] text-slate-500 font-body">
        <span>{issue.reportedBy}</span>
        <span>{formatDate(issue.reportedDate)}</span>
      </div>
    </CardContent>
  </Card>
);

export function IssuesRisksSection({ data }: IssuesRisksSectionProps) {
  const issuesTodo = data?.todo || [];
  const issuesInProgress = data?.inProgress || [];
  const issuesResolved = data?.resolved || [];
  const criticalIssues = data?.criticalIssues ?? 0;
  const highIssues = data?.highIssues ?? 0;
  const openIssues = data?.openIssues ?? 0;
  const resolvedThisWeek = data?.resolvedThisWeek ?? 0;
  const issueTypes = data?.types || [];

  return (
    <Card className="dark:bg-zinc-800/50 dark:border-zinc-700 bg-white border-slate-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading dark:text-white text-slate-800 font-bold">Issues & Risks</CardTitle>
          <Button size="sm" className="dark:text-white dark:border-white/20 dark:hover:bg-white/10 text-slate-800 border-slate-200 hover:bg-slate-100">
            <Plus className="w-4 h-4 mr-2" />
            Report Issue
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Issue stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-alert-red font-heading">{criticalIssues}</p>
            <p className="text-xs dark:text-[#CBD5E1] text-slate-600 font-body">Critical</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-warning-yellow font-heading">{highIssues}</p>
            <p className="text-xs dark:text-[#CBD5E1] text-slate-600 font-body">High Priority</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold dark:text-white text-slate-800 font-heading">{openIssues}</p>
            <p className="text-xs dark:text-[#CBD5E1] text-slate-600 font-body">Open</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-success-green font-heading">{resolvedThisWeek}</p>
            <p className="text-xs dark:text-[#CBD5E1] text-slate-600 font-body">Resolved This Week</p>
          </div>
        </div>

        {/* Kanban-style issue cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* To Do */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2 font-heading dark:text-white text-slate-800">
              <Circle className="w-4 h-4 dark:text-[#94A3B8] text-slate-500" />
              To Do ({issuesTodo.length})
            </h4>
            <div className="space-y-2">
              {issuesTodo.map(issue => (
                <IssueCard key={issue.id} issue={issue} />
              ))}
            </div>
          </div>

          {/* In Progress */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2 font-heading dark:text-white text-slate-800">
              <AlertCircle className="w-4 h-4 text-ocean-pine" />
              In Progress ({issuesInProgress.length})
            </h4>
            <div className="space-y-2">
              {issuesInProgress.map(issue => (
                <IssueCard key={issue.id} issue={issue} />
              ))}
            </div>
          </div>

          {/* Resolved */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2 font-heading dark:text-white text-slate-800">
              <CheckCircle className="w-4 h-4 text-success-green" />
              Resolved ({issuesResolved.length})
            </h4>
            <div className="space-y-2">
              {issuesResolved.map(issue => (
                <IssueCard key={issue.id} issue={issue} />
              ))}
            </div>
          </div>
        </div>

        {/* Issue type breakdown - Small pie chart */}
        <div className="mt-6">
          <h4 className="font-semibold mb-3 font-heading dark:text-white text-slate-800">Issue Types</h4>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie
                  data={issueTypes}
                  dataKey="count"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                >
                  {issueTypes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={ISSUE_TYPE_COLORS[entry.type]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            
            <div className="flex-1 space-y-2">
              {issueTypes.map(type => (
                <div key={type.type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: ISSUE_TYPE_COLORS[type.type] }}
                    />
                    <span className="text-sm font-body dark:text-white text-slate-800">{type.type}</span>
                  </div>
                  <span className="font-medium font-body dark:text-zinc-300 text-slate-700">{type.count} ({type.percentage}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

