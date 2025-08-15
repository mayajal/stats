'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Upload, BarChart3 } from "lucide-react";
import * as XLSX from 'xlsx';
import { Bar } from 'react-chartjs-2';
//import { kolmogorovSmirnov } from 'ml-kolmogorov-smirnov';
import { Chart, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, LineController } from 'chart.js';
import Link from 'next/link';

Chart.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, LineController);

interface DescriptiveStats {
  mean: number;
  median: number;
  mode: number | string;
  variance: number;
  standardDeviation: number;
  count: number;
  min: number;
  max: number;
}

// Utility: CDF for normal distribution
function normalCDF(x: number, mean: number, std: number) {
  return 0.5 * (1 + erf((x - mean) / (std * Math.sqrt(2))));
}

// Utility: Kolmogorov-Smirnov test (returns D statistic and p-value approximation)
function ksTest(sample: number[]) {
  const n = sample.length;
  const sorted = [...sample].sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / n);

  let d = 0;
  for (let i = 0; i < n; i++) {
    const F_emp = (i + 1) / n;
    const F_theo = normalCDF(sorted[i], mean, std);
    d = Math.max(d, Math.abs(F_emp - F_theo));
  }
  // p-value approximation for large n
  const pValue = Math.exp(-2 * n * d * d);
  return { d, pValue };
}

// Utility: Levene's test for heterogeneity of variance
function leveneTest(values: number[], groups: string[]): { W: number, pValue: number } | null {
  if (!values.length || !groups.length || values.length !== groups.length) return null;
  const groupMap: { [key: string]: number[] } = {};
  values.forEach((v, i) => {
    if (!groupMap[groups[i]]) groupMap[groups[i]] = [];
    groupMap[groups[i]].push(v);
  });
  const groupNames = Object.keys(groupMap);
  if (groupNames.length < 2) return null;

  // Calculate group medians
  const medians = groupNames.map(name => {
    const arr = groupMap[name].slice().sort((a, b) => a - b);
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
  });

  // Calculate absolute deviations from group medians
  const absDevs: number[] = [];
  const absDevsGroups: string[] = [];
  groupNames.forEach((name, idx) => {
    groupMap[name].forEach(v => {
      absDevs.push(Math.abs(v - medians[idx]));
      absDevsGroups.push(name);
    });
  });

  // ANOVA on absDevs
  const overallMean = absDevs.reduce((a, b) => a + b, 0) / absDevs.length;
  const groupMeans = groupNames.map(name => {
    const arr = absDevs.filter((_, i) => absDevsGroups[i] === name);
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  });
  const n = absDevs.length;
  const k = groupNames.length;
  const ssBetween = groupNames.reduce((sum, name, idx) => {
    const arr = absDevs.filter((_, i) => absDevsGroups[i] === name);
    return sum + arr.length * (groupMeans[idx] - overallMean) ** 2;
  }, 0);
  const ssWithin = absDevs.reduce((sum, val, i) => {
    const groupIdx = groupNames.indexOf(absDevsGroups[i]);
    return sum + (val - groupMeans[groupIdx]) ** 2;
  }, 0);
  const msBetween = ssBetween / (k - 1);
  const msWithin = ssWithin / (n - k);
  const W = msBetween / msWithin;

  // p-value approximation (F-distribution)
  // For simplicity, we just return W; for real p-value, use a stats library or table
  return { W, pValue: NaN };
}

// Approximate the error function (erf)
function erf(x: number): number {
  // Abramowitz and Stegun formula 7.1.26
  // with maximal error of 1.5 × 10−7
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);

  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

export default function AnalysisPage() {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [stats, setStats] = useState<DescriptiveStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [numericColumn, setNumericColumn] = useState<string | null>(null);
  const [groupColumn, setGroupColumn] = useState<string | null>(null);

  // New state for UI flow
  const [showStats, setShowStats] = useState(false);
  const [showHistogram, setShowHistogram] = useState(false);
  const [ksResult, setKsResult] = useState<{ d: number, pValue: number } | null>(null);
  const [leveneResult, setLeveneResult] = useState<{ W: number, pValue: number } | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setError('');
      setData([]);
      setStats(null);
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
      setError("Error processing file. Please ensure it&apos;s a valid Excel file.");
    } finally {
      setLoading(false);
    }
  };

  const calculateDescriptiveStats = () => {
    if (data.length === 0) {
      setError('Please upload and process a file first');
      return;
    }

    // Get the first numeric column
    const firstRow = data[0];
    const numericColumns = Object.keys(firstRow).filter(key => {
      const value = firstRow[key];
      return typeof value === 'number' && !isNaN(value);
    });

    if (numericColumns.length === 0) {
      setError('No numeric columns found in the data');
      return;
    }

    const columnName = numericColumns[0];
    const values = data.map(row => row[columnName]).filter(val => typeof val === 'number' && !isNaN(val));

    if (values.length === 0) {
      setError('No valid numeric data found');
      return;
    }

    // Calculate statistics
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    const sortedValues = [...values].sort((a, b) => a - b);
    const median = sortedValues.length % 2 === 0 
      ? (sortedValues[sortedValues.length / 2 - 1] + sortedValues[sortedValues.length / 2]) / 2
      : sortedValues[Math.floor(sortedValues.length / 2)];

    // Calculate mode
    const frequency: { [key: number]: number } = {};
    values.forEach(val => {
      frequency[val] = (frequency[val] || 0) + 1;
    });
    const maxFreq = Math.max(...Object.values(frequency));
    const mode = Object.keys(frequency).filter(key => frequency[Number(key)] === maxFreq)[0];

    // Calculate variance and standard deviation
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);

    setStats({
      mean: Number(mean.toFixed(4)),
      median: Number(median.toFixed(4)),
      mode: Number(mode),
      variance: Number(variance.toFixed(4)),
      standardDeviation: Number(standardDeviation.toFixed(4)),
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values)
    });
  };

  // Handler for descriptive stats
  const handleDescriptiveStats = () => {
    if (!numericColumn) return;
    const values = data
      .map(row => row[numericColumn])
      .filter((v: any) => typeof v === 'number' && !isNaN(v));
    if (!values.length) return;

    // Calculate statistics
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const sortedValues = [...values].sort((a, b) => a - b);
    const median = sortedValues.length % 2 === 0 
      ? (sortedValues[sortedValues.length / 2 - 1] + sortedValues[sortedValues.length / 2]) / 2
      : sortedValues[Math.floor(sortedValues.length / 2)];
    const frequency: { [key: number]: number } = {};
    values.forEach(val => {
      frequency[val] = (frequency[val] || 0) + 1;
    });
    const maxFreq = Math.max(...Object.values(frequency));
    const mode = Object.keys(frequency).filter(key => frequency[Number(key)] === maxFreq)[0];
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);

    setStats({
      mean: Number(mean.toFixed(4)),
      median: Number(median.toFixed(4)),
      mode: Number(mode),
      variance: Number(variance.toFixed(4)),
      standardDeviation: Number(standardDeviation.toFixed(4)),
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values)
    });
    setShowStats(true);
  };

  // Handler for KS test
  const handleKSTest = () => {
    if (!numericColumn) return;
    const values = data
      .map(row => row[numericColumn])
      .filter((v: any) => typeof v === 'number' && !isNaN(v));
    if (!values.length) return;
    setKsResult(ksTest(values));
  };

  // Handler for Levene's test
  const handleLeveneTest = () => {
    if (!numericColumn || !groupColumn) return;
    const values = data
      .map(row => row[numericColumn])
      .filter((v: any) => typeof v === 'number' && !isNaN(v));
    const groups = data.map(row => row[groupColumn]);
    if (!values.length || !groups.length) return;
    setLeveneResult(leveneTest(values, groups));
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <BarChart3 className="h-8 w-8 text-green-600 mr-3" />
            <h1 className="text-3xl font-bold">Statistical Analysis</h1>
          </div>
          <p className="text-muted-foreground">
            Upload your Excel file and perform descriptive statistical analysis. 
            Check for normality, heterogeneity, and descriptive statistics.
          </p>
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

        {/* Column selection - only after data is uploaded */}
        {data.length > 0 && (
          <Card className="mb-6 mt-8">
            <CardHeader>
              <CardTitle>Select Columns for Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4">
                <div>
                  <label className="block mb-1 font-medium">Numeric Column</label>
                  <select
                    className="border rounded px-2 py-1"
                    value={numericColumn ?? ''}
                    onChange={e => setNumericColumn(e.target.value)}
                  >
                    <option value="">Select column</option>
                    {Object.keys(data[0] || {}).filter(
                      key => typeof data[0][key] === 'number'
                    ).map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 font-medium">Grouping Column (for heterogeneity)</label>
                  <select
                    className="border rounded px-2 py-1"
                    value={groupColumn ?? ''}
                    onChange={e => setGroupColumn(e.target.value)}
                  >
                    <option value="">None</option>
                    {Object.keys(data[0] || {}).filter(
                      key => typeof data[0][key] === 'string'
                    ).map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Grouped Test Buttons */}
        {numericColumn && (
          <div className="flex flex-wrap gap-6 mb-6 mt-4">
            <Button onClick={handleDescriptiveStats}>Descriptive Statistics</Button>
            <Button onClick={() => setShowHistogram(true)}>Show Distribution</Button>
            <Button onClick={handleKSTest}>Normality Test (KS)</Button>
            {groupColumn && (
              <Button onClick={handleLeveneTest}>Heterogeneity Test (Levene&apos;s)</Button>
            )}
          </div>
        )}

        {/* Descriptive Statistics Table */}
        {showStats && stats && (
          <Card>
            <CardHeader>
              <CardTitle>Descriptive Statistics Results</CardTitle>
              <CardDescription>
                Statistical summary of your data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-4 py-2 text-left font-medium">Statistic</th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2">Count</td>
                      <td className="border border-gray-300 px-4 py-2">{stats.count}</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2">Mean</td>
                      <td className="border border-gray-300 px-4 py-2">{stats.mean}</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2">Median</td>
                      <td className="border border-gray-300 px-4 py-2">{stats.median}</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2">Mode</td>
                      <td className="border border-gray-300 px-4 py-2">{stats.mode}</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2">Variance</td>
                      <td className="border border-gray-300 px-4 py-2">{stats.variance}</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2">Standard Deviation</td>
                      <td className="border border-gray-300 px-4 py-2">{stats.standardDeviation}</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2">Minimum</td>
                      <td className="border border-gray-300 px-4 py-2">{stats.min}</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2">Maximum</td>
                      <td className="border border-gray-300 px-4 py-2">{stats.max}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Histogram */}
        {showHistogram && numericColumn && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Distribution (Histogram)</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const values = data
                  .map(row => row[numericColumn])
                  .filter((v: any) => typeof v === 'number' && !isNaN(v));
                if (!values.length) return <div>No numeric data available.</div>;
                const binCount = 10;
                const min = Math.min(...values);
                const max = Math.max(...values);
                const binSize = (max - min) / binCount;
                const bins = Array(binCount).fill(0);
                values.forEach(val => {
                  let idx = Math.floor((val - min) / binSize);
                  if (idx === binCount) idx--;
                  bins[idx]++;
                });
                const labels = bins.map((_, i) =>
                  `${(min + i * binSize).toFixed(2)} - ${(min + (i + 1) * binSize).toFixed(2)}`
                );
                return (
                  <Bar
                    data={{
                      labels,
                      datasets: [{
                        label: 'Frequency',
                        data: bins,
                        backgroundColor: 'rgba(54, 162, 235, 0.5)',
                      }]
                    }}
                  />
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* KS Test Result */}
        {ksResult && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Normality Test (Kolmogorov-Smirnov)</CardTitle>
            </CardHeader>
            <CardContent>
              <div>KS Statistic: {ksResult.d.toFixed(4)}</div>
              <div>p-value: {ksResult.pValue.toExponential(2)}</div>
              <div>
                {ksResult.pValue < 0.05
                  ? "Data is likely not normal (reject H₀ at 0.05)"
                  : "Data is likely normal (fail to reject H₀ at 0.05)"}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Levene's Test Result */}
        {leveneResult && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Heterogeneity of Variance (Levene&apos;s Test)</CardTitle>
            </CardHeader>
            <CardContent>
              <div>Levene&apos;s W: {leveneResult.W.toFixed(4)}</div>
              <div>
                {leveneResult.pValue !== undefined && !isNaN(leveneResult.pValue)
                  ? `p-value: ${leveneResult.pValue.toExponential(2)}`
                  : "p-value: (approximation not implemented)"}
              </div>
              <div>
                {leveneResult.W > 1
                  ? "Variances are likely heterogeneous"
                  : "Variances are likely homogeneous"}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
