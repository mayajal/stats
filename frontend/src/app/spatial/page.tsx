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

const ResultsDisplay = ({ results, loading, error }: ResultsDisplayProps) => {
    if (loading) return <div className="text-center py-4">Loading...</div>;
    if (error) return <div className="text-red-500 bg-red-100 p-4 rounded-md">Error: {error}</div>;
    if (!results) return null;

    return (
        <Card className="mt-6 !border !border-primary rounded-lg">
            <CardHeader>
                <CardTitle className="flex items-center"><FaMapMarkedAlt className="mr-2" /> Analysis Results</CardTitle>
            </CardHeader>
            <CardContent>
                {results.moran_i && (
                    <div className="bg-cyan-50 p-4 rounded-md my-4">
                        <p><b>Moran's I:</b> {results.moran_i.I.toFixed(4)}</p>
                        <p><b>P-value:</b> {results.moran_i.p_value.toFixed(4)}</p>
                    </div>
                )}

                {results.plots && (
                    <div className="mt-6">
                        <h3 className="text-lg font-semibold mb-2">Plots</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {results.plots.morans_scatterplot && (
                                <div className="!border !border-primary rounded-lg p-2">
                                <img src={`data:image/png;base64,${results.plots.morans_scatterplot}`} alt="Moran's I Scatterplot" className="mx-auto" />
                                </div>
                            )}
                            {results.plots.lisa_cluster_map && (
                                <div className="!border !border-primary rounded-lg p-2">
                                    <img src={`data:image/png;base64,${results.plots.lisa_cluster_map}`} alt="LISA Cluster Map" className="mx-auto" />
                                </div>
                            )}
                            {results.plots.gp_spatial_map && (
                                <div className="!border !border-primary rounded-lg p-2">
                                    <img src={`data:image/png;base64,${results.plots.gp_spatial_map}`} alt="GP Spatial Map" className="mx-auto" />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {results.interactive_map && (
                    <div className="mt-6">
                        <h3 className="text-lg font-semibold mb-2">Interactive Map</h3>
                        <div className="!border !border-primary rounded-lg p-2" dangerouslySetInnerHTML={{ __html: results.interactive_map }} />
                    </div>
                )}

            </CardContent>
        </Card>
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
                    const json = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[];
                    const preview = json.slice(0, 5);
                    setDataPreview(preview);
                    setColumnHeaders(Object.keys(json[0] || {}));
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
                const serviceUrl = process.env.NEXT_PUBLIC_SPATIAL_SERVICE_URL || '';
                if (!serviceUrl) throw new Error("Spatial service URL is not configured");
                
                const response = await fetch(serviceUrl, { 
                    method: "POST", 
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ data: jsonData })
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
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <div className="min-h-screen bg-background p-4">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center mb-4">
                        <FaMapMarkedAlt style={{ height: '2rem', width: '2rem', color: "#34d399", marginRight: '0.75rem' }} />
                        <h1 className="text-3xl font-bold">Spatial Stability Analysis</h1>
                    </div>
                    <p className="text-muted-foreground">Analyze geographical stability of varieties and hybrids.</p>
                </div>

                <Card className="mb-8 !border !border-primary rounded-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center"><Upload className="mr-2" /> Upload Data</CardTitle>
                        <CardDescription>Upload a .CSV or .XLSX file (max 1 MB) with 'LOCATION' and 'YIELD' (or 'Value') columns. Select the sheet and process to see a preview.</CardDescription>
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
                                        className="block w-full p-2 border !border-primary rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
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
                    <Card className="mb-8 !border !border-primary rounded-lg">
                        <CardHeader>
                            <CardTitle>Data Preview</CardTitle>
                            <CardDescription>Showing the first 5 rows of your data.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse !border !border-primary">
                                    <thead className="bg-cyan-50">
                                        <tr>
                                            {columnHeaders.map(h => (
                                                <th key={h} className="!border !border-primary px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dataPreview.map((row: any, i: number) => (
                                            <tr key={i}>
                                                {columnHeaders.map(h => (
                                                    <td key={h} className="!border !border-primary px-4 py-2 whitespace-nowrap text-sm text-gray-900">
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
                    <Card className="mb-8 !border !border-primary rounded-lg">
                        <CardHeader><CardTitle>Run Analysis</CardTitle></CardHeader>
                        <CardContent>
                            <Button onClick={handleAnalyze} disabled={loading} variant="secondary" className="bg-gray-200 text-black-800 font-bold hover:bg-black-300 border border-gray-300">
                                {loading ? "Analyzing..." : "Run Analysis"}
                            </Button>
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
