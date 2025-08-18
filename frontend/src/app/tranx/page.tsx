'use client';

import * as XLSX from 'xlsx';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import * as Dialog from "@radix-ui/react-dialog";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Upload, Replace, CheckCircle, Info, Loader2, Download } from "lucide-react";


const analyzeServiceUrl = process.env.NEXT_PUBLIC_TRANX1_SERVICE_URL;
const tranxServiceUrl = process.env.NEXT_PUBLIC_TRANX2_SERVICE_URL;

function getNumericalColumns(data) {
  if (!data || data.length === 0) return [];
  const sample = data[0];
  return Object.keys(sample).filter(
    key => typeof sample[key] === 'number' || !isNaN(Number(sample[key]))
  );
}

interface NormalityResult {
  column: string;
  shapiro_wilk: string;
  dagostino_pearson: string;
  kolmogorov_smirnov: string;
  skewness: string;
  kurtosis: string;
  recommendation: string;
}

export default function Page() {
  const [file, setFile] = useState(null);
  const [rawData, setRawData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [normalityResults, setNormalityResults] = useState<NormalityResult[]>([]);
  const [transformRecommendations, setTransformRecommendations] = useState({});
  const [transformedData, setTransformedData] = useState([]);
  const [transformedColName, setTransformedColName] = useState('');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTransforming, setIsTransforming] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
        setFile(selectedFile);
        setError(''); // Clear previous errors
    }
  };

  const processFile = () => {
    if (!file) {
        setError('Please select a file first');
        return;
    }
    setIsProcessing(true);
    setError('');
    
    // Reset previous results
    setRawData([]);
    setColumns([]);
    setSelectedColumns([]);
    setNormalityResults([]);
    setTransformRecommendations({});
    setTransformedData([]);
    setTransformedColName('');

    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const result = evt.target?.result;
            if (!(result instanceof ArrayBuffer)) {
              throw new Error("File could not be read as an ArrayBuffer.");
            }
            const data = new Uint8Array(result);
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: true });

            if (jsonData.length === 0) {
                setError('No data found in the file.');
            } else {
                setRawData(jsonData);
                setColumns(getNumericalColumns(jsonData));
            }
        } catch (err) {
            setError("Error processing file. Please ensure it's a valid Excel file.");
        } finally {
            setIsProcessing(false);
        }
    };
    reader.onerror = () => {
        setError('Failed to read file.');
        setIsProcessing(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleReset = () => {
    setFile(null);
    setRawData([]);
    setColumns([]);
    setSelectedColumns([]);
    setNormalityResults([]);
    setTransformRecommendations({});
    setTransformedData([]);
    setTransformedColName('');
    setError('');
    setIsProcessing(false);
    setIsAnalyzing(false);
    setIsTransforming(false);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleColumnSelect = (col) => {
    setSelectedColumns((prev) =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
    setNormalityResults([]);
    setTransformRecommendations({});
    setTransformedData([]);
    setTransformedColName('');
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      if (selectedColumns.length === 0) {
        alert('Please select at least one column to analyze.');
        setIsAnalyzing(false);
        return;
      }
      const response_col = selectedColumns[0]; // analyze only first selected column per backend requirement
      
      const response = await fetch(analyzeServiceUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: rawData, response_col })
      });

      if (!response.ok) throw new Error('Analysis failed');
      const result = await response.json();

      setNormalityResults([{
        column: response_col,
        shapiro_wilk: result.original_normality?.shapiro_wilk?.interpretation || "-",
        dagostino_pearson: result.original_normality?.dagostino_pearson?.interpretation || "-",
        kolmogorov_smirnov: result.original_normality?.kolmogorov_smirnov?.interpretation || "-",
        skewness: result.original_normality?.descriptive_stats?.skewness_interpretation || "-",
        kurtosis: result.original_normality?.descriptive_stats?.kurtosis_interpretation || "-",
        recommendation: result.recommendation || "-"
      }]);

      if (result.recommendation && result.recommendation !== "No transformation needed") {
        setTransformRecommendations({
          [response_col]: { type: result.recommendation, score: result.score || 0 }
        });
      } else {
        setTransformRecommendations({});
      }

      setTransformedData([]);
      setTransformedColName('');
    } catch (error) {
      alert(error.message);
    }
    setIsAnalyzing(false);
  };

  const handleTransform = async (colName, transformType) => {
    setIsTransforming(true);
    try {
      const response = await fetch(tranxServiceUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: rawData,
          response_col: colName,
          transform_choice: transformType
        })
      });
      if (!response.ok) throw new Error('Transformation failed');
      const result = await response.json();
      alert(`Applied ${transformType} transformation on ${colName}`);

      if (result.transformed_data && result.transformed_response_col) {
        const td = JSON.parse(result.transformed_data);
        setTransformedData(td);
        setTransformedColName(result.transformed_response_col);
      } else {
        setTransformedData([]);
        setTransformedColName('');
      }
    } catch (error) {
      alert(error.message);
    }
    setIsTransforming(false);
  };

  const handleExport = () => {
    if (transformedData.length === 0) {
      alert("No data to export.");
      return;
    }

    const originalColName = selectedColumns[0];
    const transformedCol = transformedColName;

    const dataToExport = transformedData.map((row, i) => {
      const originalValue = rawData[i]?.[originalColName];
      const transformedValue = row[transformedCol];
      return {
        [originalColName]: originalValue,
        [transformedCol]: transformedValue,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const csvOutput = XLSX.utils.sheet_to_csv(worksheet);

    const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.href) {
      URL.revokeObjectURL(link.href);
    }
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', 'transformed_data.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const anyLoading = isProcessing || isAnalyzing || isTransforming;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto py-8 space-y-8">
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
            <Button variant="outline" className="mb-2 flex items-center">
              <Info className="h-4 w-4 mr-2" />
              About Data Transformations
            </Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/30" />
            <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-md bg-white p-10 text-pink-900 shadow-lg">
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

        <Card className="border border-pink-500">
          <CardHeader>
            <CardTitle>
              <Upload className="inline mr-2" size={20} />
              1. Upload Excel Data (.xlsx)
            </CardTitle>
            <CardDescription>
              Start by uploading your worksheet. Only numeric columns will be shown for analysis.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <Input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="flex-1 bg-pink-50" ref={fileInputRef} />
              <Button onClick={processFile} disabled={!file || anyLoading} className="min-w-[120px]">
                {isProcessing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                ) : (
                  'Process File'
                )}
              </Button>
              <Button onClick={handleReset} variant="outline" className="min-w-[120px]">Reset</Button>
            </div>
            {file && <div className="text-sm text-muted-foreground">Selected file: {file.name}</div>}
            {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded">{error}</div>}
          </CardContent>
        </Card>

        {columns.length > 0 && (
          <Card className="border border-pink-500">
            <CardHeader>
              <CardTitle>
                <Info className="inline mr-2" size={20} />
                2. Select Numeric Columns
              </CardTitle>
              <CardDescription>Select one or more numeric columns for normality analysis (only first is analyzed).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {columns.map(col => (
                  <Button
                    key={col}
                    variant={selectedColumns.includes(col) ? "outline" : "ghost"}
                    onClick={() => handleColumnSelect(col)}
                    size="sm"
                  >
                    {selectedColumns.includes(col) && <CheckCircle size={14} className="text-green-500 mr-1" />}
                    {col}
                  </Button>
                ))}
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleAnalyze}
                disabled={selectedColumns.length === 0 || anyLoading}
                className="mt-2"
              >
                {isAnalyzing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</>
                ) : (
                  "Analyze Normality"
                )}
              </Button>
            </CardFooter>
          </Card>
        )}

        {normalityResults.length > 0 && (
          <Card className="border border-pink-500">
            <CardHeader>
              <CardTitle>
                <Info className="inline mr-2" size={20} />
                3. Normality Results & Transformation Recommendation
              </CardTitle>
              <CardDescription>Review analysis and apply recommended transformation.</CardDescription>
            </CardHeader>
            <CardContent>
              <table className="w-full table-auto mt-4 border text-sm">
                <thead>
                  <tr>
                    <th className="border p-2 bg-pink-50 font-medium">Test</th>
                    <th className="border p-2 bg-pink-50 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {normalityResults.length > 0 && Object.entries(normalityResults[0]).map(([key, value]) => (
                    <tr key={key}>
                      <td className="border p-2 font-medium capitalize">{key.replace(/_/g, ' ')}</td>
                      <td className="border p-2">{value}</td>
                    </tr>
                  ))}
                  <tr className="bg-yellow-100">
                    <td className="border p-2 font-medium">Transform</td>
                    <td className="border p-2">
                      {normalityResults.length > 0 && transformRecommendations[normalityResults[0].column] ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTransform(normalityResults[0].column, transformRecommendations[normalityResults[0].column].type)}
                          disabled={anyLoading}
                        >
                          <Replace className="inline mr-1 text-pink-500" size={15} />
                          {transformRecommendations[normalityResults[0].column].type}
                        </Button>
                      ) : '-'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {transformedData.length > 0 && (
          <Card className="border border-pink-500">
            <CardHeader>
              <CardTitle>4. Transformed Data</CardTitle>
              <CardDescription>Comparing original and transformed values.</CardDescription>
            </CardHeader>
            <CardContent>
              <table className="w-full table-auto border text-sm">
                <thead>
                  <tr>
                    <th className="border p-2">{selectedColumns[0]} (Original)</th>
                    <th className="border p-2">{transformedColName} (Transformed)</th>
                  </tr>
                </thead>
                <tbody>
                  {transformedData.map((row, i) => (
                    <tr key={i}>
                      <td className="border p-2">
                        {(() => {
                          const val = rawData[i]?.[selectedColumns[0]];
                          if (val === null || val === undefined || val === '') return '';
                          const num = Number(val);
                          if (isNaN(num)) {
                            return val;
                          }
                          return num.toFixed(4);
                        })()}
                      </td>
                      <td className="border p-2">
                        {row[transformedColName] !== undefined
                          ? (typeof row[transformedColName] === 'number'
                            ? row[transformedColName].toFixed(4)
                            : row[transformedColName])
                          : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
            <CardFooter>
                <div className="mt-4">
                  <Button onClick={handleExport} disabled={transformedData.length === 0}>
                    <Download className="h-4 w-4 mr-2" />
                    Export as CSV
                  </Button>
                </div>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}