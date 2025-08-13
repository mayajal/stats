'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Upload, Replace, Download, BarChart, CheckCircle } from "lucide-react";
import * as XLSX from 'xlsx';

interface SkewnessData {
    untransformed: number | null;
    log: number | null;
    sqrt: number | null;
    boxcox: number | null;
}

interface AnalysisResult {
    skewness: SkewnessData;
    suggestion: string;
}

export default function TranxPage() {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [columnHeaders, setColumnHeaders] = useState<string[]>([]);
  const [missingValuesCount, setMissingValuesCount] = useState<number>(0);

  // State for column selection
  const [blockCol, setBlockCol] = useState<string>('');
  const [factorCol, setFactorCol] = useState<string>('');
  const [responseCol, setResponseCol] = useState<string>('');

  // State for analysis
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string>('');

  // State for transformation
  const [transformChoice, setTransformChoice] = useState<string>('untransformed');
  const [transformedData, setTransformedData] = useState<any[]>([]);
  const [transformError, setTransformError] = useState<string>('');
  const [transformLoading, setTransformLoading] = useState(false);
  const [originalResponseCol, setOriginalResponseCol] = useState<string>('');
  const [transformedResponseCol, setTransformedResponseCol] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
    }
  };

  const handleReset = () => {
    setFile(null);
    setData([]);
    setError('');
    setColumnHeaders([]);
    setMissingValuesCount(0);
    setBlockCol('');
    setFactorCol('');
    setResponseCol('');
    setAnalysisResult(null);
    setAnalysisLoading(false);
    setAnalysisError('');
    setTransformChoice('untransformed');
    setTransformedData([]);
    setTransformError('');
    setTransformLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null });

      if (jsonData.length === 0) {
        setError('No data found in the file');
        return;
      }
      
      let missingCount = 0;
      jsonData.forEach(row => {
        Object.values(row).forEach(value => {
          if (value === null || value === undefined || value === '') {
            missingCount++;
          }
        });
      });
      setMissingValuesCount(missingCount);

      setData(jsonData);
      setColumnHeaders(Object.keys(jsonData[0] || {}));
    } catch (err) {
      setError('Error processing file. Please ensure it\'s a valid Excel file.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!data.length || !responseCol) {
      setAnalysisError('Please process a file and select a response column.');
      return;
    }

    setAnalysisLoading(true);
    setAnalysisError('');
    setAnalysisResult(null);

    const formData = new FormData();
    formData.append('data', JSON.stringify(data));
    formData.append('response_col', responseCol);

    const analyzeServiceUrl = 'http://localhost:8080/analyze_transformations';

    try {
      const response = await fetch(analyzeServiceUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      const results = await response.json();
      setAnalysisResult(results);
      setTransformChoice(results.suggestion || 'untransformed');

    } catch (err: any) {
      setAnalysisError(err.message || 'An unexpected error occurred during analysis');
    } finally {
      setAnalysisLoading(false);
    }
  };

  useEffect(() => {
    if (responseCol && data.length > 0) {
      handleAnalyze();
    }
  }, [responseCol, data]);

  const handleTransform = async () => {
    if (!data.length || !responseCol || !transformChoice) {
      setTransformError('Please process a file, select a response column, and a transformation type.');
      return;
    }

    setTransformLoading(true);
    setTransformError('');
    setTransformedData([]);

    const formData = new FormData();
    formData.append('data', JSON.stringify(data));
    formData.append('response_col', responseCol);
    formData.append('transform_choice', transformChoice);

    const tranxServiceUrl = 'http://localhost:8080/transform';

    try {
      const response = await fetch(tranxServiceUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Transformation failed');
      }

      const results = await response.json();
      setTransformedData(JSON.parse(results.transformed_data));
      setOriginalResponseCol(results.original_response_col);
      setTransformedResponseCol(results.transformed_response_col);

    } catch (err: any) {
      setTransformError(err.message || 'An unexpected error occurred');
    } finally {
      setTransformLoading(false);
    }
  };

  const previewData = transformedData.length > 0 && blockCol && factorCol && originalResponseCol && transformedResponseCol ? 
    data.map((row, index) => ({
      [factorCol]: row[factorCol],
      [blockCol]: row[blockCol],
      [originalResponseCol]: row[originalResponseCol],
      [transformedResponseCol]: transformedData[index] ? transformedData[index][transformedResponseCol] : null,
    })) : [];

  const handleExport = () => {
    if (previewData.length === 0) {
      return;
    }

    const headers = [factorCol, blockCol, originalResponseCol, transformedResponseCol];
    const csvContent = [
      headers.join(','),
      ...previewData.map(row => headers.map(header => row[header]).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'transformed_data.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Replace className="h-8 w-8 text-pink-600 mr-3" />
            <h1 className="text-3xl font-bold">Data Transformation</h1>
          </div>
          <p className="text-muted-foreground">
            Upload your data, analyze distributions, and apply transformations.
          </p>
        </div>

       <Card className="mb-8 border border-pink-200 rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Upload className="h-5 w-5 mr-2" />
              1. Upload Data File
            </CardTitle>
            <CardDescription>
              Select an Excel (.xlsx) file. Check the required format 
              <Link href="/data_arrangement" passHref>
                <Button variant="link" className="p-1 h-auto ml-1 text-pink-600 hover:underline">here</Button>
              </Link>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <Input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="flex-1 bg-pink-50" ref={fileInputRef} />
              <Button onClick={processFile} disabled={!file || loading} className="min-w-[120px]">
                {loading ? 'Processing...' : 'Process File'}
              </Button>
              <Button onClick={handleReset} variant="outline" className="min-w-[120px]">Reset</Button>
            </div>
            {file && <div className="text-sm text-muted-foreground">Selected file: {file.name}</div>}
            {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded">{error}</div>}
          </CardContent>
        </Card>

        {data.length > 0 && (
          <Card className="mb-8 border border-pink-200 rounded-lg">
            <CardHeader>
              <CardTitle>2. Select Columns</CardTitle>
              <CardDescription>Specify columns for analysis.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block mb-1 font-medium">Block Column</label>
                <select value={blockCol} onChange={e => setBlockCol(e.target.value)} className="block w-full p-2 border border-pink-300 rounded-md shadow-sm">
                  <option value="">Select a column</option>
                  {columnHeaders.map(header => <option key={header} value={header}>{header}</option>)}
                </select>
              </div>
              <div>
                <label className="block mb-1 font-medium">Factor Column</label>
                <select value={factorCol} onChange={e => setFactorCol(e.target.value)} className="block w-full p-2 border border-pink-300 rounded-md shadow-sm">
                  <option value="">Select a column</option>
                  {columnHeaders.map(header => <option key={header} value={header}>{header}</option>)}
                </select>
              </div>
              <div>
                <label className="block mb-1 font-medium">Response Column</label>
                <select value={responseCol} onChange={e => setResponseCol(e.target.value)} className="block w-full p-2 border border-pink-300 rounded-md shadow-sm">
                  <option value="">Select a column</option>
                  {columnHeaders.map(header => <option key={header} value={header}>{header}</option>)}
                </select>
              </div>
            </CardContent>
          </Card>
        )}

        {analysisLoading && <div className="text-center">Analyzing transformations...</div>}
        {analysisError && <div className="text-red-600 text-sm bg-red-50 p-3 rounded mb-8">{analysisError}</div>}

        {analysisResult && (
          <Card className="mb-8 border border-pink-200 rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center"><BarChart className="h-5 w-5 mr-2" /> 3. Transformation Analysis</CardTitle>
              <CardDescription>Skewness for different transformations.</CardDescription>
            </CardHeader>
            <CardContent>
                <table className="min-w-full divide-y divide-pink-200">
                    <thead className="bg-pink-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-black-500 uppercase tracking-wider">Transformation</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-black-500 uppercase tracking-wider">Skewness</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-pink-200">
                        {Object.entries(analysisResult.skewness).map(([key, value]) => (
                            <tr key={key}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-black-900 capitalize">{key}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-black-500">{value?.toFixed(5) ?? 'N/A'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
              <div className="mt-6 text-center bg-pink-50 p-4 rounded-lg">
                <h3 className="font-semibold flex items-center justify-center"><CheckCircle className="h-5 w-5 mr-2 text-green-600"/> Suggested Transformation</h3>
                <p className="text-lg capitalize">{analysisResult.suggestion}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {analysisResult && (
          <Card className="mb-8 border border-pink-200 rounded-lg">
            <CardHeader>
              <CardTitle>4. Apply Transformation</CardTitle>
              <CardDescription>Choose a transformation and apply it to your data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block mb-1 font-medium">Transformation Type</label>
                <select value={transformChoice} onChange={e => setTransformChoice(e.target.value)} className="block w-full p-2 border border-pink-300 rounded-md shadow-sm">
                  <option value="untransformed">No Transformation</option>
                  <option value="log">Log Transformation</option>
                  <option value="sqrt">Square Root Transformation</option>
                  <option value="boxcox">Box-Cox Transformation</option>
                </select>
              </div>
              <Button onClick={handleTransform} disabled={transformLoading || !responseCol}>
                {transformLoading ? 'Transforming...' : 'Run Transformation'}
              </Button>
              {transformError && <div className="text-red-600 text-sm bg-red-50 p-3 rounded mt-4">{transformError}</div>}
            </CardContent>
          </Card>
        )}

        {previewData.length > 0 && (
            <Card className="border border-pink-200 rounded-lg">
              <CardHeader>
                <CardTitle>5. Transformed Data Preview</CardTitle>
                <CardDescription>Showing factor, block, original, and transformed values.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-pink-200">
                    <thead className="bg-pink-50">
                      <tr>
                        {Object.keys(previewData[0] || {}).map(key => <th key={key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{key}</th>)}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-pink-200">
                      {previewData.slice(0, 5).map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {Object.values(row).map((value: any, colIndex) => (
                            <td key={colIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {typeof value === 'number' ? value.toFixed(4) : value?.toString()}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 text-sm text-muted-foreground">Total rows: {previewData.length}</div>
                <div className="mt-4">
                  <Button onClick={handleExport} disabled={previewData.length === 0}>
                    <Download className="h-4 w-4 mr-2" />
                    Export as CSV
                  </Button>
                </div>
              </CardContent>
            </Card>
        )}

      </div>
    </div>
  );
}