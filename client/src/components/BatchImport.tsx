import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, AlertTriangle, Upload, FileCheck, ArrowLeft, RotateCcw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface BatchImportProps {
  projectId: string;
  validData: any[];
  fileName: string;
  onBack: () => void;
  onComplete: () => void;
  className?: string;
}

interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
  details: {
    successfulImports: any[];
    failedImports: { data: any; error: string }[];
  };
}

interface ImportProgress {
  current: number;
  total: number;
  percentage: number;
  status: 'preparing' | 'importing' | 'complete' | 'error';
  currentItem?: string;
}

export default function BatchImport({
  projectId,
  validData,
  fileName,
  onBack,
  onComplete,
  className = ""
}: BatchImportProps) {
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    current: 0,
    total: validData.length,
    percentage: 0,
    status: 'preparing'
  });
  
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Batch import mutation
  const batchImportMutation = useMutation({
    mutationFn: async (expenses: any[]) => {
      setImportProgress(prev => ({ ...prev, status: 'importing' }));
      
      const results: ImportResult = {
        success: false,
        imported: 0,
        failed: 0,
        errors: [],
        details: {
          successfulImports: [],
          failedImports: []
        }
      };

      const totalItems = expenses.length;
      
      // Process expenses in batches to avoid overwhelming the server
      const batchSize = 5; // Import 5 at a time
      
      for (let i = 0; i < expenses.length; i += batchSize) {
        const batch = expenses.slice(i, i + batchSize);
        
        // Process batch concurrently
        const batchPromises = batch.map(async (expense, batchIndex) => {
          const globalIndex = i + batchIndex;
          
          try {
            // Update progress
            setImportProgress(prev => ({
              ...prev,
              current: globalIndex + 1,
              percentage: Math.round(((globalIndex + 1) / totalItems) * 100),
              currentItem: expense.description
            }));

            // Convert data to API format
            const apiExpense = {
              projectId,
              description: expense.description || '',
              amount: expense.amount ? String(expense.amount).replace(/[^\d.-]/g, '') : '0',
              date: expense.date,
              category: expense.category || 'Materials',
              paymentMethod: expense.paymentMethod || 'cash',
              quantity: expense.quantity || null,
              unit: expense.unit || '',
              note: expense.note || '',
              isHistorical: true,
              phaseId: expense.phaseId || null, // null is allowed for foreign keys
              supplierId: expense.supplierId || null
            };

            // Make API call
            const response = await apiRequest('POST', `/api/projects/${projectId}/historical-expenses`, apiExpense);
            
            results.details.successfulImports.push(response);
            results.imported++;
            
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            results.errors.push(`Row ${expense.rowNumber}: ${errorMessage}`);
            results.details.failedImports.push({
              data: expense,
              error: errorMessage
            });
            results.failed++;
          }
        });

        // Wait for current batch to complete before moving to next
        await Promise.all(batchPromises);
        
        // Small delay to prevent overwhelming the server
        if (i + batchSize < expenses.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      results.success = results.imported > 0;
      return results;
    },
    onSuccess: (result: ImportResult) => {
      setImportResult(result);
      setImportProgress(prev => ({ ...prev, status: 'complete' }));
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'historical-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'analytics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'activities'] });
      
      // Show success toast
      if (result.imported > 0) {
        toast({
          title: "Import Successful!",
          description: `Successfully imported ${result.imported} expense records.`,
        });
      }
    },
    onError: (error: any) => {
      const errorMessage = error instanceof Error ? error.message : 'Import failed';
      setImportProgress(prev => ({ ...prev, status: 'error' }));
      setImportResult({
        success: false,
        imported: 0,
        failed: validData.length,
        errors: [errorMessage],
        details: {
          successfulImports: [],
          failedImports: validData.map(item => ({ data: item, error: errorMessage }))
        }
      });
      
      toast({
        title: "Import Failed",
        description: errorMessage,
        variant: "destructive"
      });
    }
  });

  // Start import process
  const startImport = () => {
    if (validData.length === 0) return;
    
    setImportProgress({
      current: 0,
      total: validData.length,
      percentage: 0,
      status: 'preparing'
    });
    
    batchImportMutation.mutate(validData);
  };

  // Retry import
  const retryImport = () => {
    setImportResult(null);
    startImport();
  };

  // Handle completion
  const handleComplete = () => {
    onComplete();
  };

  // Get status icon
  const getStatusIcon = () => {
    switch (importProgress.status) {
      case 'importing':
        return <Upload className="h-6 w-6 text-ocean-pine animate-pulse" />;
      case 'complete':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'error':
        return <AlertTriangle className="h-6 w-6 text-red-500" />;
      default:
        return <FileCheck className="h-6 w-6 text-muted-foreground" />;
    }
  };

  // Get status message
  const getStatusMessage = () => {
    switch (importProgress.status) {
      case 'preparing':
        return "Ready to import your expense data";
      case 'importing':
        return `Importing ${importProgress.currentItem}...`;
      case 'complete':
        return importResult?.success ? "Import completed successfully!" : "Import completed with issues";
      case 'error':
        return "Import failed";
      default:
        return "Preparing import...";
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Import Status Card */}
      <Card className="bg-card-bg border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            {getStatusIcon()}
            Batch Import
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {getStatusMessage()}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Import summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{validData.length}</div>
              <div className="text-sm text-muted-foreground">Total Records</div>
            </div>
            {importResult && (
              <>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-500">{importResult.imported}</div>
                  <div className="text-sm text-muted-foreground">Imported</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-500">{importResult.failed}</div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
              </>
            )}
          </div>

          {/* Progress bar */}
          {importProgress.status === 'importing' && (
            <div className="space-y-2">
              <Progress value={importProgress.percentage} className="h-3" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Progress: {importProgress.current} / {importProgress.total}</span>
                <span>{importProgress.percentage}%</span>
              </div>
            </div>
          )}

          {/* File info */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Source File:</p>
              <p className="text-sm text-muted-foreground">{fileName}</p>
            </div>
            <Badge variant="outline">{validData.length} rows</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Import Results */}
      {importResult && (
        <Card className="bg-card-bg border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Import Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Success summary */}
            {importResult.success && importResult.imported > 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Success!</strong> {importResult.imported} expense records have been imported 
                  into your project and are now available in the Historical Expenses section.
                </AlertDescription>
              </Alert>
            )}

            {/* Error summary */}
            {importResult.failed > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{importResult.failed} records failed</strong> to import due to errors.
                  {importResult.imported > 0 && (
                    <> {importResult.imported} records were imported successfully.</>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Error details */}
            {importResult.errors.length > 0 && (
              <div>
                <h4 className="font-medium text-white mb-2">Error Details:</h4>
                <div className="bg-red-950/20 border border-red-800 rounded p-3 max-h-40 overflow-y-auto">
                  {importResult.errors.slice(0, 10).map((error, index) => (
                    <div key={index} className="text-sm text-red-400 mb-1">
                      {error}
                    </div>
                  ))}
                  {importResult.errors.length > 10 && (
                    <div className="text-sm text-red-400">
                      ... and {importResult.errors.length - 10} more errors
                    </div>
                  )}
                </div>
              </div>
            )}

            <Separator className="bg-white/10" />

            {/* Sample imported data */}
            {importResult.details.successfulImports.length > 0 && (
              <div>
                <h4 className="font-medium text-white mb-2">Sample Imported Records:</h4>
                <div className="space-y-2">
                  {importResult.details.successfulImports.slice(0, 3).map((item, index) => (
                    <div key={index} className="bg-green-950/20 border border-green-800 rounded p-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-white">{item.description}</span>
                        <Badge className="bg-green-600 text-xs">
                          {new Intl.NumberFormat('en-UG', {
                            style: 'currency',
                            currency: 'UGX',
                            minimumFractionDigits: 0
                          }).format(parseFloat(item.amount))}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {importResult.details.successfulImports.length > 3 && (
                    <div className="text-sm text-muted-foreground text-center">
                      ... and {importResult.details.successfulImports.length - 3} more records
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <Card className="bg-card-bg border-white/10">
        <CardContent className="p-4">
          <div className="flex gap-3">
            {/* Back button */}
            <Button variant="outline" onClick={onBack} disabled={importProgress.status === 'importing'}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Preview
            </Button>

            {/* Start import button */}
            {!importResult && importProgress.status === 'preparing' && (
              <Button 
                onClick={startImport} 
                className="flex-1"
                disabled={validData.length === 0}
              >
                Start Import ({validData.length} records)
                <Upload className="h-4 w-4 ml-2" />
              </Button>
            )}

            {/* Retry button */}
            {importResult && !importResult.success && (
              <Button onClick={retryImport} className="flex-1">
                <RotateCcw className="h-4 w-4 mr-2" />
                Retry Import
              </Button>
            )}

            {/* Complete button */}
            {importResult && importResult.success && (
              <Button onClick={handleComplete} className="flex-1">
                Complete & Return to Dashboard
                <CheckCircle className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}