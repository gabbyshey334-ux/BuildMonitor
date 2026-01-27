import { Home, Receipt, ListTodo, BookOpen, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";

type TabType = 'overview' | 'tasks' | 'financials' | 'suppliers' | 'inventory' | 'ledgers' | 'milestones';

interface MobileNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onSettingsOpen: () => void;
  onExport: () => void;
  onLogout: () => void;
  role: 'owner' | 'manager';
  onRoleChange: (role: 'owner' | 'manager') => void;
  userName?: string;
}

export default function MobileNav({
  activeTab,
  onTabChange,
  onSettingsOpen,
  onExport,
  onLogout,
  role,
  onRoleChange,
  userName
}: MobileNavProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const bottomNavItems = [
    { id: 'overview' as TabType, label: 'Home', icon: Home },
    { id: 'financials' as TabType, label: 'Finance', icon: Receipt },
    { id: 'tasks' as TabType, label: 'Tasks', icon: ListTodo },
    { id: 'ledgers' as TabType, label: 'Ledger', icon: BookOpen },
  ];

  const drawerItems = [
    { id: 'suppliers' as TabType, label: 'Suppliers', icon: 'fas fa-truck' },
    { id: 'inventory' as TabType, label: 'Inventory', icon: 'fas fa-boxes' },
    { id: 'milestones' as TabType, label: 'Milestones', icon: 'fas fa-flag' },
  ];

  const handleTabClick = (tab: TabType) => {
    onTabChange(tab);
    setIsDrawerOpen(false);
  };

  return (
    <>
      {/* Bottom Navigation Bar - Mobile Only */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-white/10 safe-area-pb">
        <div className="flex items-center justify-around h-16">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`relative flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  isActive 
                    ? 'text-brand' 
                    : 'text-muted-foreground hover:text-white'
                }`}
                data-testid={`mobile-nav-${item.id}`}
              >
                <Icon className="w-5 h-5 mb-1" />
                <span className="text-xs font-medium">{item.label}</span>
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand" />
                )}
              </button>
            );
          })}
          
          {/* More Menu */}
          <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <SheetTrigger asChild>
              <button
                className="flex flex-col items-center justify-center flex-1 h-full text-muted-foreground hover:text-white transition-colors"
                data-testid="mobile-nav-more"
              >
                <Menu className="w-5 h-5 mb-1" />
                <span className="text-xs font-medium">More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] bg-dark-bg border-white/10">
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-white">Menu</h2>
                  {userName && (
                    <p className="text-sm text-muted-foreground mt-1">{userName}</p>
                  )}
                </div>

                <Separator className="bg-white/10 mb-4" />

                {/* Role Switcher */}
                <div className="mb-6">
                  <p className="text-xs text-muted-foreground mb-2">View as</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        onRoleChange('owner');
                        setIsDrawerOpen(false);
                      }}
                      className={`h-10 px-4 rounded-lg text-sm font-medium transition-colors ${
                        role === 'owner'
                          ? 'bg-brand text-black'
                          : 'bg-white/5 text-white hover:bg-white/10'
                      }`}
                      data-testid="mobile-role-owner"
                    >
                      Owner
                    </button>
                    <button
                      onClick={() => {
                        onRoleChange('manager');
                        setIsDrawerOpen(false);
                      }}
                      className={`h-10 px-4 rounded-lg text-sm font-medium transition-colors ${
                        role === 'manager'
                          ? 'bg-brand text-black'
                          : 'bg-white/5 text-white hover:bg-white/10'
                      }`}
                      data-testid="mobile-role-manager"
                    >
                      Manager
                    </button>
                  </div>
                </div>

                <Separator className="bg-white/10 mb-4" />

                {/* Additional Pages */}
                <div className="flex-1 space-y-1">
                  <p className="text-xs text-muted-foreground mb-2 px-2">More Pages</p>
                  {drawerItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleTabClick(item.id)}
                      className={`w-full flex items-center gap-3 h-12 px-4 rounded-lg transition-colors ${
                        activeTab === item.id
                          ? 'bg-brand/20 text-brand'
                          : 'text-white hover:bg-white/5'
                      }`}
                      data-testid={`mobile-drawer-${item.id}`}
                    >
                      <i className={`${item.icon} w-5 text-center`}></i>
                      <span className="font-medium">{item.label}</span>
                    </button>
                  ))}
                </div>

                <Separator className="bg-white/10 my-4" />

                {/* Actions */}
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-12 text-white hover:bg-white/5"
                    onClick={() => {
                      onSettingsOpen();
                      setIsDrawerOpen(false);
                    }}
                    data-testid="mobile-settings"
                  >
                    <i className="fas fa-cog w-5 mr-3 text-center"></i>
                    Settings
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-12 text-white hover:bg-white/5"
                    onClick={() => {
                      onExport();
                      setIsDrawerOpen(false);
                    }}
                    data-testid="mobile-export"
                  >
                    <i className="fas fa-download w-5 mr-3 text-center"></i>
                    Export Data
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-12 text-red-400 hover:bg-red-500/10"
                    onClick={onLogout}
                    data-testid="mobile-logout"
                  >
                    <i className="fas fa-sign-out-alt w-5 mr-3 text-center"></i>
                    Logout
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Spacer for bottom nav on mobile */}
      <div className="md:hidden h-16" />
    </>
  );
}
