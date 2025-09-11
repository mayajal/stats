"use client";

import { useState, useRef } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Upload } from 'lucide-react';
import { FaAsterisk, FaInfoCircle } from "react-icons/fa";
import * as XLSX from 'xlsx';

const InfoIcon = ({ text }: { text: string }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative inline-block ml-2">
      <FaInfoCircle
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="cursor-pointer text-gray-400"
      />
      {showTooltip && (
        <div className="absolute bottom-full mb-2 w-64 bg-gray-800 text-white text-xs rounded py-1 px-2 z-10">
          {text}
        </div>
      )}
    </div>
  );
};
import Image from 'next/image';
import { IBM_Plex_Sans } from 'next/font/google';

const ibmPlexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '700'] });

const TextualSummary = ({ summary }: { summary: string[] }) => {
  if (!summary || summary.length === 0) return null;

  return (
    <div className="my-4">
      <h3 className="text-lg font-semibold mb-2">Summary of Findings</h3>
      <div className="bg-gray-100 border border-blue-200 rounded-lg p-4 text-sm space-y-2">
        {summary.map((line, index) => (
          <p key={index}>{line}</p>
        ))}
      </div>
    </div>
  );
};

const EventTable = ({ title, data }: { title: string, data: any }) => {
  if (!data) return null;

  const headers = Object.keys(data);
  const numRows = data[headers[0]].length;
  const rows = Array.from({ length: numRows }, (_, i) => i);

  return (
    <div className="my-4">
      <h4 className="text-md font-semibold mb-2">Event Table for Group: {title}</h4>
      <div className="overflow-x-auto border border-blue-200 rounded-lg max-h-60">
        <table className="min-w-full divide-y divide-blue-200">
          <thead className="bg-blue-100 sticky top-0">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">{header.replace(/_/g, ' ')}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-200">
            {rows.map((rowIndex) => (
              <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                {headers.map((header) => (
                  <td key={`${header}-${rowIndex}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {data[header][rowIndex]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const MedianSurvivalTime = ({ data }: { data: any }) => {
  if (!data) return null;

  return (
    <div className="my-4">
      <h3 className="text-lg font-semibold mb-2">Median Survival Time</h3>
      <div className="overflow-x-auto border border-blue-200 rounded-lg">
        <table className="min-w-full divide-y divide-blue-200">
          <thead className="bg-blue-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">Group</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">Median Survival Time</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-blue-200">
            {Object.entries(data).map(([group, time]) => (
              <tr key={group}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{group}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{time === Infinity ? 'Not Reached' : String(time)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const HazardRatioInterpretation = ({ data, referenceGroup }: { data: any, referenceGroup: string }) => {
  if (!data || !data['exp(coef)']) return null;

  const covariates = Object.keys(data['exp(coef)']);

  return (
    <div className="my-4">
      <h3 className="text-lg font-semibold mb-2">Hazard Ratio Interpretation</h3>
      {referenceGroup && (
        <p className="text-sm text-gray-600 mb-2">
          <b>Note:</b> The interpretations are relative to the reference group (<b>{referenceGroup}</b>).
        </p>
      )}
      {covariates.map((covariate) => {
        const hazardRatio = data['exp(coef)'][covariate];
        const lowerCI = data['exp(coef) lower 95%'][covariate];
        const upperCI = data['exp(coef) upper 95%'][covariate];
        const pValue = data['p'][covariate];

        let interpretation = '';
        if (pValue < 0.05) {
          interpretation += 'The result is statistically significant (p < 0.05). ';
          if (hazardRatio > 1) {
            interpretation += `This suggests an increased risk (hazard ratio = ${hazardRatio.toFixed(2)}).`;
          } else {
            interpretation += `This suggests a decreased risk (hazard ratio = ${hazardRatio.toFixed(2)}).`;
          }
        } else {
          interpretation += 'The result is not statistically significant (p >= 0.05). ';
          if (lowerCI < 1 && upperCI > 1) {
            interpretation += 'The confidence interval includes 1, which is consistent with the non-significant result.';
          }
        }

        return (
          <div key={covariate} className="bg-gray-100 border border-blue-200 rounded-lg p-4 my-2 text-sm">
            <p className="font-bold">{covariate}</p>
            <div className="ml-4 mt-2">
              <p><b>Hazard Ratio:</b> {hazardRatio.toFixed(4)}</p>
              <p><b>95% Confidence Interval:</b> [{lowerCI.toFixed(4)}, {upperCI.toFixed(4)}]</p>
              <p><b>P-value:</b> {pValue.toFixed(4)}</p>
              <div className="mt-2 text-blue-900">
                <b>Interpretation:</b> {interpretation}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const SummaryTable = ({ title, data }: { title: string, data: any }) => {
  if (!data) return null;

  const headers = Object.keys(data);
  const firstColumn = headers[0];
  const numRows = data[firstColumn] ? Object.keys(data[firstColumn]).length : 0;
  const rows = Array.from({ length: numRows }, (_, i) => i);

  return (
    <div className="my-4">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <div className="overflow-x-auto border border-blue-200 rounded-lg">
        <table className="min-w-full divide-y divide-blue-200">
          <thead className="bg-blue-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">Covariate</th>
              {headers.map((header) => (
                <th key={header} className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-200">
            {rows.map((rowIndex) => (
              <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">{Object.keys(data[firstColumn])[rowIndex]}</td>
                {headers.map((header) => (
                  <td key={`${header}-${rowIndex}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {typeof data[header][Object.keys(data[header])[rowIndex]] === 'number'
                      ? data[header][Object.keys(data[header])[rowIndex]].toFixed(4)
                      : data[header][Object.keys(data[header])[rowIndex]]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default function SurvivalPage() {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [columnHeaders, setColumnHeaders] = useState<string[]>([]);
  const [selectedCovariates, setSelectedCovariates] = useState<string[]>([]);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");

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
        setData(json.slice(0, 5));
      } else {
        const text = await file.text();
        const rows = text.split("\n").map((r) => r.split(","));
        const headers = rows[0] || [];
        const body = rows.slice(1).filter(r => r.join("").trim() !== "");
        const formatted = body.map((row) => {
          const rowData: any = {};
          headers.forEach((h, i) => {
            rowData[String(h).trim()] = row[i];
          });
          return rowData;
        });
        setData(formatted.slice(0, 5));
      }
    } catch (er: any) {
      setError(er.message || "Failed to process file preview");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const file = e.target.files[0];
      setFile(file);
      setError("");
      setData([]);
      setResults(null);
      setSelectedCovariates([]); // Reset covariates on new file
      setAvailableSheets([]);
      setSelectedSheet("");

      const name = file.name.toLowerCase();
      const isXlsx = name.endsWith('.xlsx') || name.endsWith('.xls');
      if (isXlsx) {
        if (file.size > 1024 * 1024) {
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
            const defaultSheet = sheets[0] || "";
            setSelectedSheet(defaultSheet);
            if (defaultSheet) {
              const sheet = wb.Sheets[defaultSheet];
              const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[];
              const headers = Array.isArray(json[0]) ? (json[0] as any[]).map((h) => String(h).trim()) : [];
              setColumnHeaders(headers);
            } else {
              setColumnHeaders([]);
            }
          } catch (er) {
            setError("Failed to read XLSX file. Ensure it is a valid spreadsheet.");
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result;
          if (typeof text === "string") {
            const rows = text.split("\n");
            const headers = rows[0].split(",").map(h => h.trim());
            setColumnHeaders(headers);
          } else {
            setColumnHeaders([]);
          }
        };
        reader.readAsText(file);
      }

    }
  };

  const handleSheetChange = async (sheetName: string) => {
    setSelectedSheet(sheetName);
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
      const sheet = wb.Sheets[sheetName];
      if (sheet) {
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[];
        const headers = Array.isArray(json[0]) ? (json[0] as any[]).map((h) => String(h).trim()) : [];
        setColumnHeaders(headers);
      } else {
        setColumnHeaders([]);
      }
    } catch {
      // ignore
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
    selectedCovariates.forEach(cov => formData.append('covariates[]', cov));

    try {
      const response = await fetch(process.env.NEXT_PUBLIC_SURVIVAL_SERVICE_URL || '', {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Analysis failed");
      }

      const resultData = await response.json();
      setResults(resultData);

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
    setColumnHeaders([]);
    setSelectedCovariates([]);
    setAvailableSheets([]);
    setSelectedSheet("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className={`min-h-screen bg-background p-4 ${ibmPlexSans.className}`}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <FaAsterisk style={{ height: '2rem', width: '2rem', color: "#ef4444", marginRight: '0.75rem' }} />
            <h1 className="text-3xl font-bold">Survival Analysis</h1>
          </div>
          <p className="text-muted-foreground">
            Analyze time-to-event data using Kaplan-Meier curves and Cox Proportional Hazards models. 
            These are a set of statistical tools for estimating the time it takes for an event of interest to happen. This &apos;event&apos; can be anything from the death of insects or plants, lifespan of a patient to the failure of a mechanical part.
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
              Upload a .CSV or .XLSX file (max 1 MB). Files should have columns named exactly as <b>TIME</b>, <b>EVENT</b>, and <b>GROUP</b>. Covariates can be optionally included in additional columns for Cox regression.
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
                    onChange={(e) => handleSheetChange(e.target.value)}
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

            {columnHeaders.length > 0 && (
              <div className="my-4">
                <h4 className="text-md font-semibold mb-2">Select Covariates for Cox Regression</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {columnHeaders.filter(h => !['TIME', 'EVENT', 'GROUP'].includes(h)).map(header => (
                    <div key={header} className="flex items-center">
                      <input
                        type="checkbox"
                        id={header}
                        value={header}
                        checked={selectedCovariates.includes(header)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCovariates([...selectedCovariates, header]);
                          } else {
                            setSelectedCovariates(selectedCovariates.filter(c => c !== header));
                          }
                        }}
                        className="mr-2"
                      />
                      <label htmlFor={header}>{header}</label>
                    </div>
                  ))}
                </div>
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
              <CardTitle>Data Preview</CardTitle>
              <CardDescription>Showing the first 5 rows of your data.</CardDescription>
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
              <div className="mt-4">
                <Button 
                  onClick={handleAnalyze} 
                  disabled={!file || loading}
                  className="min-w-[120px]"
                >
                  {loading ? 'Analyzing...' : 'Analyze'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {results && (
          <Tabs.Root defaultValue="kaplan-meier" className="mb-8">
            <Tabs.List className="flex border-b border-blue-200 mb-4">
              <Tabs.Trigger value="kaplan-meier" className="px-4 py-2 font-semibold text-blue-700 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 focus:outline-none cursor-pointer">Kaplan-Meier</Tabs.Trigger>
              <Tabs.Trigger value="cox-regression" className="px-4 py-2 font-semibold text-blue-700 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 focus:outline-none cursor-pointer">Cox Regression</Tabs.Trigger>
            </Tabs.List>
            
            <Tabs.Content value="kaplan-meier">
              <Card className="border border-blue-200 rounded-lg">
                <CardHeader>
                  <CardTitle className="text-3xl font-bold">Kaplan-Meier Survival Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  {results.kaplan_meier?.plot && (
                    <div className="mt-8">
                      <h3 className="text-lg font-semibold mb-2">Kaplan-Meier Survival Curves</h3>
                      <Image
                        src={`data:image/png;base64,${results.kaplan_meier.plot}`}
                        alt="Kaplan-Meier Plot"
                        width={600}
                        height={450}
                        className="h-auto"
                      />
                    </div>
                  )}
                  {results.kaplan_meier?.median_survival_times && <MedianSurvivalTime data={results.kaplan_meier.median_survival_times} />}
                  {results.kaplan_meier?.event_tables && Object.entries(results.kaplan_meier.event_tables).map(([group, table]) => (
                    <EventTable key={group} title={group} data={table} />
                  ))}
                </CardContent>
              </Card>
            </Tabs.Content>
            
            <Tabs.Content value="cox-regression">
              <Card className="border border-blue-200 rounded-lg">
                <CardHeader>
                  <CardTitle className="text-3xl font-bold">Cox Proportional Hazards Regression</CardTitle>
                </CardHeader>
                <CardContent>
                  {results.cox_regression ? (
                    <>
                      <TextualSummary summary={results.cox_regression.textual_summary} />
                      <SummaryTable title="Cox Regression Summary" data={results.cox_regression.summary} />
                      <HazardRatioInterpretation data={results.cox_regression.summary} referenceGroup={results.cox_regression.reference_group} />

                      
                      <div className="flex flex-wrap -mx-2">
                        <div className="w-full md:w-1/2 px-2">
                          {results.cox_regression.adjusted_survival_plot && (
                            <div className="mt-8">
                              <h3 className="text-lg font-normal mb-2 inline-flex items-center">
                                Adjusted Survival Curves
                                <InfoIcon text="This plot shows the probability that an individual will survive past a certain point in time. The curve starts at 1 (100% survival) and decreases over time as events (e.g., deaths) occur. It answers the question: &apos;What is the chance of surviving longer than time t?&apos;" />
                              </h3>
                              <Image
                                src={`data:image/png;base64,${results.cox_regression.adjusted_survival_plot}`}
                                alt="Adjusted Survival Curves Plot"
                                width={600}
                                height={450}
                                className="h-auto"
                              />
                            </div>
                          )}
                        </div>
                        <div className="w-full md:w-1/2 px-2">
                          {results.cox_regression.cumulative_hazard_plot && (
                            <div className="mt-8">
                              <h3 className="text-lg font-normal mb-2 inline-flex items-center">
                                Cumulative Hazard by Group
                                <InfoIcon text="This plot shows the accumulated risk of an event occurring up to a certain point in time. It starts at 0 and increases over time. A steeper slope on this curve indicates a higher risk of the event happening during that period. It answers the question: &apos;What is the total accumulated risk of the event happening by time t?&apos;" />
                              </h3>
                              <Image
                                src={`data:image/png;base64,${results.cox_regression.cumulative_hazard_plot}`}
                                alt="Cumulative Hazard Plot"
                                width={600}
                                height={450}
                                className="h-auto"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-gray-500">Cox Regression results will be displayed here.</div>
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