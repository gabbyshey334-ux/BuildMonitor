import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, CheckCircle, AlertTriangle, RotateCcw, Info } from "lucide-react";
import { detectColumnMappings, type ParsedExcelData, type ColumnMapping } from "@/lib/excelParser";

interface ColumnMapperProps {
  parsedData: ParsedExcelData;
  onMappingComplete: (mapping: ColumnMapping) => void;
  className?: string;
}

// Available fields to map to
const AVAILABLE_FIELDS = [
  { value: 'description', label: 'Description', required: true, description: 'What was purchased or the expense item' },
  { value: 'amount', label: 'Amount', required: true, description: 'Cost or price of the item' },
  { value: 'date', label: 'Date', required: true, description: 'When the expense occurred' },
  { value: 'category', label: 'Category', required: false, description: 'Type of expense (Materials, Labor, etc.)' },
  { value: 'quantity', label: 'Quantity', required: false, description: 'Number of units purchased' },
  { value: 'unit', label: 'Unit', required: false, description: 'Unit of measurement (bags, pieces, etc.)' },
  { value: 'paymentMethod', label: 'Payment Method', required: false, description: 'How payment was made (cash, supplier)' },
  { value: 'supplier', label: 'Supplier', required: false, description: 'Vendor or supplier name' },
  { value: 'phase', label: 'Construction Phase', required: false, description: 'Which construction phase this expense belongs to' },
  { value: 'note', label: 'Notes', required: false, description: 'Additional comments or details' }
];

export default function ColumnMapper({
  parsedData,
  onMappingComplete,
  className = ""
}: ColumnMapperProps) {
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [autoDetected, setAutoDetected] = useState<ColumnMapping>({});

  // Initialize with auto-detected mappings
  useEffect(() => {
    const detected = detectColumnMappings(parsedData.headers);
    setAutoDetected(detected);
    setColumnMapping(detected);
  }, [parsedData.headers]);

  // Handle manual mapping change
  const handleMappingChange = (excelColumn: string, fieldName: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [excelColumn]: fieldName
    }));
  };

  // Remove mapping
  const removeMaping = (excelColumn: string) => {
    setColumnMapping(prev => {
      const updated = { ...prev };
      delete updated[excelColumn];
      return updated;
    });
  };

  // Reset to auto-detected mappings
  const resetToAutoDetected = () => {
    setColumnMapping({ ...autoDetected });
  };

  // Check if mapping is valid (has required fields)
  const validateMapping = () => {
    const mappedFields = Object.values(columnMapping);
    const requiredFields = AVAILABLE_FIELDS.filter(f => f.required);
    const missingFields = requiredFields.filter(f => !mappedFields.includes(f.value));
    
    return {
      isValid: missingFields.length === 0,
      missingFields: missingFields.map(f => f.label)
    };
  };

  const validation = validateMapping();

  // Get sample data for preview
  const getSampleData = (excelColumn: string): (string | number)[] => {
    const columnIndex = parsedData.headers.indexOf(excelColumn);
    if (columnIndex === -1) return [];
    
    return parsedData.rows
      .slice(0, 3) // First 3 rows
      .map(row => row[columnIndex])
      .filter(cell => cell !== undefined && cell !== null && String(cell).trim() !== '');
  };

  // Get field info
  const getFieldInfo = (fieldValue: string) => {
    return AVAILABLE_FIELDS.find(f => f.value === fieldValue);
  };

  // Check if field is already mapped
  const isFieldAlreadyMapped = (fieldValue: string, currentColumn: string) => {
    return Object.entries(columnMapping).some(([col, field]) => 
      field === fieldValue && col !== currentColumn
    );
  };

  // Handle proceed with mapping
  const handleProceed = () => {
    if (validation.isValid) {
      onMappingComplete(columnMapping);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <Card className="bg-card-bg border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <ArrowRight className="h-5 w-5" />
            Column Mapping
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Map your Excel columns to the appropriate expense fields. Required fields are marked with a star (★).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Info className="h-4 w-4" />
            <span>
              File: <strong>{parsedData.fileName}</strong> • 
              {parsedData.headers.length} columns • 
              {parsedData.rows.length} rows
            </span>
          </div>

          <Separator className="bg-white/10" />

          {/* Auto-detection info */}
          {Object.keys(autoDetected).length > 0 && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                We automatically detected {Object.keys(autoDetected).length} column mappings based on your headers.
                You can adjust these mappings below if needed.
              </AlertDescription>
            </Alert>
          )}

          {/* Column mapping table */}
          <div className="space-y-3">
            <h4 className="font-medium text-white">Map Your Columns:</h4>
            
            {parsedData.headers.map((header) => {
              const mappedField = columnMapping[header];
              const fieldInfo = mappedField ? getFieldInfo(mappedField) : null;
              const sampleData = getSampleData(header);
              const wasAutoDetected = autoDetected[header] === mappedField;

              return (
                <Card key={header} className="bg-dark-bg border-white/10">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Excel column info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            Excel Column
                          </Badge>
                          <h5 className="font-medium text-white truncate">{header}</h5>
                          {wasAutoDetected && (
                            <Badge className="text-xs bg-green-600">Auto-detected</Badge>
                          )}
                        </div>
                        
                        {/* Sample data preview */}
                        {sampleData.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Sample data:</p>
                            <div className="text-xs text-muted-foreground space-y-1">
                              {sampleData.map((sample, idx) => (
                                <div key={idx} className="truncate">
                                  "{String(sample)}"
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Arrow */}
                      <div className="flex items-center py-2">
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>

                      {/* Field mapping */}
                      <div className="flex-1">
                        <div className="space-y-2">
                          <Select
                            value={mappedField || "unmapped"}
                            onValueChange={(value) => {
                              if (value && value !== "unmapped") {
                                handleMappingChange(header, value);
                              } else {
                                removeMaping(header);
                              }
                            }}
                          >
                            <SelectTrigger className="bg-card-bg border-white/20 text-white">
                              <SelectValue placeholder="Select a field..." />
                            </SelectTrigger>
                            <SelectContent className="bg-card-bg border-white/20">
                              <SelectItem value="unmapped">Don't map this column</SelectItem>
                              {AVAILABLE_FIELDS.map((field) => {
                                const isAlreadyMapped = isFieldAlreadyMapped(field.value, header);
                                return (
                                  <SelectItem 
                                    key={field.value} 
                                    value={field.value}
                                    disabled={isAlreadyMapped}
                                    className="text-white hover:bg-white/10"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span>
                                        {field.label}
                                        {field.required && <span className="text-red-400 ml-1">★</span>}
                                      </span>
                                      {isAlreadyMapped && (
                                        <Badge variant="secondary" className="text-xs">
                                          Already mapped
                                        </Badge>
                                      )}
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>

                          {/* Field description */}
                          {fieldInfo && (
                            <p className="text-xs text-muted-foreground">
                              {fieldInfo.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Reset button */}
          {Object.keys(autoDetected).length > 0 && (
            <div className="pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={resetToAutoDetected}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Reset to Auto-detected
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validation and proceed */}
      <Card className="bg-card-bg border-white/10">
        <CardContent className="p-4">
          {!validation.isValid && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Missing required fields: <strong>{validation.missingFields.join(', ')}</strong>
                <br />
                Please map these columns to proceed with the import.
              </AlertDescription>
            </Alert>
          )}

          {validation.isValid && (
            <Alert className="mb-4">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Great! All required fields are mapped. You can proceed to preview and import your data.
              </AlertDescription>
            </Alert>
          )}

          {/* Summary of mappings */}
          <div className="mb-4">
            <h4 className="font-medium text-white mb-2">Mapping Summary:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {Object.entries(columnMapping).map(([excelCol, field]) => {
                const fieldInfo = getFieldInfo(field);
                return (
                  <div key={excelCol} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground truncate mr-2">{excelCol}</span>
                    <Badge variant={fieldInfo?.required ? "default" : "secondary"} className="text-xs">
                      {fieldInfo?.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>

          <Button
            onClick={handleProceed}
            disabled={!validation.isValid}
            className="w-full"
          >
            {validation.isValid ? 'Proceed to Preview Data' : 'Map Required Fields First'}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}