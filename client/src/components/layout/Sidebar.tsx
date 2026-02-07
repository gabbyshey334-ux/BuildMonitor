import React from 'react';
import { Link, useLocation } from 'wouter';
import {
  LayoutDashboard,
  Wallet,
  ClipboardList,
  Package,
  AlertCircle,
  Image,
  Settings,
  HelpCircle,
  Building2,
  FileText,
  LogOut
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Budget & Costs', href: '/dashboard/budget', icon: Wallet },
  { name: 'Tasks', href: '/dashboard/tasks', icon: ClipboardList },
  { name: 'Materials', href: '/dashboard/materials', icon: Package },
  { name: 'Issues & Risks', href: '/dashboard/issues', icon: AlertCircle },
  { name: 'Site Photos', href: '/dashboard/photos', icon: Image },
  { name: 'Reports', href: '/dashboard/reports', icon: FileText },
];

const bottomNav = [
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  { name: 'Help & Support', href: '/dashboard/help', icon: HelpCircle },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  // Fetch issues count for badge
  const { data: issuesData } = useQuery({
    queryKey: ['/api/dashboard/issues'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/dashboard/issues', {
          credentials: 'include',
        });
        if (!response.ok) return null;
        return response.json();
      } catch {
        return null;
      }
    },
    retry: false,
  });

  const openIssuesCount = issuesData?.todo?.length || 0;

  // Get user initials from fullName
  const getInitials = (name: string | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white border-r border-gray-200 px-6">
        {/* Logo */}
        <Link href="/dashboard">
          <a className="flex h-16 shrink-0 items-center gap-3 mt-4 cursor-pointer">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-[#93C54E] to-[#218598]">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">JengaTrack</h1>
              <p className="text-xs text-gray-500">Construction Monitor</p>
            </div>
          </a>
        </Link>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <ul role="list" className="-mx-2 space-y-1">
                {navigation.map((item) => {
                  // Check if location matches (including query params for dashboard)
                  const isActive = location === item.href || location.startsWith(item.href + '?');
                  const badge = item.name === 'Issues & Risks' ? openIssuesCount : null;
                  return (
                    <li key={item.name}>
                      <Link href={item.href}>
                        <a
                          className={`
                            group flex gap-x-3 rounded-lg p-3 text-sm font-semibold leading-6 transition-all
                            ${isActive
                              ? 'bg-gradient-to-r from-[#93C54E] to-[#218598] text-white shadow-lg'
                              : 'text-gray-700 hover:bg-gray-50 hover:text-[#218598]'
                            }
                          `}
                        >
                          <item.icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-[#218598]'}`} />
                          {item.name}
                          {badge && badge > 0 && (
                            <Badge className="ml-auto bg-red-500 text-white">
                              {badge}
                            </Badge>
                          )}
                        </a>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>

            {/* Bottom Navigation */}
            <li className="mt-auto">
              <ul role="list" className="-mx-2 space-y-1">
                {bottomNav.map((item) => {
                  // Check if location matches (including query params)
                  const isActive = location === item.href || location.startsWith(item.href + '?');
                  return (
                    <li key={item.name}>
                      <Link href={item.href}>
                        <a
                          className={`
                            group flex gap-x-3 rounded-lg p-3 text-sm font-semibold leading-6 transition-all
                            ${isActive
                              ? 'bg-gray-100 text-[#218598]'
                              : 'text-gray-700 hover:bg-gray-50 hover:text-[#218598]'
                            }
                          `}
                        >
                          <item.icon className="h-5 w-5 shrink-0 text-gray-400 group-hover:text-[#218598]" />
                          {item.name}
                        </a>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          </ul>
        </nav>

        {/* User Profile */}
        <div className="border-t border-gray-200 pt-4 pb-4 -mx-6 px-6">
          <div className="flex items-center gap-x-3 mb-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-gradient-to-br from-[#93C54E] to-[#218598] text-white font-semibold">
                {getInitials(user?.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {user?.fullName || 'User'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user?.whatsappNumber || 'No WhatsApp'}
              </p>
            </div>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-center"
            onClick={() => logout()}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
}

