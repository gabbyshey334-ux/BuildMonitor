import { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileSpreadsheet, X, CheckCircle, AlertTriangle } from "lucide-react";
import { parseFile, validateFile, type ParsedExcelData } from "@/lib/excelParser";

interface ExcelUploadProps {
  onFileProcessed: (data: ParsedExcelData) => void;
  onError: (error: string) => void;
  disabled?: boolean;
  className?: string;
}

interface FileState {
  file: File | null;
  isProcessing: boolean;
  isProcessed: boolean;
  error: string | null;
  progress: number;
}

export default function ExcelUpload({
  onFileProcessed,
  onError,
  disabled = false,
  className = ""
}: ExcelUploadProps) {
  const [fileState, setFileState] = useState<FileState>({
    file: null,
    isProcessing: false,
    isProcessed: false,
    error: null,
    progress: 0
  });
  
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset file state
  const resetFile = useCallback(() => {
    setFileState({
      file: null,
      isProcessing: false,
      isProcessed: false,
      error: null,
      progress: 0
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Process uploaded file
  const processFile = useCallback(async (file: File) => {
    // Reset any previous state
    setFileState(prev => ({
      ...prev,
      file,
      isProcessing: true,
      isProcessed: false,
      error: null,
      progress: 10
    }));

    try {
      // Validate file first
      const validation = validateFile(file);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      setFileState(prev => ({ ...prev, progress: 30 }));

      // Parse file
      const parsedData = await parseFile(file);
      
      setFileState(prev => ({ ...prev, progress: 80 }));

      // Quick validation of parsed data
      if (!parsedData.headers.length) {
        throw new Error('No column headers found in the file');
      }
      
      if (!parsedData.rows.length) {
        throw new Error('No data rows found in the file');
      }

      setFileState(prev => ({
        ...prev,
        progress: 100,
        isProcessing: false,
        isProcessed: true
      }));

      // Notify parent component
      onFileProcessed(parsedData);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process file';
      setFileState(prev => ({
        ...prev,
        isProcessing: false,
        isProcessed: false,
        error: errorMessage,
        progress: 0
      }));
      onError(errorMessage);
    }
  }, [onFileProcessed, onError]);

  // Handle file drop
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 1) {
        onError('Please upload only one file at a time');
        return;
      }

      const file = files[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile, onError, disabled]
  );

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragActive(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  // Handle file input change
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        processFile(files[0]);
      }
    },
    [processFile]
  );

  // Handle click to open file dialog
  const handleClick = useCallback(() => {
    if (!disabled && !fileState.isProcessing) {
      fileInputRef.current?.click();
    }
  }, [disabled, fileState.isProcessing]);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get status icon
  const getStatusIcon = () => {
    if (fileState.isProcessing) {
      return <Upload className="h-8 w-8 text-blue-500 animate-pulse" />;
    }
    if (fileState.isProcessed) {
      return <CheckCircle className="h-8 w-8 text-green-500" />;
    }
    if (fileState.error) {
      return <AlertTriangle className="h-8 w-8 text-red-500" />;
    }
    return <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />;
  };

  // Get status message
  const getStatusMessage = () => {
    if (fileState.isProcessing) {
      return "Processing file...";
    }
    if (fileState.isProcessed) {
      return "File processed successfully!";
    }
    if (fileState.error) {
      return fileState.error;
    }
    return "Drop your Excel or CSV file here, or click to browse";
  };

  // Get status color classes
  const getStatusColors = () => {
    if (fileState.isProcessing) {
      return "border-blue-300 bg-blue-50 dark:bg-blue-950/20";
    }
    if (fileState.isProcessed) {
      return "border-green-300 bg-green-50 dark:bg-green-950/20";
    }
    if (fileState.error) {
      return "border-red-300 bg-red-50 dark:bg-red-950/20";
    }
    if (isDragActive) {
      return "border-brand bg-brand/10 dark:bg-brand/20";
    }
    return "border-white/20 bg-card-bg hover:border-brand/50 hover:bg-card-bg/80";
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <Card 
        className={`relative transition-all duration-200 ${getStatusColors()} ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <CardContent className="flex flex-col items-center justify-center p-8 min-h-[200px]">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileInputChange}
            className="hidden"
            disabled={disabled || fileState.isProcessing}
          />

          {/* Status icon */}
          <div className="mb-4">
            {getStatusIcon()}
          </div>

          {/* Status message */}
          <p className="text-center text-sm text-muted-foreground mb-4">
            {getStatusMessage()}
          </p>

          {/* File information */}
          {fileState.file && (
            <div className="text-center mb-4">
              <p className="font-medium text-sm">{fileState.file.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(fileState.file.size)}
              </p>
            </div>
          )}

          {/* Progress bar */}
          {fileState.isProcessing && (
            <div className="w-full max-w-xs mb-4">
              <Progress value={fileState.progress} className="h-2" />
              <p className="text-xs text-center text-muted-foreground mt-1">
                {fileState.progress}%
              </p>
            </div>
          )}

          {/* Action buttons */}
          {!fileState.isProcessing && (
            <div className="flex gap-2">
              {!fileState.file && !disabled && (
                <Button variant="outline" size="sm">
                  Browse Files
                </Button>
              )}
              
              {fileState.file && !fileState.isProcessed && (
                <Button variant="outline" size="sm" onClick={(e) => {
                  e.stopPropagation();
                  resetFile();
                }}>
                  <X className="h-4 w-4 mr-1" />
                  Remove
                </Button>
              )}
            </div>
          )}

          {/* Supported formats */}
          {!fileState.file && (
            <p className="text-xs text-muted-foreground mt-4 text-center">
              Supported formats: Excel (.xlsx, .xls) and CSV (.csv)
              <br />
              Maximum file size: 10MB
            </p>
          )}
        </CardContent>
      </Card>

      {/* Error alert */}
      {fileState.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {fileState.error}
          </AlertDescription>
        </Alert>
      )}

      {/* Success alert with file details */}
      {fileState.isProcessed && fileState.file && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            File processed successfully! Found data with{' '}
            {/* We'll get this info from the parsed data later */}
            <strong>multiple columns</strong> ready for import.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}