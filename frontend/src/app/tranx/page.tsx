'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import * as Dialog from "@radix-ui/react-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Upload, Replace, Download, CheckCircle, Info } from "lucide-react";
import * as XLSX from 'xlsx';

interface SkewnessData {
    untransformed: number | null;
    log: number | null;
    sqrt: number | null;
    boxcox: number | null;
    arcsine?: number | null;
    yeojohnson?: number | null;
}

interface AnalysisResult {
    skewness: SkewnessData;
    suggestion: string;
    originalNormalityInterpretation?: string;
    suggestedTransformationFormula?: string;
    all_scores?: { [key: string]: number };
    original_normality: {
        shapiro_wilk?: { name: string; interpretation: string; };
        dagostino_pearson?: { name: string; interpretation: string; };
        kolmogorov_smirnov: { name: string; interpretation: string; };
        descriptive_stats: { skewness_interpretation: string; kurtosis_interpretation: string; };
        overall_assessment: { recommendation: string; };
    };
}

interface BackendAnalysisResult {
    recommendation: string;
    score: number;
    reason: string;
    original_normality: {
        shapiro_wilk?: { name: string; statistic: number; p_value: number; is_normal: boolean; interpretation: string; };
        dagostino_pearson?: { name: string; statistic: number; p_value: number; is_normal: boolean; interpretation: string; };
        kolmogorov_smirnov: { name: string; statistic: number; p_value: number; is_normal: boolean; interpretation: string; };
        descriptive_stats: { skewness: number; kurtosis: number; skewness_interpretation: string; kurtosis_interpretation: string; };
        overall_assessment: { likely_normal: boolean; recommendation: string; };
    };
    transformation_details?: {
        [key: string]: {
            data: number[];
            formula?: string;
            applicable: boolean;
            normality_tests: any;
        }
    };
    all_scores?: { [key: string]: number };
    suggested_transformation?: {
        data: number[];
        formula: string;
        applicable: boolean;
        normality_tests: any;
    };
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
  // State for transformation
  const [transformChoice, setTransformChoice] = useState<string>('');
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
    setTransformChoice('');
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
      setError("Error processing file. Please ensure it's a valid Excel file.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = useCallback(async () => {
    if (!data.length || !responseCol) {
      setAnalysisError('Please process a file and select a response column.');
      return;
    }

    setAnalysisLoading(true);
    setAnalysisError('');
    setAnalysisResult(null);

    const analyzeServiceUrl = `${process.env.NEXT_PUBLIC_TRANX_SERVICE_URL}/analyze_transformations`;

    try {
      const response = await fetch(analyzeServiceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data, response_col: responseCol, transform_choice: transformChoice }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      const results: BackendAnalysisResult = await response.json();

      const newSkewnessData: SkewnessData = {
          untransformed: results.original_normality?.descriptive_stats?.skewness ?? null,
          log: results.transformation_details?.log?.normality_tests?.descriptive_stats?.skewness ?? null,
          sqrt: results.transformation_details?.sqrt?.normality_tests?.descriptive_stats?.skewness ?? null,
          boxcox: results.transformation_details?.boxcox?.normality_tests?.descriptive_stats?.skewness ?? null,
          arcsine: results.transformation_details?.arcsine?.normality_tests?.descriptive_stats?.skewness ?? null,
          yeojohnson: results.transformation_details?.yeojohnson?.normality_tests?.descriptive_stats?.skewness ?? null,
      };

      setAnalysisResult({
          skewness: newSkewnessData,
          suggestion: results.recommendation,
          originalNormalityInterpretation: results.original_normality?.overall_assessment?.recommendation,
          suggestedTransformationFormula: results.suggested_transformation?.formula,
          all_scores: results.all_scores,
          original_normality: results.original_normality,
      });
      
      setTransformChoice(results.recommendation || '');

    } catch (err: any) {
      setAnalysisError(err.message || 'An unexpected error occurred during analysis');
    } finally {
      setAnalysisLoading(false);
    }
  }, [data, responseCol, transformChoice]);

  useEffect(() => {
    if (responseCol && data.length > 0) {
      handleAnalyze();
    }
  }, [responseCol, data, handleAnalyze]);

  const handleTransform = async () => {
    if (!data.length || !responseCol || !transformChoice) {
      setTransformError('Please process a file, select a response column, and a transformation type.');
      return;
    }
 
    setTransformLoading(true);
    setTransformError('');
    setTransformedData([]);

    const tranxServiceUrl = `${process.env.NEXT_PUBLIC_TRANX_SERVICE_URL}/transform`;

    try {
      const response = await fetch(tranxServiceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data, response_col: responseCol, transform_choice: transformChoice }),
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
      [factorCol]: row[factorCol]?.toString(),
      [blockCol]: row[blockCol]?.toString(),
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

        <Dialog.Root>
          <Dialog.Trigger asChild>
            <Button variant="outline" className="mb-4 flex items-center">
              <Info className="h-4 w-4 mr-2" />
              About Data Transformations
            </Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/30" />
            <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-md bg-white p-10 text-gray-900 shadow-lg">
              <Dialog.Title className="text-lg font-medium">About Data Transformations</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-gray-600">
                This guide explains the different data transformations available and how the tool works.
              </Dialog.Description>
              <div className="grid gap-1 py-4 text-sm">
                <h3 className="font-semibold text-lg">What transformations can this tool perform?</h3>
                <p>This tool can perform several common data transformations to help normalize your data:</p>
                <ul className="list-disc list-inside space-y-1 pl-4">
                  <li><strong>Log Transformation:</strong> Effective for data that is right-skewed. An offset is automatically added for zero or negative values.</li>
                  <li><strong>Square Root Transformation:</strong> A gentler transformation than Log, also used for right-skewed data. An offset is added for negative values.</li>
                  <li><strong>Box-Cox Transformation:</strong> A powerful transformation that finds the best exponent to normalize data. It requires all data to be positive.</li>
                  <li><strong>Yeo-Johnson Transformation:</strong> An extension of the Box-Cox transformation that can handle both positive and negative data.</li>
                  <li><strong>Arcsine Transformation:</strong> Primarily used for proportion data where values are between 0 and 1.</li>
                </ul>
                <h3 className="font-semibold text-lg mt-4">How does the tool work?</h3>
                <p>The tool evaluates your data against key assumptions of normality. It checks for:</p>
                <ul className="list-disc list-inside space-y-1 pl-4">
                  <li><strong>Normality:</strong> Using statistical tests (like Shapiro-Wilk) to see if the data follows a normal (Gaussian) distribution.</li>
                  <li><strong>Skewness:</strong> Measuring the asymmetry of the data distribution.</li>
                  <li><strong>Kurtosis:</strong> Measuring the &quot;tailedness&quot; of the distribution.</li>
                </ul>
                <h3 className="font-semibold text-lg mt-4">About the Recommendation Score</h3>
                <p>The tool applies each suitable transformation and re-evaluates the transformed data. It then calculates a &quot;recommendation score&quot; for each one based on how well it has corrected issues like non-normality and skewness. The transformation with the highest score is presented as the recommended option.</p>
              </div>
              <Dialog.Close asChild>
                <Button variant="outline" className="mt-4">Close</Button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

       <Card className="mb-8 border border-pink-200 rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Upload className="h-5 w-5 mr-2" />
              1. Upload Data File
            </CardTitle>
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
              <CardTitle>3. Original Data Assessment</CardTitle>
              <CardDescription>Normality tests for the original data.</CardDescription>
            </CardHeader>
            <CardContent>
                <table className="min-w-full divide-y divide-pink-200">
                    <thead className="bg-pink-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-black-500 uppercase tracking-wider">Test</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-black-500 uppercase tracking-wider">Result</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-pink-200">
                        {analysisResult.original_normality?.shapiro_wilk && (
                            <tr>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-black-900">{analysisResult.original_normality.shapiro_wilk.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-black-500">{analysisResult.original_normality.shapiro_wilk.interpretation}</td>
                            </tr>
                        )}
                        {analysisResult.original_normality?.dagostino_pearson && (
                            <tr>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-black-900">{analysisResult.original_normality.dagostino_pearson.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-black-500">{analysisResult.original_normality.dagostino_pearson.interpretation}</td>
                            </tr>
                        )}
                        {analysisResult.original_normality?.kolmogorov_smirnov && (
                            <tr>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-black-900">{analysisResult.original_normality.kolmogorov_smirnov.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-black-500">{analysisResult.original_normality.kolmogorov_smirnov.interpretation}</td>
                            </tr>
                        )}
                        <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-black-900">Skewness</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-black-500">{analysisResult.original_normality?.descriptive_stats?.skewness_interpretation}</td>
                        </tr>
                        <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-black-900">Kurtosis</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-black-500">{analysisResult.original_normality?.descriptive_stats?.kurtosis_interpretation}</td>
                        </tr>
                        <tr className="bg-gray-100 font-bold">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-black-900">Overall Assessment</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-black-500">{analysisResult.original_normality?.overall_assessment?.recommendation}</td>
                        </tr>
                    </tbody>
                </table>
            </CardContent>
          </Card>
        )}

        {analysisResult && analysisResult.all_scores && (
          <Card className="mb-8 border border-pink-200 rounded-lg">
            <CardHeader>
              <CardTitle>4. Transformation Scores</CardTitle>
              <CardDescription>Scores for different transformations. Higher score is better.</CardDescription>
            </CardHeader>
            <CardContent>
                <table className="min-w-full divide-y divide-pink-200">
                    <thead className="bg-pink-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-black-500 uppercase tracking-wider">Transformation</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-black-500 uppercase tracking-wider">Score</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-black-500 uppercase tracking-wider">Recommendation</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-pink-200">
                        {Object.entries(analysisResult.all_scores).map(([key, value]) => (
                            <tr key={key}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-black-900 capitalize">{key.replace('_', ' ')}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-black-500">{value.toFixed(2)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-black-500">
                                    {key === analysisResult.suggestion && <CheckCircle className="h-5 w-5 text-green-600"/>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </CardContent>
          </Card>
        )}

        {analysisResult && (
          <Card className="mb-8 border border-pink-200 rounded-lg">
            <CardHeader>
              <CardTitle>5. Apply Transformation</CardTitle>
              <CardDescription>Choose a transformation and apply it to your data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block mb-1 font-medium">Transformation Type</label>
                <select value={transformChoice} onChange={e => setTransformChoice(e.target.value)} className="block w-full p-2 border border-pink-300 rounded-md shadow-sm">
                  <option value="">Select Transformation</option>
                  <option value="untransformed">No Transformation</option>
                  <option value="log">Log Transformation</option>
                  <option value="sqrt">Square Root Transformation</option>
                  <option value="boxcox">Box-Cox Transformation</option>
                  <option value="yeojohnson">Yeo-Johnson Transformation</option>
                  <option value="arcsine">Arcsine Transformation</option>
                </select>
              </div>
              <Button onClick={handleTransform} disabled={transformLoading || !responseCol || !transformChoice}>
                {transformLoading ? 'Transforming...' : 'Run Transformation'}
              </Button>
              {transformError && <div className="text-red-600 text-sm bg-red-50 p-3 rounded mt-4">{transformError}</div>}
            </CardContent>
          </Card>
        )}

        {previewData.length > 0 && (
            <Card className="border border-pink-200 rounded-lg">
              <CardHeader>
                <CardTitle>6. Transformed Data Preview</CardTitle>
                <CardDescription>Showing factor, block, original, and transformed values.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-pink-200">
                    <thead className="bg-pink-50">
                      <tr>
                        {Object.keys(previewData[0] || {}).map(key => <th key={key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{key}</th>) }
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-pink-200">
                      {previewData.slice(0, 5).map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {Object.values(row).map((value: any, colIndex) => (
                            <td key={colIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {typeof value === 'number' ? value.toFixed(2) : value?.toString()}
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
// This file is part of the Tranx page in a Next.js application.