'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Upload, BarChart3, Info, Sparkles } from "lucide-react";
import * as XLSX from 'xlsx';
import { generateRbdAnalysisSummary } from '../actions';


export default function RbdPage() {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [columnHeaders, setColumnHeaders] = useState<string[]>([]);
  const [missingValuesCount, setMissingValuesCount] = useState<number>(0);

  // State for AI summary
  const [aiSummary, setAiSummary] = useState<string>('');
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState<string>('');

  // State for RBD analysis
  const [blockCol, setBlockCol] = useState<string>('');
  const [factorCol, setFactorCol] = useState<string>('');
  const [responseValueCol, setResponseValueCol] = useState<string>('');
  const [responseVariableCol, setResponseVariableCol] = useState<string>('');
  const [selectedResponseVariable, setSelectedResponseVariable] = useState<string>('');
  const [uniqueResponseVariables, setUniqueResponseVariables] = useState<string[]>([]);
  const [rbdResults, setRbdResults] = useState<any>(null);
  const [rbdError, setRbdError] = useState<string>('');
  const [rbdLoading, setRbdLoading] = useState(false);
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);
  const [anovaSignificance, setAnovaSignificance] = useState<Record<string, boolean>>({});
  const [analysisCompleted, setAnalysisCompleted] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (rbdResults && rbdResults.plots) {
      console.log('rbdResults.plots:', rbdResults.plots);
    }
  }, [rbdResults]);

 // Helper function to clean factor names
 const cleanFactorName = (name: string) => {
  // Extracts content from Q('...') or Q("...")
  const qMatches = [...name.matchAll(/Q\(['"]([^\'\"]*)['"]\)/g)];
  if (qMatches.length > 0) {
    const factors = qMatches.map(m => m[1]);
    return [...new Set(factors)].join(':');
  }

  // Handles C(...) for cases without Q(...) inside, like C(my_factor)
  const cMatch = name.match(/^C\((.+)\)$/);
  if (cMatch) {
    return cMatch[1];
  }

  return name; // Return original name if no patterns match
};

  const renderResultsTable = (data: string, isSignificant?: boolean) => {
    try {
        // First, try to see if it\'s HTML content with a table
        if (typeof data === 'string' && data.includes('<table')) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(data, 'text/html');
            const table = doc.querySelector('table');

            if (table) {
                const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent?.trim() || '');
                const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr =>
                    Array.from(tr.querySelectorAll('td, th')).map(cell => cell.textContent?.trim() || '')
                );

                if (headers.length > 0 || rows.length > 0) {
                    return (
                        <div className="overflow-x-auto mb-6">
                            <table className="w-full border-collapse border border-blue-300">
                                <thead className="bg-blue-50">
                                    <tr className="bg-blue-50">
                                        {headers.map((h, i) => <th key={`${h}-${i}`} className="border border-blue-300 px-4 py-2 text-left">{h}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row, i) => (
                                        <tr key={i}>
                                            {row.map((cell, j) => <td key={`${i}-${j}`} className="border border-blue-300 px-4 py-2">{cell}</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                }
            }
        }
        
        let parsedData = JSON.parse(data);

        if (isSignificant === false && Array.isArray(parsedData)) {
            parsedData = parsedData.map(row => {
                if (row.hasOwnProperty('Significance')) {
                    return { ...row, Significance: 'NaN' };
                }
                return row;
            });
        }

        // Case 1: Array of objects for Tukey/Mean Separation
        if (Array.isArray(parsedData) && parsedData.length > 0) {
            const headers = Object.keys(parsedData[0]);
            
            const sortedData = [...parsedData].sort((a, b) => {
                const valA = a[headers[0]];
                const valB = b[headers[0]];

                if (typeof valA === 'string' && typeof valB === 'string') {
                    return valA.localeCompare(valB);
                }
                if (typeof valA === 'number' && typeof valB === 'number') {
                    return valA - valB;
                }
                return String(valA).localeCompare(String(valB));
            });

            return (
                <div className="overflow-x-auto mb-6">
                    <table className="w-full border-collapse border border-blue-300">
                        <thead className="bg-blue-50">
                            <tr className="bg-blue-50">
                                {headers.map(h => <th key={h} className="border border-blue-300 px-4 py-2 text-left">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedData.map((row, i) => (
                                <tr key={i}>
                                    {headers.map(h => (
                                        <td key={`${i}-${h}`} className="border border-blue-300 px-4 py-2">
                                            {h === 'reject'
                                                ? String(row[h])
                                                : (!isNaN(Number(row[h])) && row[h] !== null && String(row[h]).trim() !== ''
                                                    ? Number(row[h]).toFixed(2)
                                                    : String(row[h]))}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        // Case 2: Object of objects for ANOVA-like tables
        const headers = Object.keys(parsedData);
        if (headers.length > 0 && typeof parsedData[headers[0]] === 'object' && parsedData[headers[0]] !== null && !Array.isArray(parsedData[headers[0]])) {
            const rowKeys = Object.keys(parsedData[headers[0]]);
            return (
                <div className="overflow-x-auto mb-6">
                    <table className="w-full border-collapse border border-blue-300">
                        <thead className="bg-blue-50">
                            <tr className="bg-blue-50">
                                <th className="border border-blue-300 px-4 py-2 text-left"></th>
                                {headers.map(h => <th key={h} className="border border-blue-300 px-4 py-2 text-left">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {rowKeys.map(key => (
                                <tr key={key}>
                                    <td className="border border-blue-300 px-4 py-2 font-medium">{key}</td>
                                    {headers.map(h => <td key={`${key}-${h}`} className="border border-blue-300 px-4 py-2">{!isNaN(Number(parsedData[h][key])) && parsedData[h][key] !== null && String(parsedData[h][key]).trim() !== '' ? Number(parsedData[h][key]).toFixed(2) : String(parsedData[h][key])}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        throw new Error("JSON data is not in a recognized table format.");
    } catch (e) {
        return <div className="overflow-x-auto bg-blue-50 p-4 rounded-md mb-6" dangerouslySetInnerHTML={{ __html: data }} />;
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setError('');
      setData([]);
      setRbdResults(null);
    }
  };

  const handleReset = () => {
    setFile(null);
    setData([]);
    setError('');
    setBlockCol('');
    setFactorCol('');
    setResponseValueCol('');
    setResponseVariableCol('');
    setSelectedResponseVariable('');
    setUniqueResponseVariables([]);
    setRbdResults(null);
    setRbdError('');
    setRbdLoading(false);
    setAnovaSignificance({});
    setAnalysisCompleted(false);
    setShowRawJson(false);
    setAiSummary('');
    setAiSummaryError('');
    setAiSummaryLoading(false);
    setMissingValuesCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Clear the file input
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
      setError("Error processing file. Please ensure it\'s a valid Excel file.");
    } finally {
      setLoading(false);
    }
  };

  const handleRbdAnalysis = async () => {
    if (!file || !blockCol || !factorCol || !responseValueCol || (responseVariableCol && !selectedResponseVariable)) {
      setRbdError('Please select a file and specify all required column names, and a response variable if a response variable column is selected.');
      return;
    }

    let dataToAnalyze = data;

    if (responseVariableCol && selectedResponseVariable) {
      dataToAnalyze = data.filter(row => row[responseVariableCol]?.toString() === selectedResponseVariable);
      if (dataToAnalyze.length === 0) {
        setRbdError(`No data found for selected response variable: ${selectedResponseVariable}`);
        return;
      }
    }

    setRbdLoading(true);
    setRbdError('');
    setRbdResults(null);
    setAnalysisCompleted(false);
    setCountdown(30);

    intervalRef.current = setInterval(() => {
      setCountdown(prev => (prev ? prev - 1 : null));
    }, 1000);

    const formData = new FormData();
    // Instead of appending the entire file, we\'ll send the filtered data as JSON
    formData.append('data', JSON.stringify(dataToAnalyze));
    formData.append('block_col', blockCol);
    formData.append('factor_col', factorCol);
    formData.append('response_col', responseValueCol);

    const rbdServiceUrl = process.env.NEXT_PUBLIC_RBD_SERVICE_URL;

    if (!rbdServiceUrl) {
      setRbdError('RBD service URL not configured');
      setRbdLoading(false);
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30-second timeout

      const response = await fetch(rbdServiceUrl, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      const results = await response.json();
      setRbdResults(results);
      setAnalysisCompleted(true);
      if (results.anova_table) {
        try {
          const parsedAnova = JSON.parse(results.anova_table);
          const newAnovaSignificance: Record<string, boolean> = {};
          const pValues = parsedAnova['PR(>F)'];
          if (pValues) {
            Object.keys(pValues).forEach(factor => {
              const pValue = pValues[factor];
              newAnovaSignificance[cleanFactorName(factor)] = pValue < 0.05;
            });
          }
          setAnovaSignificance(newAnovaSignificance);
        } catch (e) {
          console.error("Could not parse anova_table to determine significance", e);
          setAnovaSignificance({});
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setRbdError('Request timed out. Please try again.');
      } else {
        setRbdError(err.message || 'An unexpected error occurred');
      }
    } finally {
      setRbdLoading(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      setCountdown(null);
    }
  };

  const handleGenerateAiSummary = async () => {
    if (!rbdResults) {
      setAiSummaryError('Please run the RBD analysis first.');
      return;
    }

    setAiSummaryLoading(true);
    setAiSummaryError('');
    setAiSummary('');

    try {
      const input = {
        anova_table: rbdResults.anova_table,
        tukey_results: JSON.stringify(rbdResults.tukey_results),
        shapiro: rbdResults.shapiro,
        mean_separation_results: JSON.stringify(rbdResults.mean_separation_results),
        f_oneway_results: rbdResults.f_oneway_results,
        overall_cv: rbdResults.overall_cv,
        cd_value: rbdResults.cd_value,
      };

      const summary = await generateRbdAnalysisSummary(input);
      setAiSummary(summary);
    } catch (err: any) {
      setAiSummaryError(err.message || 'Failed to generate AI summary.');
    } finally {
      setAiSummaryLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <BarChart3 className="h-8 w-8 text-blue-600 mr-3" />
            <h1 className="text-3xl font-bold">RCBD Analysis</h1>
          </div>
          <p className="text-muted-foreground">
            Upload your Excel file and perform Randomized Complete Block Design (RCBD) analysis.
          </p>
        </div>

                   
        {/* File Upload Card */}
        <Card className="mb-8 border border-blue-200 rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Upload className="h-5 w-5 mr-2" />
              Upload Data File
            </CardTitle>
            <CardDescription>
              Select an Excel (.xlsx) file containing your data (up to 5 MB)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm">
                Before uploading check out the required data format.  
                <Link href="/data_arrangement" passHref>
                  <Button variant="link" className="p-1 h-auto ml-1, text-blue-600 hover:underline">
                  Read this to prepare your data.
                  </Button>
                </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="flex-1 bg-blue-50"
                ref={fileInputRef}
              />
              <Button 
                onClick={processFile} 
                disabled={!file || loading}
                className="min-w-[120px]"
              >
                {loading ? 'Processing...' : 'Process File'}
              </Button>
              <Button 
                onClick={handleReset} 
                variant="outline"
                disabled={!file && data.length === 0 && !rbdResults}
                className="min-w-[120px]"
              >
                Reset
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
            <Card className="mb-8 border border-blue-200 rounded-lg">
              <CardHeader>
                <CardTitle>Data Preview</CardTitle>
                <CardDescription>First 5 rows of the uploaded data.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-blue-200">
                    <thead className="bg-blue-50">
                      <tr>
                        {Object.keys(data[0] || {}).map((key) => (
                          <th
                            key={key}
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-blue-200">
                      {data.slice(0, 5).map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {Object.values(row).map((value: any, colIndex) => (
                            <td
                              key={colIndex}
                              className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                            >
                              {typeof value === 'number' ? value.toFixed(2) : value?.toString()}
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
                {missingValuesCount > 0 && (
                  <div className="mt-2 text-sm text-yellow-600">
                    Warning: Found {missingValuesCount} missing value(s) in your data. Rows with missing values will be excluded from the analysis.
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* RBD Column Selection */}
          {data.length > 0 && (
              <Card className="mb-8 border border-blue-200 rounded-lg">
                <CardHeader>
                  <CardTitle>RCBD Analysis Setup</CardTitle>
                  <CardDescription>Specify the columns for the analysis.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-1 font-medium">Block Column (eg. replication)</label>
                      <select
                          value={blockCol}
                          onChange={e => setBlockCol(e.target.value)}
                          className="block w-full p-2 border border-blue-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      >
                        <option value="">Select a column</option>
                        {columnHeaders.map(header => (
                            <option key={header} value={header}>{header}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block mb-1 font-medium">Factor Column (eg, treatment)</label>
                      <select
                          value={factorCol}
                          onChange={e => setFactorCol(e.target.value)}
                          className="block w-full p-2 border border-blue-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      >
                        <option value="">Select a column</option>
                        {columnHeaders.map(header => (
                            <option key={header} value={header}>{header}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-1 font-medium">Response Variable Column (Optional)</label>
                      <select
                          value={responseVariableCol}
                          onChange={e => {
                            setResponseVariableCol(e.target.value);
                            setSelectedResponseVariable(''); // Reset selected variable when column changes
                            if (e.target.value) {
                              const uniqueValues = [...new Set(data.map(row => row[e.target.value]))].map(String);
                              setUniqueResponseVariables(uniqueValues);
                            } else {
                              setUniqueResponseVariables([]);
                            }
                          }}
                          className="block w-full p-2 border border-blue-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      >
                        <option value="">Select a column for response variable</option>
                        {columnHeaders.map(header => (
                            <option key={header} value={header}>{header}</option>
                        ))}
                      </select>
                    </div>
                    {responseVariableCol && (
                        <div>
                          <label className="block mb-1 font-medium">Select Response Variable </label>
                          <select
                              value={selectedResponseVariable}
                              onChange={e => setSelectedResponseVariable(e.target.value)}
                              className="block w-full p-2 border border-blue-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          >
                            <option value="">Select a variable</option>
                            {uniqueResponseVariables.map(variable => (
                                <option key={variable} value={variable}>{variable}</option>
                            ))}
                          </select>
                        </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-1 font-medium">Response Value Column (eg. yield)</label>
                      <select
                          value={responseValueCol}
                          onChange={e => setResponseValueCol(e.target.value)}
                          className="block w-full p-2 border border-blue-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      >
                        <option value="">Select a column</option>
                        {columnHeaders.map(header => (
                            <option key={header} value={header}>{header}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </CardContent>
                <div className="px-6 pb-6">
                  <div className="flex items-center space-x-4"> {/* Added flex container */}
                    <Button
                      onClick={handleRbdAnalysis}
                      disabled={rbdLoading || !blockCol || !factorCol || !responseValueCol || (responseVariableCol && !selectedResponseVariable)}
                    >
                      {rbdLoading ? `Running Analysis... (${countdown}s)` : 'Run RCBD Analysis'}
                    </Button>
                    {analysisCompleted && !rbdLoading && (
                      <div className="text-blue-600 text-sm bg-blue-50 p-3 rounded"> {/* Removed mt-4 */}
                        Analysis over. Results are below.
                      </div>
                    )}
                  </div>
                  {rbdError && (
                    <div className="text-red-600 text-sm bg-red-50 p-3 rounded mt-4">
                      {rbdError}
                    </div>
                  )}
                </div>
              </Card>
          )}

          

          {/* RBD Results */}
          {rbdResults && (
            <Card className="mb-8 border border-blue-200 rounded-lg">
              <CardHeader>
                <CardTitle>Diagnostic Plots and Normality Test</CardTitle>
              </CardHeader>
              <CardContent>
                <h3 className="text-lg font-semibold mb-2">Diagnostic Plots</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rbdResults.plots.residuals_vs_fitted && (
                    <div className="border p-2 rounded-md">
                      <h4 className="text-md font-medium mb-1">Residuals vs Fitted</h4>
                      <Image
                        src={`data:image/png;base64,${rbdResults.plots.residuals_vs_fitted}`}
                        alt="Residuals vs Fitted Plot"
                        width={500}
                        height={300}
                        className="w-full h-auto"
                      />
                    </div>
                  )}
                  {rbdResults.plots.qq_plot && (
                    <div className="border p-2 rounded-md">
                      <h4 className="text-md font-medium mb-1">Normal Q-Q Plot</h4>
                      <Image
                        src={`data:image/png;base64,${rbdResults.plots.qq_plot}`}
                        alt="Normal Q-Q Plot"
                        width={500}
                        height={300}
                        className="w-full h-auto"
                      />
                    </div>
                  )}
                </div>
                <h3 className="text-lg font-semibold mb-2">Shapiro-Wilk Test for Normality of Residuals</h3>
                {rbdResults.shapiro && (
                  <div className="bg-blue-50 p-4 rounded-md mb-6">
                    <p><strong>Statistic:</strong> {rbdResults.shapiro.stat.toFixed(4)}</p>
                    <p><strong>P-value:</strong> {rbdResults.shapiro.p.toFixed(4)}</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {rbdResults.shapiro.p < 0.05
                        ? "Residuals are likely not normally distributed (p < 0.05)."
                        : "Residuals appear to be normally distributed (p >= 0.05)."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {rbdResults && (
            <Card className="mb-8 border border-blue-200 rounded-lg">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>RCBD Analysis Results</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setShowRawJson(!showRawJson)}>
                    {showRawJson ? 'Hide' : 'Show'} Raw JSON
                </Button>
              </CardHeader>
              {showRawJson && (
                <CardContent>
                    <pre className="p-4 bg-gray-100 rounded-md overflow-x-auto">
                    {JSON.stringify(rbdResults, null, 2)}
                    </pre>
                </CardContent>
              )}
              <CardContent>
                <h3 className="text-lg font-semibold mb-2">ANOVA Table</h3>
                <div className="overflow-x-auto mb-6">
                  {rbdResults.anova_table && (() => {
                    try {
                      const parsedAnovaTable = JSON.parse(rbdResults.anova_table);
                      const columnHeaders = Object.keys(parsedAnovaTable);
                      const rowCount = columnHeaders.length > 0 ? Object.keys(parsedAnovaTable[columnHeaders[0]]).length : 0;

                      if (rowCount === 0) {
                        return <p>ANOVA table is empty or could not be parsed. Raw data: {rbdResults.anova_table}</p>;
                      }

                      return (
                        <table className="w-full border-collapse border border-blue-300">
                          <thead>
                            <tr className="bg-blue-50">
                              <th className="border border-blue-300 px-4 py-2 text-left">Source of error</th>
                              {columnHeaders.map((header, index) => (
                                <th key={index} className="border border-blue-300 px-4 py-2 text-left">
                                  {header}
                                </th>
                              ))}
                              <th className="border border-blue-300 px-4 py-2 text-left">Significance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.keys(parsedAnovaTable[columnHeaders[0]]).map((rowIndex) => {
                              const pValue = parsedAnovaTable['PR(>F)']?.[rowIndex];
                              const showSignificance = pValue !== null && pValue !== undefined;

                              return (
                                <tr key={rowIndex}>
                                  <td className="border border-blue-300 px-4 py-2 font-medium">
                                    {cleanFactorName(rowIndex)}
                                  </td>
                                  {columnHeaders.map((header, colIndex) => (
                                    <td key={colIndex} className="border border-blue-300 px-4 py-2">
                                      {parsedAnovaTable[header][rowIndex]}
                                    </td>
                                  ))}
                                  <td className="border border-blue-300 px-4 py-2">
                                    {showSignificance ? (pValue < 0.05 ? 'Significant' : 'Not significant') : ''}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      );
                    } catch (e) {
                      console.error("Error parsing ANOVA table:", e);
                      return <p>Error loading ANOVA table. Raw data: {rbdResults.anova_table}</p>;
                    }
                  })()}
                </div>

                {rbdResults.overall_cv !== null && rbdResults.overall_cv !== undefined && (
                    <div className="text-left text-sm text-muted-foreground mb-5">
                        Overall CV (%): {rbdResults.overall_cv.toFixed(2)}
                    </div>
                )}

                <h3 className="text-lg font-semibold mb-2">Tukey HSD Post-Hoc Tests</h3>
                {rbdResults.tukey_results && Object.keys(rbdResults.tukey_results).map((factor) => (
                  <div key={factor} className="mb-4">
                    <h4 className="text-md font-medium mb-1">Factor: {cleanFactorName(factor)}</h4>
                    {renderResultsTable(rbdResults.tukey_results[factor])}
                  </div>
                ))}

                {rbdResults.tukey_explanation && (
                  <div>
                    <Button onClick={() => setIsExplanationOpen(!isExplanationOpen)} variant="link">
                      <Info className="h-4 w-4 mr-2" /> 
                      {isExplanationOpen ? 'Hide' : 'Show'} Explanation of the Post-hoc table
                    </Button>
                    {isExplanationOpen && (
                      <div className="prose prose-sm max-w-none mt-2" dangerouslySetInnerHTML={{ __html: rbdResults.tukey_explanation }} />
                    )}
                  </div>
                )}


                <h3 className="text-lg font-semibold my-4">Mean Separation Results</h3>
                {rbdResults.mean_separation_results && Object.keys(rbdResults.mean_separation_results).map((factor) => {
                  const cleanedFactorName = cleanFactorName(factor);
                  return (
                    <div key={factor} className="mb-4">
                      <h4 className="text-md font-medium mb-1">Factor: {cleanedFactorName}</h4>
                      {renderResultsTable(rbdResults.mean_separation_results[factor], anovaSignificance[cleanedFactorName])}
                    </div>
                  )
                })}

                {rbdResults.cd_value !== null && rbdResults.cd_value !== undefined && (
                    <div className="text-left text-sm text-muted-foreground mb-5">
                        Critical Difference (CD): {rbdResults.cd_value.toFixed(2)}
                    </div>
                )}

                
                  <h3 className="text-lg font-semibold mb-2">Mean Plots</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {rbdResults.plots.mean_bar_plot && (
                      <div className="border p-2 rounded-md">
                        <h4 className="text-md font-medium mb-1">Bar Plot</h4>
                        <Image
                          src={`data:image/png;base64,${rbdResults.plots.mean_bar_plot}`}
                          alt="Bar Plot"
                          width={500}
                          height={300}
                          className="w-full h-auto"
                        />
                      </div>
                    )}

                    {rbdResults.plots.mean_box_plot && (
                      <div className="border p-2 rounded-md">
                        <h4 className="text-md font-medium mb-1">Box Plot</h4>
                        <Image
                          src={`data:image/png;base64,${rbdResults.plots.mean_box_plot}`}
                          alt="Box Plot"
                          width={500}
                          height={300}
                          className="w-full h-auto"
                        />
                      </div>
                    )}
                  </div>

                  </CardContent>
            </Card>
          )}
      
      {rbdResults && (
            <Card className="mb-8 border border-blue-200 rounded-lg">
              <CardHeader>
                <CardTitle>AI-Powered Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <Button onClick={handleGenerateAiSummary} disabled={aiSummaryLoading}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {aiSummaryLoading ? 'Generating Summary...' : 'Generate AI Summary'}
                </Button>
                {aiSummaryError && (
                  <div className="text-red-600 text-sm bg-red-50 p-3 rounded mt-4">
                    {aiSummaryError}
                  </div>
                )}
                {aiSummary && (
                  <div className="prose prose-sm max-w-none mt-4" dangerouslySetInnerHTML={{ __html: aiSummary.replace(/\n/g, '<br />') }} />
                )}
              </CardContent>
            </Card>
          )}
      </div>
    </div>
  );
}
