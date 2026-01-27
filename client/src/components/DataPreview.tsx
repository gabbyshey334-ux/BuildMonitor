import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, AlertTriangle, Eye, FileText, TrendingUp, X, ArrowRight } from "lucide-react";
import { 
  convertToExpenseData, 
  validateExpenseData, 
  type ParsedExcelData, 
  type ColumnMapping 
} from "@/lib/excelParser";

interface DataPreviewProps {
  parsedData: ParsedExcelData;
  columnMapping: ColumnMapping;
  onImportReady: (validData: any[]) => void;
  className?: string;
}

interface PreviewStats {
  totalRows: number;
  validRows: number;
  errorRows: number;
  missingDescription: number;
  missingAmount: number;
  missingDate: number;
  invalidDates: number;
  invalidAmounts: number;
}

export default function DataPreview({
  parsedData,
  columnMapping,
  onImportReady,
  className = ""
}: DataPreviewProps) {
  const [showErrors, setShowErrors] = useState(true);
  const [showValidOnly, setShowValidOnly] = useState(false);

  // Convert and validate data
  const { convertedData, validatedData, stats } = useMemo(() => {
    // Convert Excel data to expense objects
    const converted = convertToExpenseData(parsedData, columnMapping);
    
    // Validate the converted data
    const { validExpenses, errors } = validateExpenseData(converted);
    
    // Calculate statistics
    const totalRows = converted.length;
    const validRows = validExpenses.length;
    const errorRows = totalRows - validRows;
    
    const stats: PreviewStats = {
      totalRows,
      validRows,
      errorRows,
      missingDescription: errors.filter(e => e.includes('Description')).length,
      missingAmount: errors.filter(e => e.includes('amount')).length,
      missingDate: errors.filter(e => e.includes('Date')).length,
      invalidDates: errors.filter(e => e.includes('Invalid date')).length,
      invalidAmounts: errors.filter(e => e.includes('Valid amount')).length
    };

    return {
      convertedData: converted,
      validatedData: { validExpenses, errors },
      stats
    };
  }, [parsedData, columnMapping]);

  // Get display data based on filters
  const displayData = useMemo(() => {
    if (showValidOnly) {
      return validatedData.validExpenses;
    }
    return convertedData;
  }, [convertedData, validatedData.validExpenses, showValidOnly]);

  // Check if a row has errors
  const hasRowError = (rowNumber: number): boolean => {
    return validatedData.errors.some(error => error.includes(`Row ${rowNumber}:`));
  };

  // Get errors for a specific row
  const getRowErrors = (rowNumber: number): string[] => {
    return validatedData.errors
      .filter(error => error.includes(`Row ${rowNumber}:`))
      .map(error => error.replace(`Row ${rowNumber}: `, ''));
  };

  // Format display value
  const formatDisplayValue = (value: any, fieldType?: string): string => {
    if (value === undefined || value === null || value === '') {
      return '';
    }

    const strValue = String(value);
    
    switch (fieldType) {
      case 'amount':
        const numValue = parseFloat(strValue.replace(/[^\d.-]/g, ''));
        if (!isNaN(numValue)) {
          return new Intl.NumberFormat('en-UG', {
            style: 'currency',
            currency: 'UGX',
            minimumFractionDigits: 0
          }).format(numValue);
        }
        return strValue;
      case 'date':
        const date = new Date(strValue);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('en-UG');
        }
        return strValue;
      default:
        return strValue.length > 50 ? strValue.substring(0, 50) + '...' : strValue;
    }
  };

  // Get fields that are mapped
  const mappedFields = Object.values(columnMapping).filter(Boolean);

  // Handle import proceed
  const handleProceedImport = () => {
    onImportReady(validatedData.validExpenses);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Statistics Card */}
      <Card className="bg-card-bg border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <TrendingUp className="h-5 w-5" />
            Data Preview & Validation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{stats.totalRows}</div>
              <div className="text-sm text-muted-foreground">Total Rows</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">{stats.validRows}</div>
              <div className="text-sm text-muted-foreground">Valid Rows</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">{stats.errorRows}</div>
              <div className="text-sm text-muted-foreground">Errors</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500">{mappedFields.length}</div>
              <div className="text-sm text-muted-foreground">Mapped Fields</div>
            </div>
          </div>

          <Separator className="bg-white/10 my-4" />

          {/* Error breakdown */}
          {stats.errorRows > 0 && (
            <div>
              <h4 className="font-medium text-white mb-2">Error Breakdown:</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                {stats.missingDescription > 0 && (
                  <div className="text-red-400">Missing Description: {stats.missingDescription}</div>
                )}
                {stats.missingAmount > 0 && (
                  <div className="text-red-400">Missing Amount: {stats.missingAmount}</div>
                )}
                {stats.missingDate > 0 && (
                  <div className="text-red-400">Missing Date: {stats.missingDate}</div>
                )}
                {stats.invalidDates > 0 && (
                  <div className="text-red-400">Invalid Dates: {stats.invalidDates}</div>
                )}
                {stats.invalidAmounts > 0 && (
                  <div className="text-red-400">Invalid Amounts: {stats.invalidAmounts}</div>
                )}
              </div>
            </div>
          )}

          {/* Filter controls */}
          <div className="flex gap-2 mt-4">
            <Button
              variant={showValidOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowValidOnly(!showValidOnly)}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              {showValidOnly ? "Showing Valid Only" : "Show Valid Only"}
            </Button>
            
            {stats.errorRows > 0 && (
              <Button
                variant={showErrors ? "destructive" : "outline"}
                size="sm"
                onClick={() => setShowErrors(!showErrors)}
              >
                <AlertTriangle className="h-4 w-4 mr-1" />
                {showErrors ? "Hide Errors" : "Show Errors"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Validation Status */}
      {stats.errorRows === 0 ? (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Perfect!</strong> All {stats.validRows} rows are valid and ready for import. 
            Your data looks great with no errors found.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{stats.errorRows} rows have errors</strong> and will be skipped during import. 
            {stats.validRows > 0 && (
              <> {stats.validRows} rows are valid and will be imported successfully.</>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Data Table */}
      <Card className="bg-card-bg border-white/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-white">
              <Eye className="h-5 w-5" />
              Data Preview ({displayData.length} rows)
            </CardTitle>
            <Badge variant="outline">
              {parsedData.fileName}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] w-full">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-white/5">
                  <TableHead className="text-white w-16">Row</TableHead>
                  {mappedFields.includes('description') && (
                    <TableHead className="text-white">Description</TableHead>
                  )}
                  {mappedFields.includes('amount') && (
                    <TableHead className="text-white">Amount</TableHead>
                  )}
                  {mappedFields.includes('date') && (
                    <TableHead className="text-white">Date</TableHead>
                  )}
                  {mappedFields.includes('category') && (
                    <TableHead className="text-white">Category</TableHead>
                  )}
                  {mappedFields.includes('quantity') && (
                    <TableHead className="text-white">Qty</TableHead>
                  )}
                  {mappedFields.includes('paymentMethod') && (
                    <TableHead className="text-white">Payment</TableHead>
                  )}
                  {mappedFields.includes('supplier') && (
                    <TableHead className="text-white">Supplier</TableHead>
                  )}
                  {mappedFields.includes('phase') && (
                    <TableHead className="text-white">Phase</TableHead>
                  )}
                  <TableHead className="text-white w-16">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayData.map((row, index) => {
                  const rowNumber = row.rowNumber || index + 1;
                  const hasError = hasRowError(rowNumber);
                  const rowErrors = getRowErrors(rowNumber);
                  
                  return (
                    <TableRow 
                      key={index}
                      className={`border-white/10 hover:bg-white/5 ${
                        hasError ? 'bg-red-950/20' : ''
                      }`}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {rowNumber}
                      </TableCell>
                      
                      {mappedFields.includes('description') && (
                        <TableCell className={`${!row.description ? 'text-red-400' : 'text-white'}`}>
                          {formatDisplayValue(row.description)}
                          {!row.description && <span className="text-xs"> (missing)</span>}
                        </TableCell>
                      )}
                      
                      {mappedFields.includes('amount') && (
                        <TableCell className={`${!row.amount || isNaN(parseFloat(String(row.amount))) ? 'text-red-400' : 'text-white'}`}>
                          {formatDisplayValue(row.amount, 'amount')}
                          {(!row.amount || isNaN(parseFloat(String(row.amount)))) && 
                            <span className="text-xs"> (invalid)</span>
                          }
                        </TableCell>
                      )}
                      
                      {mappedFields.includes('date') && (
                        <TableCell className={`${!row.date || isNaN(new Date(String(row.date)).getTime()) ? 'text-red-400' : 'text-white'}`}>
                          {formatDisplayValue(row.date, 'date')}
                          {(!row.date || isNaN(new Date(String(row.date)).getTime())) && 
                            <span className="text-xs"> (invalid)</span>
                          }
                        </TableCell>
                      )}
                      
                      {mappedFields.includes('category') && (
                        <TableCell className="text-white">
                          {formatDisplayValue(row.category)}
                        </TableCell>
                      )}
                      
                      {mappedFields.includes('quantity') && (
                        <TableCell className="text-white">
                          {formatDisplayValue(row.quantity)}
                          {row.unit && <span className="text-muted-foreground"> {row.unit}</span>}
                        </TableCell>
                      )}
                      
                      {mappedFields.includes('paymentMethod') && (
                        <TableCell className="text-white">
                          {formatDisplayValue(row.paymentMethod)}
                        </TableCell>
                      )}
                      
                      {mappedFields.includes('supplier') && (
                        <TableCell className="text-white">
                          {formatDisplayValue(row.supplier)}
                        </TableCell>
                      )}
                      
                      {mappedFields.includes('phase') && (
                        <TableCell className="text-white">
                          {formatDisplayValue(row.phase)}
                        </TableCell>
                      )}
                      
                      <TableCell>
                        {hasError ? (
                          <div className="group relative">
                            <Badge variant="destructive" className="cursor-help">
                              <X className="h-3 w-3" />
                            </Badge>
                            {showErrors && rowErrors.length > 0 && (
                              <div className="absolute z-10 left-0 top-8 bg-red-900 border border-red-700 rounded p-2 text-xs text-white whitespace-nowrap shadow-lg">
                                {rowErrors.map((error, idx) => (
                                  <div key={idx}>{error}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <Badge className="bg-green-600">
                            <CheckCircle className="h-3 w-3" />
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>

          {displayData.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No data to display with current filters.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Proceed to Import */}
      <Card className="bg-card-bg border-white/10">
        <CardContent className="p-4">
          {stats.validRows > 0 ? (
            <div>
              <Alert className="mb-4">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Ready to import <strong>{stats.validRows} valid expense records</strong> into your project.
                  {stats.errorRows > 0 && (
                    <> {stats.errorRows} rows with errors will be skipped.</>
                  )}
                </AlertDescription>
              </Alert>
              
              <Button onClick={handleProceedImport} className="w-full">
                Import {stats.validRows} Valid Records
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Cannot proceed with import.</strong> All rows have validation errors. 
                Please fix your Excel data or adjust the column mappings and try again.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}