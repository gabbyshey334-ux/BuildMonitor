import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, RefreshCw, LogOut, Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface HeaderProps {
  role: 'owner' | 'manager';
  onRoleChange: (role: 'owner' | 'manager') => void;
}

export default function Header({ role = 'owner', onRoleChange = () => {} }: HeaderProps) {
  const { user } = useAuth();

  const handleExportData = () => {
    // TODO: Implement data export functionality
    console.log("Export data");
  };

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const handleReset = () => {
    if (confirm('Reset demo data? This will clear all current data.')) {
      // TODO: Implement data reset
      console.log("Reset data");
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-dark-bg/90 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Brand Section */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-brand to-brand-2 rounded-xl flex items-center justify-center font-bold text-gray-900 shadow-lg">
              CM
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Construction Monitor Uganda</h1>
              <p className="text-xs text-muted-text">Enhanced project management system</p>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-muted-foreground" />
              <Select value={role} onValueChange={(value: 'owner' | 'manager') => onRoleChange(value)}>
                <SelectTrigger className="w-[120px] h-8 bg-card-bg border-white/20 text-white">
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
                <span className="text-sm text-white">
                  {(user as any)?.firstName || (user as any)?.email || 'User'}
                </span>
              </div>
            )}

            <Button
              onClick={handleExportData}
              className="btn-brand text-sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </Button>
            
            <Button
              onClick={handleReset}
              variant="outline"
              size="sm"
              className="btn-secondary"
              title="Reset demo data"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>

            <Button
              onClick={handleLogout}
              variant="outline" 
              size="sm"
              className="btn-ghost"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
