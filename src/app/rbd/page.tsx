'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Upload, BarChart3 } from "lucide-react";
import * as XLSX from 'xlsx';

export default function RbdPage() {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [columnHeaders, setColumnHeaders] = useState<string[]>([]);

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper function to clean factor names
  const cleanFactorName = (name: string) => {
    return name.replace(/^C\(Q\(\"(.+)\"\)\)$/, '$1').replace(/^C\((.+)\)$/, '$1');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setError('');
      setData([]);
      setRbdResults(null);
      // Automatically process the file after it's selected
      await processFile(uploadedFile);
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
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        setError('No data found in the file');
        return;
      }

      setData(jsonData);
      setColumnHeaders(Object.keys(jsonData[0] || {}));
    } catch (err) {
      setError('Error processing file. Please ensure it\'s a valid Excel file.');
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

    const formData = new FormData();
    // Instead of appending the entire file, we'll send the filtered data as JSON
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
      const response = await fetch(rbdServiceUrl, {
        method: 'POST',
        // headers: {
        //   'Content-Type': 'application/json', // Set content type for JSON body
        // },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      const results = await response.json();
      setRbdResults(results);

    } catch (err: any) {
      setRbdError(err.message);
    } finally {
      setRbdLoading(false);
    }
  };


  return (
      
            
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            RBD Analysis
          </CardTitle>
          <CardDescription>
            Perform Randomized Block Design (RBD) analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Upload Section */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Upload className="h-5 w-5 mr-2" />
                Upload Data
              </CardTitle>
              <CardDescription>
                Upload your Excel file for RBD analysis.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Input type="file" onChange={handleFileUpload} ref={fileInputRef} />
                <Button onClick={processFile} disabled={!file || loading}>
                  {loading ? 'Processing...' : 'Process File'}
                </Button>
                <Button onClick={handleReset} variant="outline">
                  Reset
                </Button>
              </div>
              {file && <p className="text-sm text-gray-500">Selected file: {file.name}</p>}
              {error && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                  {error}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Data Preview */}
          {data.length > 0 && (
            <Card className="mb-6 mt-8">
              <CardHeader>
                <CardTitle>Data Preview</CardTitle>
                <CardDescription>First 5 rows of the uploaded data.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
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
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.slice(0, 5).map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {Object.values(row).map((value: any, colIndex) => (
                            <td
                              key={colIndex}
                              className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                            >
                              {value?.toString()}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* RBD Column Selection */}
          {data.length > 0 && (
              <Card className="mb-6 mt-8">
                <CardHeader>
                  <CardTitle>RBD Analysis Setup</CardTitle>
                  <CardDescription>Specify the columns for the analysis.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block mb-1 font-medium">Block Column</label>
                    <select
                        value={blockCol}
                        onChange={e => setBlockCol(e.target.value)}
                        className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="">Select a column</option>
                      {columnHeaders.map(header => (
                          <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1 font-medium">Factor Column</label>
                    <select
                        value={factorCol}
                        onChange={e => setFactorCol(e.target.value)}
                        className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="">Select a column</option>
                      {columnHeaders.map(header => (
                          <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
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
                        className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="">Select a column for response variable</option>
                      {columnHeaders.map(header => (
                          <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                  {responseVariableCol && (
                      <div>
                        <label className="block mb-1 font-medium">Select Response Variable</label>
                        <select
                            value={selectedResponseVariable}
                            onChange={e => setSelectedResponseVariable(e.target.value)}
                            className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        >
                          <option value="">Select a variable</option>
                          {uniqueResponseVariables.map(variable => (
                              <option key={variable} value={variable}>{variable}</option>
                          ))}
                        </select>
                      </div>
                  )}
                  <div>
                    <label className="block mb-1 font-medium">Response Value Column</label>
                    <select
                        value={responseValueCol}
                        onChange={e => setResponseValueCol(e.target.value)}
                        className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="">Select a column</option>
                      {columnHeaders.map(header => (
                          <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </div>
                </CardContent>
                <div className="px-6 pb-6">
                  <Button
                    onClick={handleRbdAnalysis}
                    disabled={rbdLoading || !blockCol || !factorCol || !responseValueCol || (responseVariableCol && !selectedResponseVariable)}
                  >
                    {rbdLoading ? 'Running Analysis...' : 'Run RBD Analysis'}
                  </Button>
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
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>RBD Analysis Results</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Display RBD results here */}
                  <pre>{JSON.stringify(rbdResults, null, 2)}</pre>
                </CardContent>
              </Card>
          )}
        </CardContent>
      </Card>
  );
}