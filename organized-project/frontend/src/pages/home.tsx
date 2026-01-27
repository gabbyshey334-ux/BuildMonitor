import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import ProjectSelector from "@/components/ProjectSelector";
import CreateProjectDialog from "@/components/CreateProjectDialog";
import OverviewDashboard from "@/components/OverviewDashboard";
import TaskManagement from "@/components/TaskManagement";
import FinancialDashboard from "@/components/FinancialDashboard";
import SupplierManagement from "@/components/SupplierManagement";
import DailyLedgerSystem from "@/components/DailyLedgerSystem";
import InventoryManagement from "@/components/InventoryManagement";
import MilestoneManagement from "@/components/MilestoneManagement";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Project } from "@shared/schema";

type TabType = 'overview' | 'tasks' | 'financials' | 'suppliers' | 'inventory' | 'ledgers' | 'milestones';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [userRole, setUserRole] = useState<'owner' | 'manager'>('owner');
  const { toast } = useToast();

  const { data: projects, isLoading: projectsLoading, error: projectsError } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    retry: false,
  });

  // Set first project as selected if none is selected
  useEffect(() => {
    if (projects && projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // Handle unauthorized errors
  useEffect(() => {
    if (projectsError && isUnauthorizedError(projectsError as Error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [projectsError, toast]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'fas fa-chart-line' },
    { id: 'tasks', label: 'Tasks', icon: 'fas fa-tasks' },
    { id: 'financials', label: 'Financials', icon: 'fas fa-dollar-sign' },
    { id: 'suppliers', label: 'Suppliers', icon: 'fas fa-truck' },
    { id: 'inventory', label: 'Inventory', icon: 'fas fa-boxes' },
    { id: 'ledgers', label: 'Daily Ledgers', icon: 'fas fa-book' },
    { id: 'milestones', label: 'Milestones', icon: 'fas fa-flag' },
  ] as const;

  if (projectsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading projects...</p>
        </div>
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="min-h-screen">
        <Header role={userRole} onRoleChange={setUserRole} />
        <main className="w-full mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-full sm:max-w-7xl">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-white mb-4">No Projects Found</h2>
            <p className="text-muted-foreground mb-6">Create your first construction project to get started.</p>
            <button 
              onClick={() => setIsCreateDialogOpen(true)}
              className="btn-brand px-6 py-3 rounded-xl"
            >
              <i className="fas fa-plus mr-2"></i>Create Project
            </button>
            <CreateProjectDialog
              open={isCreateDialogOpen}
              onOpenChange={setIsCreateDialogOpen}
              onProjectCreated={setSelectedProjectId}
            />
          </div>
        </main>
      </div>
    );
  }

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <div className="min-h-screen">
      <Header role={userRole} onRoleChange={setUserRole} />
      
      <main className="w-full mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-full sm:max-w-7xl">
        {/* Project Selector */}
        <ProjectSelector
          projects={projects}
          selectedProjectId={selectedProjectId}
          onProjectChange={setSelectedProjectId}
        />

        {/* Navigation Tabs */}
        <div className="mb-6">
          <div className="flex gap-2 flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`nav-tab ${
                  activeTab === tab.id ? 'nav-tab-active' : 'nav-tab-inactive'
                } min-h-[44px] px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base`}
              >
                <i className={`${tab.icon} mr-1 sm:mr-2`}></i>
                <span className="hidden xs:inline sm:inline">{tab.label}</span>
                <span className="xs:hidden sm:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {selectedProject && (
          <>
            {activeTab === 'overview' && (
              <OverviewDashboard project={selectedProject} onTabChange={(tab) => setActiveTab(tab as TabType)} userRole={userRole} />
            )}
            {activeTab === 'tasks' && (
              <TaskManagement projectId={selectedProject.id} userRole={userRole} />
            )}
            {activeTab === 'financials' && (
              <FinancialDashboard projectId={selectedProject.id} userRole={userRole} />
            )}
            {activeTab === 'suppliers' && (
              <SupplierManagement projectId={selectedProject.id} />
            )}
            {activeTab === 'inventory' && (
              <InventoryManagement projectId={selectedProject.id} />
            )}
            {activeTab === 'ledgers' && (
              <DailyLedgerSystem 
                projectId={selectedProject.id} 
                userRole={userRole === 'owner' ? "Owner" : "Manager"} 
              />
            )}
            {activeTab === 'milestones' && (
              <MilestoneManagement projectId={selectedProject.id} />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-card/50 border-t border-white/10 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Construction Monitor Uganda - Phase 1 features: Money management • Supplier credit • Inventory • Milestones • Daily Accountability
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Server-hosted with data persistence and photo uploads
          </p>
        </div>
      </footer>
    </div>
  );
}
