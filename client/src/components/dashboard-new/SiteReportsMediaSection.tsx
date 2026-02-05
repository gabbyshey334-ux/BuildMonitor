import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Expand } from 'lucide-react';

interface SiteReportsMediaSectionProps {
  // TODO: Define props for data
}

const recentPhotos = [
  { id: 'p1', thumbnailUrl: 'https://via.placeholder.com/150/93C54E/FFFFFF?text=Site+1', caption: 'Foundation work in progress', date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
  { id: 'p2', thumbnailUrl: 'https://via.placeholder.com/150/218598/FFFFFF?text=Site+2', caption: 'Steel reinforcement installation', date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
  { id: 'p3', thumbnailUrl: 'https://via.placeholder.com/150/2D3748/FFFFFF?text=Site+3', caption: 'Concrete pouring - ground floor', date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
  { id: 'p4', thumbnailUrl: 'https://via.placeholder.com/150/E2E8F0/000000?text=Site+4', caption: 'Roofing structure complete', date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) },
  { id: 'p5', thumbnailUrl: 'https://via.placeholder.com/150/93C54E/FFFFFF?text=Site+5', caption: 'Interior finishing - painting', date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
  { id: 'p6', thumbnailUrl: 'https://via.placeholder.com/150/218598/FFFFFF?text=Site+6', caption: 'Exterior facade complete', date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) },
];

const dailyLogsThisWeek = 5;
const photosUploaded = 25;
const totalPhotos = 50;

const formatDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const openPhotoModal = (photo: any) => {
  console.log('Open photo modal for:', photo.caption);
  // TODO: Implement actual modal opening logic
};

export function SiteReportsMediaSection(/* { data }: SiteReportsMediaSectionProps */) {
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

