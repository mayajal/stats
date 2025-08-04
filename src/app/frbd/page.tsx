'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Upload, BarChart3 } from "lucide-react";
import * as XLSX from 'xlsx';

export default function FrbdPage() {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // State for FRBD analysis
  const [blockCol, setBlockCol] = useState<string>('');
  const [factorCols, setFactorCols] = useState<string>('');
  const [responseCol, setResponseCol] = useState<string>('');
  const [frbdResults, setFrbdResults] = useState<any>(null);
  const [frbdError, setFrbdError] = useState<string>('');
  const [frbdLoading, setFrbdLoading] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setError('');
      setData([]);
      setFrbdResults(null);
    }
  };

  const processFile = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        setError('No data found in the file');
        return;
      }

      setData(jsonData);
    } catch (err) {
      setError('Error processing file. Please ensure it\'s a valid Excel file.');
    } finally {
      setLoading(false);
    }
  };

  const handleFrbdAnalysis = async () => {
    if (!file || !blockCol || !factorCols || !responseCol) {
      setFrbdError('Please select a file and specify all column names.');
      return;
    }

    setFrbdLoading(true);
    setFrbdError('');
    setFrbdResults(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('block_col', blockCol);
    formData.append('factor_cols', factorCols);
    formData.append('response_col', responseCol);

    const frbdServiceUrl = process.env.NEXT_PUBLIC_FRBD_SERVICE_URL;

    if (!frbdServiceUrl) {
      setFrbdError('FRBD service URL not configured');
      setFrbdLoading(false);
      return;
    }

    try {
      const response = await fetch(frbdServiceUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      const results = await response.json();
      setFrbdResults(results);

    } catch (err: any) {
      setFrbdError(err.message);
    } finally {
      setFrbdLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <BarChart3 className="h-8 w-8 text-green-600 mr-3" />
            <h1 className="text-3xl font-bold">FRBD Analysis</h1>
          </div>
          <p className="text-muted-foreground">
            Upload your Excel file and perform Factorial Randomized Block Design (FRBD) analysis.
          </p>
        </div>

        {/* Home Button */}
        <div className="mb-6">
          <Link href="/" passHref>
            <Button variant="outline">Home</Button>
          </Link>
        </div>

        {/* File Upload Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Upload className="h-5 w-5 mr-2" />
              Upload Data File
            </CardTitle>
            <CardDescription>
              Select an Excel (.xlsx) file containing your data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="flex-1"
              />
              <Button 
                onClick={processFile} 
                disabled={!file || loading}
                className="min-w-[120px]"
              >
                {loading ? 'Processing...' : 'Process File'}
              </Button>
            </div>
            
            {file && (
              <div className="text-sm text-muted-foreground">
                Selected file: {file.name}
              </div>
            )}

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Preview */}
        {data.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Data Preview</CardTitle>
              <CardDescription>
                First 5 rows of your uploaded data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      {Object.keys(data[0] || {}).map((header, index) => (
                        <th key={index} className="border border-gray-300 px-4 py-2 text-left">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.slice(0, 5).map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {Object.values(row).map((value, colIndex) => (
                          <td key={colIndex} className="border border-gray-300 px-4 py-2">
                            {String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 text-sm text-muted-foreground">
                Total rows: {data.length}
              </div>
            </CardContent>
          </Card>
        )}

        {/* FRBD Column Selection */}
        {data.length > 0 && (
          <Card className="mb-6 mt-8">
            <CardHeader>
              <CardTitle>FRBD Analysis Setup</CardTitle>
              <CardDescription>Specify the columns for the analysis.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block mb-1 font-medium">Block Column</label>
                <Input 
                  value={blockCol}
                  onChange={e => setBlockCol(e.target.value)}
                  placeholder="Enter block column name"
                />
              </div>
              <div>
                <label className="block mb-1 font-medium">Factor Columns (comma-separated)</label>
                <Input 
                  value={factorCols}
                  onChange={e => setFactorCols(e.target.value)}
                  placeholder="Enter factor column names"
                />
              </div>
              <div>
                <label className="block mb-1 font-medium">Response Column</label>
                <Input 
                  value={responseCol}
                  onChange={e => setResponseCol(e.target.value)}
                  placeholder="Enter response column name"
                />
              </div>
              <Button onClick={handleFrbdAnalysis} disabled={frbdLoading}>
                {frbdLoading ? 'Running Analysis...' : 'Run FRBD Analysis'}
              </Button>
              {frbdError && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                  {frbdError}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* FRBD Results */}
        {frbdResults && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>FRBD Analysis Results</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-4 rounded-md overflow-x-auto">
                {JSON.stringify(frbdResults, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}