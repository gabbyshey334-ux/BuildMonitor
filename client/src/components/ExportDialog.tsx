import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Download, FileText, Database } from "lucide-react";

interface ExportDialogProps {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ExportOptions {
  format: 'json' | 'csv';
  dataTypes: string[];
}

export default function ExportDialog({ 
  projectId, 
  projectName, 
  open, 
  onOpenChange 
}: ExportDialogProps) {
  const { toast } = useToast();
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [dataTypes, setDataTypes] = useState<string[]>(['all']);

  const dataTypeOptions = [
    { id: 'all', label: 'All Data', description: 'Complete project export' },
    { id: 'financial', label: 'Financial Data', description: 'Daily ledgers, deposits, expenses' },
    { id: 'tasks', label: 'Tasks', description: 'Project tasks and status' },
    { id: 'inventory', label: 'Inventory', description: 'Materials and usage tracking' },
    { id: 'milestones', label: 'Milestones', description: 'Project milestones and progress' }
  ];

  const handleDataTypeChange = (typeId: string, checked: boolean) => {
    if (typeId === 'all') {
      setDataTypes(checked ? ['all'] : []);
    } else {
      setDataTypes(prev => {
        const withoutAll = prev.filter(t => t !== 'all');
        if (checked) {
          return [...withoutAll, typeId];
        } else {
          return withoutAll.filter(t => t !== typeId);
        }
      });
    }
  };

  const exportMutation = useMutation({
    mutationFn: async (options: ExportOptions) => {
      const response = await apiRequest('POST', `/api/projects/${projectId}/export`, options);
      
      // Get the filename from content-disposition header
      const contentDisposition = response.headers.get('content-disposition');
      const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || 
                      `${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_export.${options.format}`;
      
      // Get the content
      const content = await response.text();
      
      // Create and trigger download
      const blob = new Blob([content], { 
        type: options.format === 'json' ? 'application/json' : 'text/csv' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return { filename };
    },
    onSuccess: (result) => {
      toast({
        title: "Export Successful",
        description: `Downloaded ${result.filename}`,
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export project data",
        variant: "destructive",
      });
    },
  });

  const handleExport = () => {
    if (dataTypes.length === 0) {
      toast({
        title: "No Data Selected",
        description: "Please select at least one data type to export",
        variant: "destructive",
      });
      return;
    }

    exportMutation.mutate({ format, dataTypes });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="bg-card-bg border border-white/10 max-w-md"
        data-testid="dialog-export-project"
        aria-describedby="export-description"
      >
        <DialogHeader>
          <DialogTitle className="text-white text-lg flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Project Data
          </DialogTitle>
          <DialogDescription id="export-description" className="text-sm text-muted-foreground">
            Export "{projectName}" data in your preferred format.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-white text-sm font-medium">Export Format</Label>
            <Select value={format} onValueChange={(value: 'json' | 'csv') => setFormat(value)}>
              <SelectTrigger className="bg-dark-bg border-white/20 text-white" data-testid="select-export-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card-bg border-white/20">
                <SelectItem value="json" data-testid="option-json">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    <div>
                      <div>JSON</div>
                      <div className="text-xs text-muted-foreground">Structured data, best for analysis</div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="csv" data-testid="option-csv">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <div>
                      <div>CSV</div>
                      <div className="text-xs text-muted-foreground">Spreadsheet compatible</div>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Data Type Selection */}
          <div className="space-y-3">
            <Label className="text-white text-sm font-medium">Data to Export</Label>
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {dataTypeOptions.map((option) => (
                <div key={option.id} className="flex items-start space-x-3">
                  <Checkbox
                    id={option.id}
                    checked={dataTypes.includes(option.id) || (dataTypes.includes('all') && option.id !== 'all')}
                    onCheckedChange={(checked) => handleDataTypeChange(option.id, !!checked)}
                    disabled={dataTypes.includes('all') && option.id !== 'all'}
                    className="mt-1"
                    data-testid={`checkbox-${option.id}`}
                  />
                  <div className="flex-1 min-w-0">
                    <label 
                      htmlFor={option.id} 
                      className="text-white text-sm font-medium cursor-pointer"
                    >
                      {option.label}
                    </label>
                    <p className="text-xs text-muted-foreground mt-1">
                      {option.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={exportMutation.isPending}
              className="text-white border-white/20 hover:bg-white/10"
              data-testid="button-cancel-export"
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={exportMutation.isPending || dataTypes.length === 0}
              className="bg-brand hover:bg-brand/90 text-white"
              data-testid="button-confirm-export"
            >
              {exportMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export Data
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}