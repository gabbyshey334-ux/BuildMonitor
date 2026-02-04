import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, RefreshCw, LogOut, Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import SettingsDialog from "./Settings";
import { ThemeToggle } from "@/components/ThemeToggle";

interface HeaderProps {
  role: 'owner' | 'manager';
  onRoleChange: (role: 'owner' | 'manager') => void;
  onExport?: () => void;
}

export default function Header({ role = 'owner', onRoleChange = () => {}, onExport }: HeaderProps) {
  const { user } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleExportData = () => {
    if (onExport) {
      onExport();
    } else {
      // Fallback for backward compatibility
    }
  };

  const handleLogout = async () => {
    try {
      // Call logout API to clear session
      await fetch("/api/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Always redirect to landing page
      window.location.href = "/";
    }
  };

  const handleReset = () => {
    if (confirm('Reset demo data? This will clear all current data.')) {
      // Reset functionality removed for production
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-brand-gradient text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Brand Section */}
          <div className="flex items-center gap-2 sm:gap-3">
            <img
              src="/images/logo/jengatrack-icon.svg"
              alt="JengaTrack"
              className="w-8 h-8 sm:w-10 sm:h-10"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            <div>
              <h1 className="text-sm sm:text-lg font-heading font-bold text-white">JengaTrack</h1>
              <p className="text-xs text-white/80 hidden sm:block font-body">Track budgets. Stay on schedule.</p>
            </div>
          </div>

          {/* Desktop Toolbar - Hidden on mobile */}
          <div className="hidden md:flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSettingsOpen(true)}
                className="h-8 w-8 p-0 text-white/80 hover:text-white hover:bg-white/10"
                data-testid="button-settings"
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Select value={role} onValueChange={(value: 'owner' | 'manager') => onRoleChange(value)}>
                <SelectTrigger className="w-[120px] h-8 bg-white/10 border-white/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {user && (
              <div className="flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full">
                {(user as any)?.profileImageUrl && (
                  <img 
                    src={(user as any).profileImageUrl} 
                    alt="Profile" 
                    className="w-6 h-6 rounded-full object-cover"
                  />
                )}
                <span className="text-sm text-white font-body">
                  {(user as any)?.firstName || (user as any)?.email || 'User'}
                </span>
              </div>
            )}

            <Button
              onClick={handleExportData}
              className="bg-white text-ocean-pine hover:bg-ash-gray font-heading font-semibold text-sm"
              data-testid="button-export-data"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </Button>
            
            <Button
              onClick={handleReset}
              variant="outline"
              size="sm"
              className="border-white/30 text-white hover:bg-white/10"
              title="Reset demo data"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>

            <Button
              onClick={handleLogout}
              variant="outline" 
              size="sm"
              className="border-white/30 text-white hover:bg-white/10"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>

          {/* Mobile: Theme toggle + user profile */}
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            {user && (user as any)?.profileImageUrl && (
              <img 
                src={(user as any).profileImageUrl} 
                alt="Profile" 
                className="w-8 h-8 rounded-full object-cover"
              />
            )}
          </div>
        </div>
      </div>

      {/* Settings Dialog */}
      <SettingsDialog 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </header>
  );
}
