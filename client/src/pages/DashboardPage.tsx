import React from 'react';
import { useQuery } from '@tanstack/react-query';
import EmptyState from './EmptyState';
import FullDashboard from '@/components/dashboard-new/DashboardPage';

export default function DashboardPageWrapper() {
  const { data: projectsResponse, isLoading } = useQuery<{ success: boolean; projects: any[] }>({
    queryKey: ['/api/projects'],
    queryFn: async () => {
      const response = await fetch('/api/projects', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }
      
      return response.json();
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#218598] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show empty state if no projects
  if (!projectsResponse?.projects || projectsResponse.projects.length === 0) {
    return <EmptyState />;
  }

  // Show full dashboard with data
  return <FullDashboard />;
}

