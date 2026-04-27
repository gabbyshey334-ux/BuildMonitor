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
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 pb-safe shadow-[0_-6px_24px_rgba(0,0,0,0.08)] backdrop-blur-md supports-[backdrop-filter]:bg-card/85 dark:shadow-[0_-6px_28px_rgba(0,0,0,0.35)]">
        <div className="grid min-h-[3.75rem] grid-cols-5 items-stretch px-0.5 xs:px-2">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTabClick(item.id)}
                aria-label={item.label}
                className={`relative flex min-h-[44px] min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 touch-manipulation transition-all active:scale-[0.97] xs:gap-1 xs:px-1 xs:py-2 ${
                  isActive
                    ? 'text-brand'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                data-testid={`mobile-nav-${item.id}`}
              >
                <Icon className="h-5 w-5 shrink-0 xs:h-6 xs:w-6" aria-hidden />
                <span className="max-[359px]:sr-only w-full truncate text-center text-[10px] font-medium leading-tight xs:text-xs">
                  {item.label}
                </span>
                {isActive && (
                  <span
                    className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-brand max-[359px]:hidden"
                    aria-hidden
                  />
                )}
              </button>
            );
          })}

          {/* More Menu */}
          <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="relative flex min-h-[44px] min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 text-muted-foreground touch-manipulation transition-all hover:text-foreground active:scale-[0.97] xs:gap-1 xs:px-1 xs:py-2"
                aria-label="More"
                data-testid="mobile-nav-more"
              >
                <Menu className="h-5 w-5 shrink-0 xs:h-6 xs:w-6" aria-hidden />
                <span className="max-[359px]:sr-only w-full truncate text-center text-[10px] font-medium leading-tight xs:text-xs">
                  More
                </span>
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] bg-card border-border/50">
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-foreground">Menu</h2>
                  {userName && (
                    <p className="text-sm text-muted-foreground mt-1">{userName}</p>
                  )}
                </div>

                <Separator className="border-border/50 mb-4" />

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
                          : 'bg-muted/40 text-foreground hover:bg-muted/60'
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
                          : 'bg-muted/40 text-foreground hover:bg-muted/60'
                      }`}
                      data-testid="mobile-role-manager"
                    >
                      Manager
                    </button>
                  </div>
                </div>

                <Separator className="border-border/50 mb-4" />

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
                          : 'text-foreground hover:bg-muted/40'
                      }`}
                      data-testid={`mobile-drawer-${item.id}`}
                    >
                      <i className={`${item.icon} w-5 text-center`}></i>
                      <span className="font-medium">{item.label}</span>
                    </button>
                  ))}
                </div>

                <Separator className="border-border/50 my-4" />

                {/* Actions */}
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-12 text-foreground hover:bg-muted/40"
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
                    className="w-full justify-start h-12 text-foreground hover:bg-muted/40"
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
      <div className="h-mobile-nav-spacer md:hidden shrink-0" aria-hidden />
    </>
  );
}
