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
              <h3 className="text-lg font-semibold mb-2">ANOVA Table</h3>
              <div className="overflow-x-auto mb-6">
                {frbdResults.anova_table && (() => {
                  try {
                    const parsedAnovaTable = JSON.parse(frbdResults.anova_table);
                    const columnHeaders = Object.keys(parsedAnovaTable);
                    // Determine the number of rows by checking the length of the first column's values
                    const rowCount = columnHeaders.length > 0 ? Object.keys(parsedAnovaTable[columnHeaders[0]]).length : 0;

                    if (rowCount === 0) {
                      return <p>ANOVA table is empty or could not be parsed. Raw data: {frbdResults.anova_table}</p>;
                    }

                    return (
                      <table className="w-full border-collapse border border-gray-300">
                        <thead>
                          <tr className="bg-gray-50">
                            {/* Render index column header */}
                            <th className="border border-gray-300 px-4 py-2 text-left"></th>
                            {columnHeaders.map((header, index) => (
                              <th key={index} className="border border-gray-300 px-4 py-2 text-left">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {/* Iterate through the row indices to build each table row */}
                          {Object.keys(parsedAnovaTable[columnHeaders[0]]).map((rowIndex) => (
                            <tr key={rowIndex}>
                              {/* Render the index column value */}
                              <td className="border border-gray-300 px-4 py-2 font-medium">
                                {rowIndex}
                              </td>
                              {columnHeaders.map((header, colIndex) => (
                                <td key={colIndex} className="border border-gray-300 px-4 py-2">
                                  {parsedAnovaTable[header][rowIndex]}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  } catch (e) {
                    console.error("Error parsing ANOVA table:", e);
                    return <p>Error loading ANOVA table. Raw data: {frbdResults.anova_table}</p>;
                  }
                })()}
              </div>

              <h3 className="text-lg font-semibold mb-2">Tukey HSD Post-Hoc Tests</h3>
              {frbdResults.tukey_results && Object.keys(frbdResults.tukey_results).map((factor) => (
                <div key={factor} className="mb-4">
                  <h4 className="text-md font-medium mb-1">Factor: {factor}</h4>
                  <div 
                    className="bg-gray-100 p-4 rounded-md overflow-x-auto"
                    dangerouslySetInnerHTML={{ __html: frbdResults.tukey_results[factor] }}
                  />
                </div>
              ))}

              <h3 className="text-lg font-semibold mb-2">Mean Separation Results</h3>
              {frbdResults.mean_separation_results && Object.keys(frbdResults.mean_separation_results).map((factor) => (
                <div key={factor} className="mb-4">
                  <h4 className="text-md font-medium mb-1">Factor: {factor}</h4>
                  <div
                    className="bg-gray-100 p-4 rounded-md overflow-x-auto"
                    dangerouslySetInnerHTML={{ __html: frbdResults.mean_separation_results[factor] }}
                  />
                </div>
              ))}

              <h3 className="text-lg font-semibold mb-2">Shapiro-Wilk Test for Normality of Residuals</h3>
              {frbdResults.shapiro && (
                <div className="bg-gray-100 p-4 rounded-md mb-6">
                  <p><strong>Statistic:</strong> {frbdResults.shapiro.stat.toFixed(4)}</p>
                  <p><strong>P-value:</strong> {frbdResults.shapiro.p.toFixed(4)}</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {frbdResults.shapiro.p < 0.05 ? 
                      "Residuals are likely not normally distributed (p < 0.05)." : 
                      "Residuals appear to be normally distributed (p >= 0.05)."}
                  </p>
                </div>
              )}

              <h3 className="text-lg font-semibold mb-2">Diagnostic Plots</h3>
              {frbdResults.plots && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {frbdResults.plots.residuals_vs_fitted && (
                    <div className="border p-2 rounded-md">
                      <h4 className="text-md font-medium mb-1">Residuals vs Fitted</h4>
                      <img 
                        src={`data:image/png;base64,${frbdResults.plots.residuals_vs_fitted}`} 
                        alt="Residuals vs Fitted Plot" 
                        className="w-full h-auto"
                      />
                    </div>
                  )}
                  {frbdResults.plots.qq_plot && (
                    <div className="border p-2 rounded-md">
                      <h4 className="text-md font-medium mb-1">Normal Q-Q Plot</h4>
                      <img 
                        src={`data:image/png;base64,${frbdResults.plots.qq_plot}`} 
                        alt="Normal Q-Q Plot" 
                        className="w-full h-auto"
                      />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}