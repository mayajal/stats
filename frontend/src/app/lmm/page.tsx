/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FaUpload, FaChartBar } from "react-icons/fa";
import { parse } from 'papaparse';

const cleanCell = (cell: string) => {
    if (typeof cell !== 'string') {
        return cell;
    }
    return cell.replace(/C\(Q\(\"([^\"]+)\"\)\)/g, '$1')
               .replace(/Q\(\"([^\"]+)\"\)/g, '$1')
               .replace(/(\w+)\\[T\.\([^\\]+\)\]/g, '$2');
};

const ModelSummaryTable = ({ summaryData }: { summaryData: any }) => {
    if (!summaryData || typeof summaryData !== 'object') return null;

    const renderSingleTable = (data: any[], title: string) => {
        if (!data || data.length === 0) return null;
        const header = data[0];
        const body = data.slice(1);

        return (
            <div className="my-4" key={title}>
                <h4 className="text-md font-semibold mb-2">{title}</h4>
                <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200 font-mono text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                {header.map((h: string, j: number) => (
                                    <th key={j} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{cleanCell(h)}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {body.map((row: string[], i: number) => (
                                <tr key={i}>
                                    {row.map((cell: string, j: number) => (
                                        <td key={j} className="px-6 py-4 whitespace-pre text-left">{cleanCell(cell)}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="my-4 space-y-4">
            <h3 className="text-lg font-semibold">Model Summary</h3>
            {Object.entries(summaryData).map(([title, data]) =>
                renderSingleTable(data as any[], title.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))
            )}
        </div>
    );
};



const ResultsDisplay = ({ results, loading, error }: { results: any, loading: boolean, error: string }) => {
    if (loading) return <div className="text-center py-4">Loading...</div>;
    if (error) return <div className="text-red-500 bg-red-100 p-4 rounded-md">Error: {error}</div>;
    if (!results) return null;

    const renderTable = (jsonData: string, title: string) => {
        try {
            const data = JSON.parse(jsonData);
            if (!data || data.length === 0) return <p>No data available for {title}.</p>;
            const headers = Object.keys(data[0]);
            return (
                <div className="my-4">
                    <h3 className="text-lg font-semibold mb-2">{title}</h3>
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    {headers.map(h => <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>)}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {data.map((row: any, i: number) => (
                                    <tr key={i}>
                                        {headers.map(h => <td key={h} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row[h]}</td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        } catch (e) {
            return <p>Error parsing table data for {title}.</p>;
        }
    };

    return (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle className="flex items-center"><FaChartBar className="mr-2" /> Analysis Results</CardTitle>
            </CardHeader>
            <CardContent>
                {results.model_summary && <ModelSummaryTable summaryData={results.model_summary} />}
                {results.mean_separation_results && renderTable(results.mean_separation_results, "Mean Separation Results")}
                {results.cd_value && <p className="mt-4"><b>Critical Difference (CD):</b> {results.cd_value.toFixed(4)}</p>}
                
                {results.plots && (
                    <div className="mt-6">
                        <h3 className="text-lg font-semibold mb-2">Plots</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(results.plots).map(([key, value]) => (
                                <div key={key} className="border rounded-lg p-2">
                                    <h4 className="text-md font-semibold text-center capitalize mb-2">{key.replace(/_/g, ' ')}</h4>
                                    <img src={`data:image/png;base64,${value}`} alt={key} className="mx-auto"/>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default function LMMPage() {
    const [file, setFile] = useState<File | null>(null);
    const [dataPreview, setDataPreview] = useState<any[]>([]);
    const [showAnalysisTabs, setShowAnalysisTabs] = useState(false);
    const [columnHeaders, setColumnHeaders] = useState<string[]>([]);
    const [results, setResults] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State for inputs
    const [responseCol, setResponseCol] = useState("");
    const [groupCol, setGroupCol] = useState("");
    const [fixedEffects, setFixedEffects] = useState<string[]>([]);
    const [tukeyFactor, setTukeyFactor] = useState("");

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const f = e.target.files[0];
            setFile(f);
            setError("");
            setResults(null);
            setShowAnalysisTabs(false);
            setDataPreview([]);
            setColumnHeaders([]);
        }
    };

    const handleProcessFile = () => {
        if (!file) {
            setError("Please select a file first.");
            return;
        }
        parse(file, {
            header: true,
            skipEmptyLines: true,
            preview: 5,
            complete: (result) => {
                setDataPreview(result.data);
                setColumnHeaders(result.meta.fields || []);
                setShowAnalysisTabs(true);
            }
        });
    };

    const handleAnalyze = async () => {
        if (!file) {
            setError("Please upload a CSV file.");
            return;
        }

        setLoading(true);
        setError("");
        setResults(null);

        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = async () => {
            const csvData = reader.result as string;
            const jsonData = JSON.stringify(parse(csvData, { header: true, skipEmptyLines: true }).data);

            const formData = new FormData();
            formData.append("data", jsonData);
            formData.append("analysis_type", "effects");
            formData.append("response_col", responseCol);
            formData.append("group_col", groupCol);
            formData.append("fixed_effects", fixedEffects.join(','));
            formData.append("tukey_factor", tukeyFactor);

            try {
                const response = await fetch(process.env.NEXT_PUBLIC_LMM_SERVICE_URL || '', {
                    method: "POST",
                    body: formData,
                });

                const resultData = await response.json();
                if (!response.ok) {
                    throw new Error(resultData.error || "Analysis failed");
                }
                setResults(resultData);
            } catch (err: any) {
                setError(err.message || "An unexpected error occurred");
            } finally {
                setLoading(false);
            }
        };
    };

    const handleReset = () => {
        setFile(null);
        setResults(null);
        setError("");
        setDataPreview([]);
        setShowAnalysisTabs(false);
        setColumnHeaders([]);
        setResponseCol("");
        setGroupCol("");
        setFixedEffects([]);
        setTukeyFactor("");
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleFixedEffectChange = (column: string) => {
        setFixedEffects(prev =>
            prev.includes(column)
                ? prev.filter(c => c !== column)
                : [...prev, column]
        );
    };

    const renderColumnSelector = (value: string, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, placeholder: string) => (
        <select value={value} onChange={onChange} className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
            <option value="" disabled>{placeholder}</option>
            {columnHeaders.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
    );

    const renderFixedEffectsSelector = () => (
        <div className="space-y-2 col-span-2">
            <label className="text-sm font-medium">Fixed Effects</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 border p-2 rounded-md">
                {columnHeaders.map(h => (
                    <div key={h} className="flex items-center space-x-2">
                        <Input
                            type="checkbox"
                            id={`fixed-${h}`}
                            checked={fixedEffects.includes(h)}
                            onChange={() => handleFixedEffectChange(h)}
                            className="h-4 w-4"
                        />
                        <label htmlFor={`fixed-${h}`} className="text-sm font-medium">
                            {h}
                        </label>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-background p-4">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold">Linear Mixed Models (LMM)</h1>
                    <p className="text-muted-foreground">Analyze data with both fixed and random effects.</p>
                </div>

                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle className="flex items-center"><FaUpload className="mr-2" /> Upload Data</CardTitle>
                        <CardDescription>Step 1: Upload a .CSV file. Step 2: Process it to see a preview.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center space-x-4">
                            <Input type="file" accept=".csv" onChange={handleFileChange} ref={fileInputRef} className="flex-1" />
                            <Button onClick={handleProcessFile} disabled={!file}>Process File</Button>
                            <Button onClick={handleReset} variant="outline" disabled={!file}>Reset</Button>
                        </div>
                        {file && <p className="text-sm text-muted-foreground">Selected file: {file.name}</p>}
                        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
                    </CardContent>
                </Card>

                {dataPreview.length > 0 && (
                    <Card className="mb-8">
                        <CardHeader>
                            <CardTitle>Data Preview</CardTitle>
                            <CardDescription>Showing the first 5 rows of your data.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto border rounded-lg">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            {columnHeaders.map(h => <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {dataPreview.map((row: any, i: number) => (
                                            <tr key={i}>
                                                {columnHeaders.map(h => <td key={h} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row[h]}</td>)}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {showAnalysisTabs && (
                    <Card className="mb-8">
                        <CardHeader><CardTitle>LMM for Fixed, Random & Interaction Effects</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {renderColumnSelector(responseCol, e => setResponseCol(e.target.value), "Select Response Column")}
                                {renderColumnSelector(groupCol, e => setGroupCol(e.target.value), "Select Random/Grouping Column")}
                                {renderColumnSelector(tukeyFactor, e => setTukeyFactor(e.target.value), "Select Factor for Tukey Test")}
                                {renderFixedEffectsSelector()}
                            </div>
                            <Button onClick={handleAnalyze} disabled={loading}>Run Effects Analysis</Button>
                        </CardContent>
                    </Card>
                )}

                <ResultsDisplay results={results} loading={loading} error={error} />
            </div>
        </div>
    );
}