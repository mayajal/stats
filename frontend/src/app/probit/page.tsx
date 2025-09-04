"use client";

import { useState, useRef } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FaBug, FaUpload } from "react-icons/fa";
import Image from 'next/image';
import { IBM_Plex_Sans } from 'next/font/google';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

const ibmPlexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '700'] });

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function ProbitPage() {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setError("");
      setData([]);
      setResults(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      setError("Please upload a file");
      return;
    }

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

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

    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setData([]);
    setResults(null);
    setError("");
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

  // Goodness-of-fit parsing helper
  const renderGoodnessOfFit = (gof: any) => {
    if (!gof) return null;
    // Parse p-value for interpretation
    let pValue = gof["P-value"];
    let pNum = parseFloat(pValue);
    let interpretation = '';
    if (!isNaN(pNum)) {
      if (pNum < 0.05) {
        interpretation = "The chi-squared test is significant (p < 0.05): the observed and predicted values do not agree (lack of fit). It's not recommended to use this method for your data.";
      } else {
        interpretation = "The chi-squared test is not significant (p ≥ 0.05): the observed and predicted values are considered homogeneous (good fit). Choose this method that passes the goodness-of-fit test for your data.";
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
                <FaUpload size={20} color="#2563eb" />
              </span>
              Upload .CSV File
            </CardTitle>
            <CardDescription>
              The .csv file should have columns named exactly <b>DOSE</b>, <b>TOTAL</b>, and <b>RESPONSE</b>. If control group (DOSE = 0) has RESPONSE counts, corrected mortality is automatically calculated for non-control groups using Abbott's formula.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="flex-1 bg-blue-50"
                ref={fileInputRef}
              />
              <Button 
                onClick={handleAnalyze} 
                disabled={!file || loading}
                className="min-w-[120px]"
              >
                {loading ? 'Analyzing...' : 'Analyze'}
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

        {data.length > 0 && (
          <Card className="mb-8 border border-blue-200 rounded-lg">
            <CardHeader>
              <CardTitle>Uploaded Data</CardTitle>
              <CardDescription>The data from your uploaded file.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-blue-200">
                  <thead className="bg-blue-100">
                    <tr>
                      {Object.keys(data[0]).map((key) => (
                        <th key={key} className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-200">
                    {data.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                        {Object.values(row).map((value: any, j: number) => (
                          <td key={j} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{value}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {results && (
          <Tabs.Root defaultValue="finney" className="mb-8">
            <Tabs.List className="flex border-b border-blue-200 mb-4">
              <Tabs.Trigger value="finney" className="px-4 py-2 font-semibold text-blue-700 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 focus:outline-none cursor-pointer">Finney's Method</Tabs.Trigger>
              <Tabs.Trigger value="profile" className="px-4 py-2 font-semibold text-blue-700 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 focus:outline-none cursor-pointer">Profile Likelihood Method</Tabs.Trigger>
            </Tabs.List>
            {/* Finney's Method Tab */}
            <Tabs.Content value="finney">
              <Card className="border border-blue-200 rounded-lg">
                <CardHeader>
                  <CardTitle>Analysis Results: Finney's Method</CardTitle>
                </CardHeader>
                <CardContent>
                  <h3 className="text-lg font-semibold mb-2">Weighted Least Squares Regression Model Summary</h3>
                  <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">{results.finney?.model_summary?.join('\n')}</pre>
                  {getSummaryDetails(results.finney) && (
                    <div className="bg-gray-100 border border-blue-200 rounded-lg p-4 my-4 text-sm">
                      <p><b>Regression Equation (log10 scale):</b> {getSummaryDetails(results.finney).equation}</p>
                      <p>{getSummaryDetails(results.finney).intercept}</p>
                      <p>{getSummaryDetails(results.finney).slope}</p>
                    </div>
                  )}
                  {results.finney?.goodness_of_fit && renderGoodnessOfFit(results.finney.goodness_of_fit)}
                  <h3 className="text-lg font-semibold mt-4 mb-2">Calculated LD values and 95% Confidence Intervals (Fieller's Theorem):</h3>
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
                  <CardTitle>Analysis Results: Profile Likelihood Method</CardTitle>
                </CardHeader>
                <CardContent>
                  {results.profile_likelihood ? (
                    <>
                      <h3 className="text-lg font-semibold mb-2">Profile Likelihood Regression Model Summary</h3>
                      <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">{results.profile_likelihood.model_summary?.join('\n')}</pre>
                      {getSummaryDetails(results.profile_likelihood) && (
                        <div className="bg-gray-100 border border-blue-200 rounded-lg p-4 my-4 text-sm">
                          <p><b>Regression Equation (log10 scale):</b> {getSummaryDetails(results.profile_likelihood).equation}</p>
                          <p>{getSummaryDetails(results.profile_likelihood).intercept}</p>
                          <p>{getSummaryDetails(results.profile_likelihood).slope}</p>
                        </div>
                      )}
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