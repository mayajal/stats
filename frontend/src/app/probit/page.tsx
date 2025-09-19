"use client";

import { useState, useRef, ReactNode } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FaBug } from "react-icons/fa";
import { Upload } from 'lucide-react';
import Image from 'next/image';
import { IBM_Plex_Sans } from 'next/font/google';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import * as XLSX from 'xlsx';

const ibmPlexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '700'] });

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const RegressionCard = ({ title, details }: { title: string, details: any }) => {
  if (!details) return null;

  let content;
  if (Array.isArray(details)) {
    content = details.map((line, index) => <p key={index}>{line}</p>);
  } else {
    content = (
      <>
        {details.equation && <p>{details.equation}</p>}
        {details.intercept && <p>{details.intercept}</p>}
        {details.slope && <p>{details.slope}</p>}
      </>
    );
  }

  return (
    <div className="bg-gray-100 border border-blue-200 rounded-lg p-4 my-4 text-sm">
      <p className="font-bold">{title}</p>
      <div className="ml-4 mt-2">
        {content}
      </div>
    </div>
  );
};

export default function ProbitPage() {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [dataPreview, setDataPreview] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [doseColumn, setDoseColumn] = useState<string | null>(null);
  const [totalColumn, setTotalColumn] = useState<string | null>(null);
  const [responseColumn, setResponseColumn] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [showFinneySummary, setShowFinneySummary] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const f = e.target.files[0];
      setFile(f);
      setError("");
      setData([]);
      setDataPreview([]);
      setHeaders([]);
      setResults(null);
      setAvailableSheets([]);
      setSelectedSheet("");

      const name = f.name.toLowerCase();
      const isXlsx = name.endsWith('.xlsx') || name.endsWith('.xls');
      if (isXlsx) {
        if (f.size > 1024 * 1024) {
          setError("XLSX file too large. Max allowed size is 1 MB.");
          setFile(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const wb = XLSX.read(new Uint8Array(evt.target?.result as ArrayBuffer), { type: 'array' });
            const sheets = wb.SheetNames || [];
            setAvailableSheets(sheets);
            if (sheets.length > 0) setSelectedSheet(sheets[0]);
            // Prefill headers for preview UI
            if (sheets.length > 0) {
              const sheet = wb.Sheets[sheets[0]];
              const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[];
              const headers = Array.isArray(json[0]) ? (json[0] as any[]).map((h) => String(h).trim()) : [];
              setHeaders(headers);
            }
          } catch (er) {
            setError("Failed to read XLSX file. Ensure it is a valid spreadsheet.");
          }
        };
        reader.readAsArrayBuffer(f);
      } else {
        // CSV: set headers quickly for preview
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result;
          if (typeof text === "string") {
            const rows = text.split("\n");
            const headers = rows[0].split(",").map(h => h.trim());
            setHeaders(headers);
          }
        };
        reader.readAsText(f);
      }
    }
  };

  const handleProcessFile = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }
    const name = file.name.toLowerCase();
    const isXlsx = name.endsWith('.xlsx') || name.endsWith('.xls');
    try {
      if (isXlsx) {
        if (!selectedSheet) {
          setError("Please select a sheet to preview.");
          return;
        }
        const arrayBuffer = await file.arrayBuffer();
        const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
        const sheet = wb.Sheets[selectedSheet];
        if (!sheet) throw new Error("Selected sheet not found");
        const json = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[];
        const preview = json.slice(0, 5);
        setDataPreview(preview);
                setHeaders(Object.keys(json[0] || {}));
      } else {
        const text = await file.text();
        const parsed = text.split("\n").map((row) => row.split(","));
        const headers = parsed[0] || [];
        const body = parsed.slice(1).filter(row => row.join("").trim() !== "");
        const formatted = body.map((row) => {
          const rowData: any = {};
          headers.forEach((header, i) => {
            rowData[String(header).trim()] = row[i];
          });
          return rowData;
        });
        setDataPreview(formatted.slice(0, 5));
        setHeaders(headers.map(h => String(h).trim()))
      }
    } catch (er: any) {
      setError(er.message || "Failed to process file preview");
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      setError("Please upload a file");
      return;
    }

    setLoading(true);
    setError("");

    const name = file.name.toLowerCase();
    const isXlsx = name.endsWith('.xlsx') || name.endsWith('.xls');

    const formData = new FormData();
    if (isXlsx) {
      if (!selectedSheet) {
        setError("Please select a sheet for analysis.");
        setLoading(false);
        return;
      }
      try {
        const arrayBuffer = await file.arrayBuffer();
        const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
        const sheet = wb.Sheets[selectedSheet];
        if (!sheet) throw new Error("Selected sheet not found");
        const csv = XLSX.utils.sheet_to_csv(sheet);
        const blob = new Blob([csv], { type: 'text/csv' });
        const csvFile = new File([blob], 'upload.csv', { type: 'text/csv' });
        formData.append("file", csvFile);
      } catch (er: any) {
        setError(er.message || "Failed to convert selected sheet to CSV");
        setLoading(false);
        return;
      }
    } else {
      formData.append("file", file);
    }

    // Append selected column names to formData
    if (doseColumn) formData.append("dose_column", doseColumn);
    if (totalColumn) formData.append("total_column", totalColumn);
    if (responseColumn) formData.append("response_column", responseColumn);

    try {
      const response = await fetch(process.env.NEXT_PUBLIC_PROBIT_SERVICE_URL || '', {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Analysis failed");
      }


      const resultData = await response.json();
      // If both methods are present, set results as { finney, profile_likelihood }
      if (resultData.finney && resultData.profile_likelihood) {
        setResults(resultData);
      } else {
        // fallback for old response shape
        setResults({ finney: resultData, profile_likelihood: null });
      }

      // Build preview data for display
      if (isXlsx) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
          const sheet = wb.Sheets[selectedSheet];
          if (sheet) {
            const json = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[];
            setData(json);
          }
        } catch {}
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result;
          if (typeof text === "string") {
            const rows = text.split("\n").map((row) => row.split(","));
            const headers = rows[0];
            const body = rows.slice(1).filter(row => row.join("").trim() !== "");
            const formattedData = body.map((row) => {
              const rowData: any = {};
              headers.forEach((header, i) => {
                rowData[header.trim()] = row[i];
              });
              return rowData;
            });
            setData(formattedData);
          }
        };
        reader.readAsText(file);
      }

    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setData([]);
    setDataPreview([]);
    setHeaders([]);
    setResults(null);
    setError("");
    setAvailableSheets([]);
    setSelectedSheet("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const parseSummary = (summary: string[]) => {
    if (!summary) return null;

    let intercept: { coef: string; stdErr: string; } | null = null;
    let slope: { coef: string; stdErr: string; } | null = null;

    const interceptLine = summary.find(line => line.trim().startsWith('const'));
    if (interceptLine) {
      const parts = interceptLine.trim().split(/\s+/);
      intercept = {
        coef: parts[1],
        stdErr: parts[2],
      };
    }

    const slopeLine = summary.find(line => line.trim().startsWith('log_CONC'));
    if (slopeLine) {
      const parts = slopeLine.trim().split(/\s+/);
      slope = {
        coef: parts[1],
        stdErr: parts[2],
      };
    }

    if (intercept && slope) {
      return {
        equation: `y = ${intercept.coef} + ${slope.coef} * x`,
        intercept: `Intercept: ${intercept.coef} (Std Error: ${intercept.stdErr})`,
        slope: `Slope: ${slope.coef} (Std Error: ${slope.stdErr})`,
      };
    }

    return null;
  };


  // Helper to get summary details for a given method's results
  const getSummaryDetails = (methodResults: any) =>
    methodResults ? parseSummary(methodResults.model_summary) : null;

  const finneySummaryDetails = getSummaryDetails(results?.finney);

  // Goodness-of-fit parsing helper
  const renderGoodnessOfFit = (gof: any) => {
    if (!gof) return null;
    // Parse p-value for interpretation
    let pValue = gof["P-value"];
    let pNum = parseFloat(pValue);
    let interpretation = '';
    if (!isNaN(pNum)) {
      if (pNum < 0.05) {
        interpretation = "The chi-squared test is significant (p < 0.05): the observed and predicted values do not agree (lack of fit). It&apos;s not recommended to use this method for your data.";
      } else {
        interpretation = "The chi-squared test is not significant (p ≥ 0.05): the observed and predicted values are considered homogeneous (good fit). This method passes the goodness-of-fit test for your data.";
      }
    }
    return (
      <div className="bg-gray-100 border border-blue-200 rounded-lg p-4 my-4 text-sm">
        <p><b>Goodness-of-fit (Chi-squared test):</b></p>
        <div className="ml-2">
          <div>Chi-Squared: <b>{gof["Chi-Squared"]}</b></div>
          <div>Degrees of Freedom: <b>{gof["Degrees of Freedom"]}</b></div>
          <div>P-value: <b>{gof["P-value"]}</b></div>
        </div>
        {interpretation && (
          <div className="mt-2 text-blue-900"><b>Interpretation:</b> {interpretation}</div>
        )}
      </div>
    );
  };

  const formatLevel = (level: string) => {
    if (level.startsWith('LD')) {
      const number = level.substring(2);
      return <>LD<sub>{number}</sub></>;
    }
    return level;
  };

  return (
    <div className={`min-h-screen bg-background p-4 ${ibmPlexSans.className}`}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <FaBug style={{ height: '2rem', width: '2rem', color: '#2563eb', marginRight: '0.75rem' }} />
            <h1 className="text-3xl font-bold">Probit Analysis</h1>
          </div>
          <p className="text-muted-foreground">
            Perform precise dose-response modeling using both classical Finney and modern Profile Likelihood approaches for comprehensive confidence interval estimation.
          </p>
        </div>

        <Card className="mb-8 border border-blue-200 rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center">
              <span style={{ marginRight: '8px', display: 'inline-flex', alignItems: 'center' }}>
                <Upload size={20} color="#2563eb" />
              </span>
              Upload Data
            </CardTitle>
            <CardDescription>
            Upload a .CSV or .XLSX file (max 1 MB). File should have <b>DOSE</b>, <b>RESPONSE</b>, and <b>TOTAL</b> columns. If control group (DOSE = 0) has RESPONSE counts, corrected mortality will be automatically calculated for non-control groups using Abbott&apos;s formula.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="flex-1 bg-blue-50"
                ref={fileInputRef}
              />
              <Button 
                onClick={handleProcessFile} 
                disabled={!file}
                variant="secondary"
                className="bg-gray-200 text-black-800 font-bold hover:bg-gray-300 border border-gray-300"
              >
                Process File
              </Button>
              <Button 
                onClick={handleReset} 
                variant="outline"
                disabled={!file && data.length === 0 && !results}
                className="min-w-[120px]"
              >
                Reset
              </Button>
            </div>
            {availableSheets.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 font-medium">Select Sheet (XLSX)</label>
                  <select
                    value={selectedSheet}
                    onChange={(e) => setSelectedSheet(e.target.value)}
                    className="block w-full p-2 border border-blue-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    {availableSheets.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="text-sm text-muted-foreground self-end">Max XLSX size: 1 MB</div>
              </div>
            )}
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

        {dataPreview.length > 0 && (
          <Card className="mb-8 border border-blue-200 rounded-lg">
            <CardHeader>
              <CardTitle>Data Preview</CardTitle>
              <CardDescription>Showing the first 5 rows of your data.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-blue-200">
                  <thead className="bg-blue-100">
                    <tr>
                      {headers.map((key) => (
                        <th key={key} className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-200">
                    {dataPreview.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                        {headers.map((key) => (
                          <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row[key]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
            </CardContent>
          </Card>
        )}

        {dataPreview.length > 0 && headers.length > 0 && (
            <Card className="w-full max-w-4xl mt-4">
              <CardHeader>
                <CardTitle>Model Specification</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="dose-column" className="block text-sm font-medium text-gray-700">DOSE Column</label>
                    <Select onValueChange={setDoseColumn} value={doseColumn || ""}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select DOSE column" />
                      </SelectTrigger>
                      <SelectContent>
                        {headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="total-column" className="block text-sm font-medium text-gray-700">TOTAL Column</label>
                    <Select onValueChange={setTotalColumn} value={totalColumn || ""}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select TOTAL column" />
                      </SelectTrigger>
                      <SelectContent>
                        {headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="response-column" className="block text-sm font-medium text-gray-700">RESPONSE Column</label>
                    <Select onValueChange={setResponseColumn} value={responseColumn || ""}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select RESPONSE column" />
                      </SelectTrigger>
                      <SelectContent>
                        {headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-4">
                  <Button 
                    onClick={handleAnalyze} 
                    disabled={!file || loading || !doseColumn || !totalColumn || !responseColumn}
                    variant="secondary"
                    className="bg-gray-200 text-black-800 font-bold hover:bg-gray-300 border border-gray-300 min-w-[120px]"
                  >
                    {loading ? 'Analyzing...' : 'Run Analysis'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

        {results && (
          <Tabs.Root defaultValue="finney" className="mb-8">
            <Tabs.List className="flex border-b border-blue-200 mb-4">
              <Tabs.Trigger value="finney" className="px-4 py-2 font-semibold text-blue-700 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 focus:outline-none cursor-pointer">Finney&apos;s Method</Tabs.Trigger>
              <Tabs.Trigger value="profile" className="px-4 py-2 font-semibold text-blue-700 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 focus:outline-none cursor-pointer">Profile Likelihood Method</Tabs.Trigger>
            </Tabs.List>
            {/* Finney's Method Tab */}
            <Tabs.Content value="finney">
              <Card className="border border-blue-200 rounded-lg">
                <CardHeader>
                  <CardTitle className="text-3xl font-bold">Analysis Results: Finney&apos;s Method</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold">Weighted Least Squares Regression Model Summary</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFinneySummary((prev) => !prev)}
                      className="ml-2"
                    >
                      {showFinneySummary ? "Hide" : "Show"}
                    </Button>
                  </div>
                  {showFinneySummary && (
                    <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap text-sm">{results.finney?.model_summary?.join('\n')}</pre>
                  )}
                  <RegressionCard title="Regression Equation (log10 scale):" details={finneySummaryDetails} />
                  {results.finney?.goodness_of_fit && renderGoodnessOfFit(results.finney.goodness_of_fit)}
                  <h3 className="text-lg font-semibold mt-4 mb-2">Calculated LD values and 95% Confidence Intervals (Fieller&apos;s Theorem):</h3>
                  <div className="overflow-x-auto border border-blue-200 rounded-lg">
                    <table className="min-w-full divide-y divide-blue-200">
                      <thead className="bg-blue-100">
                        <tr>
                          {['Level', 'Estimate', 'Lower CI', 'Upper CI'].map((key) => (
                            <th key={key} className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-blue-200">
                        {results.finney?.ed_values?.Estimate.map((_: any, i: number) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                            {['Level', 'Estimate', 'Lower CI', 'Upper CI'].map((key) => (
                              <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {key === 'Level' ? formatLevel(results.finney.ed_values[key][i]) : results.finney.ed_values[key][i]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {results.finney?.plot && (
                    <div className="mt-8">
                      <h3 className="text-lg font-semibold mb-2">Probit Analysis Plot</h3>
                      <Image
                        src={`data:image/png;base64,${results.finney.plot}`}
                        alt="Probit Analysis Plot"
                        width={600}
                        height={450}
                        className="h-auto"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </Tabs.Content>
            {/* Profile Likelihood MethodTab */}
            <Tabs.Content value="profile">
              <Card className="border border-blue-200 rounded-lg">
                <CardHeader>
                  <CardTitle className="text-3xl font-bold">Analysis Results: Profile Likelihood Method</CardTitle>
                </CardHeader>
                <CardContent>
                  {results.profile_likelihood ? (
                    <>
                      <h3 className="text-lg font-semibold mb-2">Profile Likelihood Regression Model Summary</h3>
                      <RegressionCard title="Regression Equation (log10 scale):" details={results.profile_likelihood.model_summary} />
                      {results.profile_likelihood.goodness_of_fit && renderGoodnessOfFit(results.profile_likelihood.goodness_of_fit)}
                      <h3 className="text-lg font-semibold mt-4 mb-2">Calculated LD values and 95% Confidence Intervals (Profile Likelihood):</h3>
                      <div className="overflow-x-auto border border-blue-200 rounded-lg">
                        <table className="min-w-full divide-y divide-blue-200">
                          <thead className="bg-blue-100">
                            <tr>
                              {['Level', 'Estimate', 'Lower CI', 'Upper CI'].map((key) => (
                                <th key={key} className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">{key}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-blue-200">
                            {results.profile_likelihood.ed_values?.Estimate.map((_: any, i: number) => (
                              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                                {['Level', 'Estimate', 'Lower CI', 'Upper CI'].map((key) => (
                                  <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {key === 'Level' ? formatLevel(results.profile_likelihood.ed_values[key][i]) : results.profile_likelihood.ed_values[key][i]}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {results.profile_likelihood.plot && (
                        <div className="mt-8">
                          <h3 className="text-lg font-semibold mb-2">Probit Analysis Plot</h3>
                          <Image
                            src={`data:image/png;base64,${results.profile_likelihood.plot}`}
                            alt="Profile Likelihood Probit Analysis Plot"
                            width={600}
                            height={450}
                            className="h-auto"
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-gray-500">Profile Likelihood results will be displayed here.</div>
                  )}
                </CardContent>
              </Card>
            </Tabs.Content>
          </Tabs.Root>
        )}
      </div>
    </div>
  );
}
