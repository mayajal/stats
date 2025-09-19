/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Upload } from 'lucide-react';
import { FaMapMarkedAlt } from "react-icons/fa";
import { parse } from 'papaparse';
import * as XLSX from 'xlsx';

interface ResultsDisplayProps {
    results: any;
    loading: boolean;
    error: string;
}

const MoranInterpretation = ({ moranI, pValue }: { moranI: number, pValue: number }) => {
    let interpretationText;
    if (moranI > 0) {
        interpretationText = "positive spatial autocorrelation (similar values cluster together).";
    } else if (moranI < 0) {
        interpretationText = "negative spatial autocorrelation (neighboring values are dissimilar).";
    } else {
        interpretationText = "no discernible pattern (spatial randomness).";
    }

    let significanceText;
    if (pValue < 0.05) {
        significanceText = "The observed spatial pattern is statistically significant and is unlikely to be due to random chance.";
    } else {
        significanceText = "The observed spatial pattern is not statistically significant, so randomness cannot be ruled out.";
    }

    return (
        <div className="mt-4 text-sm text-gray-700">
            <p><b>Interpretation of Moran&apos;s I:</b></p>
            <ul className="list-disc list-inside">
                <li>Values close to +1 indicate strong positive spatial autocorrelation (similar values cluster together).</li>
                <li>Near 0 means spatial randomness (no discernible pattern).</li>
                <li>Close to -1 signals negative spatial autocorrelation (neighboring values are dissimilar).</li>
            </ul>
            <p className="mt-2">Based on the calculated Moran&apos;s I value of <b>{moranI.toFixed(4)}</b>, the data exhibits {interpretationText}</p>
            <p className="mt-2"><b>Significance (p-value):</b> A p-value less than 0.05 is typically considered statistically significant. With a p-value of <b>{pValue.toFixed(4)}</b>, {significanceText}</p>
        </div>
    );
};

const LISAInterpretationCard = () => {
    return (
        <Card className="mt-6 !border border-[#34d399] rounded-lg">
            <CardHeader>
                <CardTitle>Interpreting LISA Cluster Maps</CardTitle>
            </CardHeader>
            <CardContent>
                <p>LISA (Local Indicators of Spatial Association) shows local clusters and spatial outliers for each region or point.</p>
                <p className="mt-2">LISA clusters are color-coded:</p>
                <ul className="list-disc list-inside">
                    <li><b>High-High (red):</b> Region with high values and neighboring high values—a significant hot spot.</li>
                    <li><b>Low-Low (orange):</b> Low value with neighboring low values—cold spot.</li>
                    <li><b>High-Low (purple):</b> High value with neighboring low values—outlier.</li>
                    <li><b>Low-High (blue):</b> Low value with neighboring high values—outlier.</li>
                </ul>
                <p className="mt-2"><b>Significance (p-value):</b> The map may filter or highlight clusters that are statistically significant at chosen thresholds (e.g., 0.05).</p>
                <p className="mt-2"><b>Interpretation:</b></p>
                <ul className="list-disc list-inside">
                    <li>Hotspots and cold spots direct attention to areas where environmental or management factors may create clustering.</li>
                    <li>Outliers signal potential anomalies or cases requiring further study.</li>
                </ul>
            </CardContent>
        </Card>
    );
};

const LISAClustersTable = ({ lisaData }: { lisaData: any[] }) => {
    if (!lisaData || lisaData.length === 0) return null;

    const clusterOrder = ['High-High', 'Low-Low', 'High-Low', 'Low-High'];

    const clusters: { [key: string]: any[] } = {
        "High-High": lisaData.filter(d => d.LISA_cluster === 1),
        "Low-Low": lisaData.filter(d => d.LISA_cluster === 4),
        "High-Low": lisaData.filter(d => d.LISA_cluster === 2),
        "Low-High": lisaData.filter(d => d.LISA_cluster === 3),
    };

    return (
        <Card className="mt-6 !border border-[#34d399] rounded-lg">
            <CardHeader>
                <CardTitle>LISA Cluster Classifications</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 gap-4">
                    {clusterOrder.map((clusterType) => {
                        const data = clusters[clusterType];
                        return (
                            data.length > 0 && (
                                <div key={clusterType}>
                                    <h3 className="font-bold">{clusterType}</h3>
                                    <table className="w-full border-collapse !border border-[#34d399] mt-2">
                                        <thead className="bg-cyan-50">
                                            <tr>
                                                <th className="!border border-[#34d399] px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Location</th>
                                                <th style={{ width: '120px' }} className="!border border-[#34d399] px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Latitude</th>
                                                <th style={{ width: '120px' }} className="!border border-[#34d399] px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Longitude</th>
                                                <th style={{ width: '120px' }} className="!border border-[#34d399] px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">P-Value</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.map((row: any, i: number) => (
                                                <tr key={i}>
                                                    <td className="!border border-[#34d399] px-4 py-2 whitespace-nowrap text-sm text-gray-900">{row.LOCATION}</td>
                                                    <td className="!border border-[#34d399] px-4 py-2 whitespace-nowrap text-sm text-gray-900">{row.latitude.toFixed(4)}</td>
                                                    <td className="!border border-[#34d399] px-4 py-2 whitespace-nowrap text-sm text-gray-900">{row.longitude.toFixed(4)}</td>
                                                    <td className="!border border-[#34d399] px-4 py-2 whitespace-nowrap text-sm text-gray-900">{row.LISA_p.toFixed(4)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    );
};

const ResultsDisplay = ({ results, loading, error }: ResultsDisplayProps) => {
    if (loading) return <div className="text-center py-4">Loading...</div>;
    if (error) return <div className="text-red-500 bg-red-100 p-4 rounded-md">Error: {error}</div>;
    if (!results) return null;

    return (
        <>
            {results.moran_i && (
                <Card className="mt-6 !border border-[#34d399] rounded-lg">
                    <CardHeader>
                        <CardTitle>Moran&apos;s I</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p><b>Mora&apos;s I:</b> {results.moran_i.I.toFixed(4)}</p>
                        <p><b>P-value:</b> {results.moran_i.p_value.toFixed(4)}</p>
                        <MoranInterpretation moranI={results.moran_i.I} pValue={results.moran_i.p_value} />
                    </CardContent>
                </Card>
            )}

            {results.plots && (
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {results.plots.morans_scatterplot && (
                        <div className="!border border-[#34d399] rounded-lg p-2">
                        <img src={`data:image/png;base64,${results.plots.morans_scatterplot}`} alt="Moran's I Scatterplot" className="mx-auto" />
                        </div>
                    )}
                    {results.plots.gp_spatial_map && (
                        <div className="!border border-[#34d399] rounded-lg p-2">
                            <img src={`data:image/png;base64,${results.plots.gp_spatial_map}`} alt="GP Spatial Map" className="mx-auto" />
                        </div>
                    )}
                </div>
            )}

            {results.interactive_map && (
                <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-2">Interactive Map</h3>
                    <div className="!border border-[#34d399] rounded-lg p-2" dangerouslySetInnerHTML={{ __html: results.interactive_map }} />
                </div>
            )}

            {results.lisa_results && <LISAClustersTable lisaData={results.lisa_results} />}
            {results.lisa_results && <LISAInterpretationCard />}
        </>
    );
};

export default function SpatialPage() {
    const [file, setFile] = useState<File | null>(null);
    const [dataPreview, setDataPreview] = useState<any[]>([]);
    const [columnHeaders, setColumnHeaders] = useState<string[]>([]);
    const [results, setResults] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [availableSheets, setAvailableSheets] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState<string>("");

    const [locationCol, setLocationCol] = useState("");
    const [valueCol, setValueCol] = useState("");
    const [latCol, setLatCol] = useState("");
    const [longCol, setLongCol] = useState("");

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const f = e.target.files[0];
            setFile(f);
            setError("");
            setResults(null);
            setDataPreview([]);
            setColumnHeaders([]);
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
                    const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                    try {
                        const workbook = XLSX.read(data, { type: 'array' });
                        const sheets = workbook.SheetNames || [];
                        setAvailableSheets(sheets);
                        if (sheets.length > 0) setSelectedSheet(sheets[0]);
                    } catch (er) {
                        setError("Failed to read XLSX file. Please ensure it is a valid spreadsheet.");
                    }
                };
                reader.readAsArrayBuffer(f);
            }
        }
    };

    const handleProcessFile = () => {
        if (!file) {
            setError("Please select a file first.");
            return;
        }
        const name = file.name.toLowerCase();
        const isXlsx = name.endsWith('.xlsx') || name.endsWith('.xls');
        if (isXlsx) {
            if (!selectedSheet) {
                setError("Please select a sheet to preview.");
                return;
            }
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheet = workbook.Sheets[selectedSheet];
                    if (!sheet) {
                        setError("Selected sheet not found in workbook.");
                        return;
                    }
                    const headerRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                    const headers = headerRows[0] as string[];
                    setColumnHeaders(headers);

                    const json = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[];
                    const preview = json.slice(0, 5);
                    setDataPreview(preview);
                } catch (er: any) {
                    setError("Failed to parse the selected sheet. Please verify your file.");
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            parse(file, {
                header: true,
                skipEmptyLines: true,
                preview: 5,
                complete: (result) => {
                    setDataPreview(result.data);
                    setColumnHeaders(result.meta.fields || []);
                }
            });
        }
    };

    const handleAnalyze = async () => {
        if (!file) { setError("Please upload a CSV or XLSX file."); return; }
        setLoading(true);
        setError("");
        setResults(null);

        const processAndFetch = async (jsonData: any[]) => {
            try {
                const serviceUrl = (process.env.NEXT_PUBLIC_SPATIAL_SERVICE_URL || '').replace(/\/$/, "");
                if (!serviceUrl) throw new Error("Spatial service URL is not configured");

                const mappedData = jsonData.map(row => ({
                    LOCATION: row[locationCol],
                    Value: row[valueCol],
                    latitude: latCol ? row[latCol] : undefined,
                    longitude: longCol ? row[longCol] : undefined,
                }));
                
                const response = await fetch(serviceUrl, { 
                    method: "POST", 
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ data: mappedData })
                });
                const raw = await response.text();
                let resultData: any;
                try {
                    resultData = JSON.parse(raw);
                } catch {
                    throw new Error(`Unexpected response from server (status ${response.status}). Body: ${raw.slice(0, 300)}`);
                }
                if (!response.ok) throw new Error(resultData?.error || `Analysis failed (${response.status})`);
                setResults(resultData);
            } catch (err: any) {
                setError(err.message || "An unexpected error occurred");
            } finally {
                setLoading(false);
            }
        };

        const reader = new FileReader();
        const isXlsx = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');

        if (isXlsx) {
            if (!selectedSheet) { setError("Please select a sheet for analysis."); setLoading(false); return; }
            reader.onload = async () => {
                try {
                    const data = new Uint8Array(reader.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheet = workbook.Sheets[selectedSheet];
                    if (!sheet) throw new Error("Selected sheet not found");
                    const json = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[];
                    await processAndFetch(json);
                } catch (err: any) {
                    setError(err.message || "Failed to read XLSX for analysis");
                    setLoading(false);
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            reader.onload = async () => {
                const csvData = reader.result as string;
                const jsonData = parse(csvData, { header: true, skipEmptyLines: true }).data as any[];
                await processAndFetch(jsonData);
            };
            reader.readAsText(file);
        }
    };

    const handleReset = () => {
        setFile(null);
        setResults(null);
        setError("");
        setDataPreview([]);
        setColumnHeaders([]);
        setAvailableSheets([]);
        setSelectedSheet("");
        setLocationCol("");
        setValueCol("");
        setLatCol("");
        setLongCol("");
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const renderColumnSelector = (value: string, onChange: (val: string) => void, placeholder: string, isOptional: boolean = false) => (
        <select value={value} onChange={e => onChange(e.target.value)} className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
            <option value="">{isOptional ? `${placeholder} (Optional)` : placeholder}</option>
            {columnHeaders.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
    );

    return (
        <div className="min-h-screen bg-background p-4">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center mb-4">
                        <FaMapMarkedAlt style={{ height: '2rem', width: '2rem', color: "#34d399", marginRight: '0.75rem' }} />
                        <h1 className="text-3xl font-bold">Spatial Stability Analysis</h1>
                    </div>
                    <p className="text-muted-foreground font-bold">Exploratory Spatial Data Analysis (Moran&apos;s I and Local Indicators of Spatial Association (LISA)) identifies local clusters and spatial outliers.</p>
                    <p className="text-muted-foreground">Using these tools, researchers can identify regions where their products perform consistently well (high-high clusters) or poorly (low-low clusters). This helps in tailoring breeding programs to specific environments, optimize number of field trials and cut costs.</p>
                </div>

                <Card className="mb-8 !border border-[#34d399] rounded-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center"><Upload className="mr-2" /> Upload Data</CardTitle>
                        <CardDescription>Upload a .CSV or .XLSX file (max 1 MB). Required columns are location and value. Location column should have state name in addition to location for accuracy. eg. &quot;Hyderabad, Telangana&quot;. If you know latitude and longitude degrees provide them in separate columns (EPSG:4326 format). Then, map your data columns to the required fields.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center space-x-4">
                            <Input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} ref={fileInputRef} className="flex-1" />
                            <Button onClick={handleProcessFile} disabled={!file} variant="secondary" className="bg-gray-200 text-black-800 font-bold hover:bg-gray-300 border border-gray-300">Process File</Button>
                            <Button onClick={handleReset} variant="outline" disabled={!file}>Reset</Button>
                        </div>
                        {availableSheets.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block mb-1 font-medium">Select Sheet (XLSX)</label>
                                    <select
                                        value={selectedSheet}
                                        onChange={(e) => setSelectedSheet(e.target.value)}
                                        className="block w-full p-2 border border-[#34d399] rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    >
                                        {availableSheets.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="text-sm text-muted-foreground self-end">Max XLSX size: 1 MB</div>
                            </div>
                        )}
                        {file && <p className="text-sm text-muted-foreground">Selected file: {file.name}</p>}
                        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
                    </CardContent>
                </Card>

                {dataPreview.length > 0 && (
                    <Card className="mb-8 !border border-[#34d399] rounded-lg">
                        <CardHeader>
                            <CardTitle>Data Preview</CardTitle>
                            <CardDescription>Showing the first 5 rows of your data.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse !border border-[#34d399]">
                                    <thead className="bg-cyan-50">
                                        <tr>
                                            {columnHeaders.map(h => (
                                                <th key={h} className="!border border-[#34d399] px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dataPreview.map((row: any, i: number) => (
                                            <tr key={i}>
                                                {columnHeaders.map(h => (
                                                    <td key={h} className="!border border-[#34d399] px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                                        {row[h]}
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

                {dataPreview.length > 0 && (
                    <Card className="mb-8 !border border-[#34d399] rounded-lg">
                        <CardHeader><CardTitle>Model Specification</CardTitle></CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label>Location <span className="text-red-500">*</span></label>
                                    {renderColumnSelector(locationCol, setLocationCol, "Select Location")}
                                </div>
                                <div className="space-y-2">
                                    <label>Value <span className="text-red-500">*</span></label>
                                    {renderColumnSelector(valueCol, setValueCol, "Select Value")}
                                </div>
                                <div className="space-y-2">
                                    <label>Latitude</label>
                                    {renderColumnSelector(latCol, setLatCol, "Select Latitude", true)}
                                </div>
                                <div className="space-y-2">
                                    <label>Longitude</label>
                                    {renderColumnSelector(longCol, setLongCol, "Select Longitude", true)}
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Button onClick={handleAnalyze} disabled={loading || !locationCol || !valueCol} variant="secondary" className="bg-gray-200 text-black-800 font-bold hover:bg-black-300 border border-gray-300">
                                    {loading ? "Analyzing..." : "Run Analysis"}
                                </Button>
                                <p className="text-sm text-muted-foreground">may take 30s to finish analysis</p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <ResultsDisplay
                    results={results}
                    loading={loading}
                    error={error}
                />
            </div>
        </div>
    );
}
