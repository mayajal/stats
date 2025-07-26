'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { DataRow, ColumnDefinition, SheetData } from '@/types';
import { FileDropzone } from './file-dropzone';
import { DataPreviewTable } from './data-preview-table';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parseCSV } from '@/lib/csv-parser';
import { getSheetNamesFromXLSX, parseXLSXSheet } from '@/lib/excel-parser';
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, AlertTriangle } from 'lucide-react';

interface DataUploadStepProps {
  onDataProcessed: (data: DataRow[], columns: ColumnDefinition[], fileName: string) => void;
}

export function DataUploadStep({ onDataProcessed }: DataUploadStepProps) {
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<DataRow[]>([]);
  const [previewColumns, setPreviewColumns] = useState<ColumnDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const resetState = () => {
    setFile(null);
    setSheets([]);
    setSelectedSheet(null);
    setPreviewData([]);
    setPreviewColumns([]);
  };

  const handleFileAccepted = async (acceptedFile: File) => {
    resetState();
    setIsLoading(true);
    setFile(acceptedFile);

    if (acceptedFile.name.toLowerCase().endsWith('.xlsx')) {
      try {
        const sheetNames = await getSheetNamesFromXLSX(acceptedFile);
        if (sheetNames.length > 0) {
          setSheets(sheetNames);
          setSelectedSheet(sheetNames[0]); // Auto-select first sheet
        } else {
          toast({ title: "XLSX Error", description: "Could not read sheets from XLSX file. It might be empty or corrupted.", variant: "destructive" });
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error processing XLSX file:", error);
        toast({ title: "XLSX Error", description: "Failed to process XLSX file. Please ensure it's a valid .xlsx file.", variant: "destructive" });
        setIsLoading(false);
      }
    } else if (acceptedFile.name.toLowerCase().endsWith('.csv')) {
      try {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          const { data, columns } = parseCSV(text);
          if (data.length > 0 && columns.length > 0) {
            setPreviewData(data);
            setPreviewColumns(columns);
            onDataProcessed(data, columns, acceptedFile.name);
          } else {
            toast({ title: "CSV Error", description: "CSV file appears to be empty or improperly formatted.", variant: "destructive" });
          }
          setIsLoading(false);
        };
        reader.onerror = () => {
            toast({ title: "File Read Error", description: "Could not read the CSV file.", variant: "destructive" });
            setIsLoading(false);
        }
        reader.readAsText(acceptedFile);
      } catch (error) {
        console.error("Error processing CSV file:", error);
        toast({ title: "CSV Error", description: "Failed to process CSV file.", variant: "destructive" });
        setIsLoading(false);
      }
    } else {
        toast({ title: "Unsupported File", description: "Please upload a .csv or .xlsx file.", variant: "destructive" });
        setIsLoading(false);
    }
  };
  
  useEffect(() => {
    const loadSheetData = async () => {
      if (file && file.name.toLowerCase().endsWith('.xlsx') && selectedSheet) {
        setIsLoading(true);
        try {
          const { data, columns } = await parseXLSXSheet(file, selectedSheet);
           if (data.length > 0 && columns.length > 0) {
            setPreviewData(data);
            setPreviewColumns(columns);
            onDataProcessed(data, columns, file.name);
          } else {
            toast({ title: "XLSX Sheet Error", description: `Sheet '${selectedSheet}' appears to be empty or improperly formatted.`, variant: "destructive" });
            setPreviewData([]); // Clear previous preview if sheet is empty
            setPreviewColumns([]);
          }
        } catch (error) {
          console.error(`Error parsing sheet ${selectedSheet}:`, error);
          toast({ title: "XLSX Parse Error", description: `Failed to parse sheet '${selectedSheet}'.`, variant: "destructive" });
        } finally {
          setIsLoading(false);
        }
      }
    };
    loadSheetData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, selectedSheet]); // Removed onDataProcessed from deps to avoid re-triggering data processing when parent state changes

  const handleUnmeltData = () => {
    toast({
      title: "Feature Coming Soon",
      description: "Data unmelt/pivot functionality is a planned enhancement. For now, please ensure your data is in a 'tidy' long format if needed.",
    });
  };

  return (
    <div className="space-y-6">
      <FileDropzone onFileAccepted={handleFileAccepted} />

      {isLoading && <p className="text-center text-primary">Loading file data...</p>}

      {file && sheets.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="sheet-select" className="font-headline">Select Sheet (for .xlsx)</Label>
          <Select value={selectedSheet || ''} onValueChange={setSelectedSheet}>
            <SelectTrigger id="sheet-select" className="w-full md:w-[300px]">
              <SelectValue placeholder="Select a sheet" />
            </SelectTrigger>
            <SelectContent>
              {sheets.map((sheet) => (
                <SelectItem key={sheet} value={sheet}>
                  {sheet}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {previewData.length > 0 && previewColumns.length > 0 && (
        <div>
          <h3 className="font-headline text-lg mb-2">Data Preview</h3>
          <DataPreviewTable data={previewData} columns={previewColumns} fileName={file?.name} />
        </div>
      )}
      
      {previewData.length > 0 && (
        <div className="pt-4 border-t">
            <h3 className="font-headline text-lg mb-2">Data Formatting</h3>
            <p className="text-sm text-muted-foreground mb-3">
                If your data is in a 'wide' format (e.g., multiple columns representing different time points or repeated measures for the same subject), 
                you might need to 'unmelt' or 'pivot' it into a 'long' (tidy) format for some analyses. 
                Learn more about <a href="https://vita.cs.ucl.ac.uk/tutorial0.html" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">tidy data <ExternalLink className="inline h-3 w-3"/></a>.
            </p>
            <Button variant="outline" onClick={handleUnmeltData}>
                Unmelt/Pivot Columns (Coming Soon)
            </Button>
        </div>
      )}
    </div>
  );
}
