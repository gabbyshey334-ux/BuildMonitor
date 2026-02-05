import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Expand } from 'lucide-react';

interface Photo {
  id: string;
  url: string;
  description: string;
  date: string | Date;
}

interface SiteReportsMediaSectionData {
  recentPhotos: Photo[];
  stats: {
    dailyLogsThisWeek: number;
    siteCondition: string;
  };
}

const formatDate = (date: string | Date) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const openPhotoModal = (photo: Photo) => {
  console.log('Open photo modal for:', photo.description);
  // TODO: Implement actual modal opening logic
};

export function SiteReportsMediaSection({ data }: { data?: SiteReportsMediaSectionData }) {
  const { recentPhotos = [], stats } = data || {};
  const dailyLogsThisWeek = stats?.dailyLogsThisWeek || 0;
  const siteCondition = stats?.siteCondition || 'Good';
  const photosUploaded = recentPhotos.length;
  const totalPhotos = photosUploaded; // In real app, this would come from API
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading">Site Reports & Media</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-body">{recentPhotos.length} photos</Badge>
            <Badge variant="secondary" className="font-body">{dailyLogsThisWeek} logs this week</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-4 bg-ash-gray rounded-lg">
            <p className="text-2xl font-bold font-heading">{dailyLogsThisWeek}</p>
            <p className="text-xs text-muted-foreground font-body">Daily Logs This Week</p>
          </div>
          <div className="text-center p-4 bg-ash-gray rounded-lg">
            <p className="text-2xl font-bold font-heading">{photosUploaded}</p>
            <p className="text-xs text-muted-foreground font-body">Photos Uploaded</p>
          </div>
          <div className="text-center p-4 bg-ash-gray rounded-lg">
            <p className="text-2xl font-bold text-success-green font-heading">Good</p>
            <p className="text-xs text-muted-foreground font-body">Site Condition</p>
          </div>
        </div>

        {/* Photo gallery - thumbnail grid */}
        <div>
          <h4 className="font-semibold mb-3 font-heading">Recent Site Photos</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {recentPhotos.map(photo => (
              <div 
                key={photo.id} 
                className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
                onClick={() => openPhotoModal(photo)}
              >
                <img 
                  src={photo.thumbnailUrl} 
                  alt={photo.caption}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Expand className="w-6 h-6 text-white" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="text-white text-xs truncate font-body">{photo.caption}</p>
                  <p className="text-white/70 text-xs font-body">{formatDate(photo.date)}</p>
                </div>
              </div>
            ))}
          </div>
          
          <Button variant="outline" className="w-full mt-4 font-body">
            View All Photos ({totalPhotos})
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

