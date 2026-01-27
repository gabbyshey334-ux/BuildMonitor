import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FileSpreadsheet, ArrowLeft, ArrowRight } from "lucide-react";
import ExcelUpload from "./ExcelUpload";
import ColumnMapper from "./ColumnMapper";
import DataPreview from "./DataPreview";
import BatchImport from "./BatchImport";
import type { ParsedExcelData, ColumnMapping } from "@/lib/excelParser";

interface ExcelImportWizardProps {
  projectId: string;
  onComplete: () => void;
  onCancel: () => void;
  className?: string;
}

type WizardStep = 'upload' | 'mapping' | 'preview' | 'import' | 'complete';

interface WizardState {
  currentStep: WizardStep;
  parsedData: ParsedExcelData | null;
  columnMapping: ColumnMapping | null;
  validatedData: any[] | null;
  error: string | null;
}

const STEPS = [
  { key: 'upload' as WizardStep, label: 'Upload File', description: 'Choose your Excel or CSV file' },
  { key: 'mapping' as WizardStep, label: 'Map Columns', description: 'Match your columns to expense fields' },
  { key: 'preview' as WizardStep, label: 'Preview Data', description: 'Review and validate your data' },
  { key: 'import' as WizardStep, label: 'Import', description: 'Import your expense records' },
];

export default function ExcelImportWizard({
  projectId,
  onComplete,
  onCancel,
  className = ""
}: ExcelImportWizardProps) {
  const [wizardState, setWizardState] = useState<WizardState>({
    currentStep: 'upload',
    parsedData: null,
    columnMapping: null,
    validatedData: null,
    error: null
  });

  // Get current step index for progress
  const getCurrentStepIndex = (): number => {
    return STEPS.findIndex(step => step.key === wizardState.currentStep);
  };

  // Calculate progress percentage
  const getProgressPercentage = (): number => {
    const stepIndex = getCurrentStepIndex();
    return Math.round(((stepIndex + 1) / STEPS.length) * 100);
  };

  // Handle file upload success
  const handleFileProcessed = (data: ParsedExcelData) => {
    setWizardState(prev => ({
      ...prev,
      parsedData: data,
      error: null,
      currentStep: 'mapping'
    }));
  };

  // Handle file upload error
  const handleFileError = (error: string) => {
    setWizardState(prev => ({
      ...prev,
      error,
      parsedData: null,
      columnMapping: null,
      validatedData: null
    }));
  };

  // Handle column mapping completion
  const handleMappingComplete = (mapping: ColumnMapping) => {
    setWizardState(prev => ({
      ...prev,
      columnMapping: mapping,
      currentStep: 'preview',
      error: null
    }));
  };

  // Handle data preview completion (ready for import)
  const handleImportReady = (validData: any[]) => {
    setWizardState(prev => ({
      ...prev,
      validatedData: validData,
      currentStep: 'import',
      error: null
    }));
  };

  // Handle import completion
  const handleImportComplete = () => {
    setWizardState(prev => ({
      ...prev,
      currentStep: 'complete'
    }));
    
    // Call the completion callback
    onComplete();
  };

  // Go back to previous step
  const goBack = () => {
    switch (wizardState.currentStep) {
      case 'mapping':
        setWizardState(prev => ({ ...prev, currentStep: 'upload' }));
        break;
      case 'preview':
        setWizardState(prev => ({ ...prev, currentStep: 'mapping' }));
        break;
      case 'import':
        setWizardState(prev => ({ ...prev, currentStep: 'preview' }));
        break;
      default:
        break;
    }
  };

  // Reset wizard to start
  const resetWizard = () => {
    setWizardState({
      currentStep: 'upload',
      parsedData: null,
      columnMapping: null,
      validatedData: null,
      error: null
    });
  };

  // Get step status
  const getStepStatus = (stepKey: WizardStep): 'complete' | 'current' | 'pending' => {
    const currentIndex = getCurrentStepIndex();
    const stepIndex = STEPS.findIndex(s => s.key === stepKey);
    
    if (stepIndex < currentIndex) return 'complete';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Wizard Header */}
      <Card className="bg-card-bg border-white/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-6 w-6 text-brand" />
              <div>
                <CardTitle className="text-white">Excel Import Wizard</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Import your historical expense data from Excel or CSV files
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={onCancel} size="sm">
              Cancel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pb-6">
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Progress</span>
              <span className="text-sm text-muted-foreground">{getProgressPercentage()}%</span>
            </div>
            <Progress value={getProgressPercentage()} className="h-2" />
          </div>

          {/* Step Indicators */}
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const status = getStepStatus(step.key);
              return (
                <div key={step.key} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                      ${status === 'complete' ? 'bg-green-600 text-white' :
                        status === 'current' ? 'bg-brand text-white' :
                        'bg-white/10 text-muted-foreground'}
                    `}>
                      {status === 'complete' ? '✓' : index + 1}
                    </div>
                    <div className="text-center mt-2">
                      <div className={`text-xs font-medium ${
                        status === 'current' ? 'text-white' : 'text-muted-foreground'
                      }`}>
                        {step.label}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 max-w-20">
                        {step.description}
                      </div>
                    </div>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className={`w-12 h-0.5 mx-2 mt-[-20px] ${
                      status === 'complete' ? 'bg-green-600' : 'bg-white/20'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Current Step Content */}
      <div className="min-h-[400px]">
        {wizardState.currentStep === 'upload' && (
          <div>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-white mb-2">Step 1: Upload Your File</h2>
              <p className="text-muted-foreground">
                Select your Excel (.xlsx, .xls) or CSV (.csv) file containing your historical expense data.
                The file should include columns for description, amount, date, and other expense details.
              </p>
            </div>
            <ExcelUpload
              onFileProcessed={handleFileProcessed}
              onError={handleFileError}
            />
          </div>
        )}

        {wizardState.currentStep === 'mapping' && wizardState.parsedData && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white mb-2">Step 2: Map Your Columns</h2>
                <p className="text-muted-foreground">
                  Match your Excel columns to our expense fields. Required fields are marked with ★.
                </p>
              </div>
              <Button variant="outline" onClick={goBack} size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Upload
              </Button>
            </div>
            <ColumnMapper
              parsedData={wizardState.parsedData}
              onMappingComplete={handleMappingComplete}
            />
          </div>
        )}

        {wizardState.currentStep === 'preview' && wizardState.parsedData && wizardState.columnMapping && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white mb-2">Step 3: Preview & Validate</h2>
                <p className="text-muted-foreground">
                  Review your mapped data and fix any validation errors before importing.
                </p>
              </div>
              <Button variant="outline" onClick={goBack} size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Mapping
              </Button>
            </div>
            <DataPreview
              parsedData={wizardState.parsedData}
              columnMapping={wizardState.columnMapping}
              onImportReady={handleImportReady}
            />
          </div>
        )}

        {wizardState.currentStep === 'import' && wizardState.parsedData && wizardState.validatedData && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white mb-2">Step 4: Import Your Data</h2>
                <p className="text-muted-foreground">
                  Import your validated expense records into the project.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {wizardState.parsedData.fileName}
                </Badge>
                <Badge>
                  {wizardState.validatedData.length} records
                </Badge>
              </div>
            </div>
            <BatchImport
              projectId={projectId}
              validData={wizardState.validatedData}
              fileName={wizardState.parsedData.fileName}
              onBack={goBack}
              onComplete={handleImportComplete}
            />
          </div>
        )}
      </div>

      {/* Reset option for troubleshooting */}
      {wizardState.currentStep !== 'upload' && wizardState.currentStep !== 'import' && (
        <div className="text-center">
          <Button variant="ghost" onClick={resetWizard} size="sm" className="text-muted-foreground">
            Start Over with Different File
          </Button>
        </div>
      )}
    </div>
  );
}