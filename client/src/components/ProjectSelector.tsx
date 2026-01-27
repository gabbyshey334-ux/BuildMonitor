import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Share2, Plus } from "lucide-react";
import CreateProjectDialog from "./CreateProjectDialog";
import type { Project } from "@shared/schema";

interface ProjectSelectorProps {
  projects: Project[];
  selectedProjectId: string;
  onProjectChange: (projectId: string) => void;
}

export default function ProjectSelector({ 
  projects, 
  selectedProjectId, 
  onProjectChange 
}: ProjectSelectorProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const handleShare = () => {
    // Project sharing functionality removed for production
  };

  const handleNewProject = () => {
    setIsCreateDialogOpen(true);
  };

  const handleProjectCreated = (projectId: string) => {
    onProjectChange(projectId);
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <div className="mb-6">
      <Card className="bg-card-bg border border-white/10 p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-muted-text">
              Current Project:
            </label>
            <Select value={selectedProjectId} onValueChange={onProjectChange}>
              <SelectTrigger className="bg-dark-bg border border-white/20 min-w-64 text-white">
                <SelectValue>
                  {selectedProject ? `${selectedProject.name} - ${selectedProject.description}` : 'Select project'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-card-bg border border-white/20">
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id} className="text-white hover:bg-white/10">
                    {project.name} - {project.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleShare}
              variant="outline"
              size="sm"
              className="bg-accent/20 hover:bg-accent/30 border-accent/40 text-white"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share Project
            </Button>
            <Button
              onClick={handleNewProject}
              size="sm"
              className="bg-green-600/20 hover:bg-green-600/30 border border-green-600/40 text-green-300"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </div>
        </div>
      </Card>
      
      <CreateProjectDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onProjectCreated={handleProjectCreated}
      />
    </div>
  );
}
