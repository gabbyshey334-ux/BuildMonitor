import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import MobileNav from "@/components/MobileNav";
import ProjectSelector from "@/components/ProjectSelector";
import CreateProjectDialog from "@/components/CreateProjectDialog";
import ExportDialog from "@/components/ExportDialog";
import OverviewDashboard from "@/components/OverviewDashboard";
import TaskManagement from "@/components/TaskManagement";
// Legacy components archived - no longer in use
// import FinancialDashboard from "@/components/FinancialDashboard";
// import SupplierManagement from "@/components/SupplierManagement";
// import DailyLedgerSystem from "@/components/DailyLedgerSystem";
// import InventoryManagement from "@/components/InventoryManagement";
// import MilestoneManagement from "@/components/MilestoneManagement";
import TabProtection from "@/components/TabProtection";
import SettingsDialog from "@/components/Settings";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import { websocketManager, setNotificationHandler } from "@/lib/websocket";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Project } from "@shared/schema";

type TabType = 'overview' | 'tasks' | 'financials' | 'suppliers' | 'inventory' | 'ledgers' | 'milestones';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVerifiedForSession, setIsVerifiedForSession] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<'owner' | 'manager'>('manager');
  const { user, logout } = useAuth();
  const { toast } = useToast();
  
  const userRole = user?.role === 'owner' ? 'owner' : 'manager';

  // Sync currentUserRole with actual user role when user data changes
  useEffect(() => {
    if (user?.role) {
      setCurrentUserRole(user.role);
    }
  }, [user?.role]);

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

  // Connect to WebSocket for real-time updates and set up notifications
  useEffect(() => {
    if (user) {
      // Store user data for WebSocket notifications
      sessionStorage.setItem('user-data', JSON.stringify(user));
      
      // Set up notification handler
      setNotificationHandler(toast);
      
      websocketManager.connect();
    }
    
    return () => {
      websocketManager.disconnect();
    };
  }, [user, toast]);

  // Handle unauthorized errors
  useEffect(() => {
    if (projectsError && isUnauthorizedError(projectsError as Error)) {
      queryClient.clear();
      websocketManager.disconnect();
      // No toast or redirect here - let the router handle it
    }
  }, [projectsError]);

  // Handle logout
  const handleLogout = async () => {
    try {
      // Disconnect WebSocket first
      websocketManager.disconnect();
      
      // Call logout function from auth context (handles cache clearing and redirect)
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
      // Even if logout fails, force redirect
      window.location.href = "/";
    }
  };

  // Handle tab switching with protection
  const handleTabChange = (newTab: TabType | string) => {
    const tab = newTab as TabType;
    if (tab === 'overview' || isVerifiedForSession) {
      setActiveTab(tab);
    } else {
      setActiveTab(tab); // Show protection screen
    }
  };

  // Handle session verification (one-time per session)
  const handleSessionVerified = () => {
    setIsVerifiedForSession(true);
  };

  // Handle role switching
  const handleRoleChange = (newRole: 'owner' | 'manager') => {
    setCurrentUserRole(newRole);
    
    // If switching to owner, require re-verification
    if (newRole === 'owner' && isVerifiedForSession) {
      setIsVerifiedForSession(false);
    }
  };

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
        <div className="bg-card/50 border-b border-white/10 p-4">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-white">Construction Monitor Uganda</h1>
              <p className="text-sm text-muted-foreground">
                Logged in as: {user?.username} ({user?.role})
              </p>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="border-red-600/40 text-red-300 hover:bg-red-600/20"
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
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
      <Header
        role={currentUserRole}
        onRoleChange={handleRoleChange}
        onExport={() => setIsExportDialogOpen(true)}
      />
      
      <main className="w-full mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-full sm:max-w-7xl">
        {/* Project Selector */}
        <ProjectSelector
          projects={projects}
          selectedProjectId={selectedProjectId}
          onProjectChange={setSelectedProjectId}
        />

        {/* Navigation Tabs - Desktop Only */}
        <div className="mb-6 hidden md:block">
          <div className="flex gap-2 flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id as TabType)}
                className={`nav-tab ${
                  activeTab === tab.id ? 'nav-tab-active' : 'nav-tab-inactive'
                } min-h-[44px] px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base relative`}
                data-testid={`tab-${tab.id}`}
              >
                <i className={`${tab.icon} mr-1 sm:mr-2`}></i>
                <span>{tab.label}</span>
                {!isVerifiedForSession && currentUserRole === 'owner' && tab.id !== 'overview' && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full flex items-center justify-center">
                    <i className="fas fa-lock text-xs text-black"></i>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {selectedProject && (
          <>
            {activeTab === 'overview' && (
              <OverviewDashboard project={selectedProject} onTabChange={handleTabChange} userRole={currentUserRole} />
            )}
            
            {activeTab === 'tasks' && (
              (isVerifiedForSession || currentUserRole === 'manager') ? (
                <TaskManagement projectId={selectedProject.id} userRole={currentUserRole} />
              ) : (
                <TabProtection onVerified={handleSessionVerified} tabName="Owner Access Required" />
              )
            )}
            
            {/* Legacy tabs archived - these features are not yet implemented with new API */}
            {activeTab === 'financials' && (
              <div className="p-8 text-center">
                <p className="text-muted-foreground">Financial Dashboard - Coming Soon</p>
              </div>
            )}
            
            {activeTab === 'suppliers' && (
              <div className="p-8 text-center">
                <p className="text-muted-foreground">Supplier Management - Coming Soon</p>
              </div>
            )}
            
            {activeTab === 'inventory' && (
              <div className="p-8 text-center">
                <p className="text-muted-foreground">Inventory Management - Coming Soon</p>
              </div>
            )}
            
            {activeTab === 'ledgers' && (
              <div className="p-8 text-center">
                <p className="text-muted-foreground">Daily Ledger System - Coming Soon</p>
              </div>
            )}
            
            {activeTab === 'milestones' && (
              <div className="p-8 text-center">
                <p className="text-muted-foreground">Milestone Management - Coming Soon</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Export Dialog */}
      {selectedProject && (
        <ExportDialog
          projectId={selectedProject.id}
          projectName={selectedProject.name}
          open={isExportDialogOpen}
          onOpenChange={setIsExportDialogOpen}
        />
      )}

      {/* Settings Dialog */}
      <SettingsDialog 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Mobile Navigation */}
      <MobileNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onSettingsOpen={() => setIsSettingsOpen(true)}
        onExport={() => setIsExportDialogOpen(true)}
        onLogout={handleLogout}
        role={currentUserRole}
        onRoleChange={handleRoleChange}
        userName={(user as any)?.firstName || (user as any)?.email || 'User'}
      />

      {/* Footer - Hidden on mobile to avoid conflict with bottom nav */}
      <footer className="hidden md:block bg-card/50 border-t border-white/10 py-6 mt-12">
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
