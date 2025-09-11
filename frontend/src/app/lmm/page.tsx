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

const ModelSummaryHtml = ({ html }: { html: string }) => {
    if (!html) return null;

    const renderParsedTables = (htmlString: string) => {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlString, 'text/html');
            const tables = Array.from(doc.querySelectorAll('table'));

            if (tables.length === 0) return null;

            const formatParamEffect = (value: string) => {
                if (typeof value !== 'string') return value as any;
                if (value === 'Intercept') return value;
                const parts = value.split(':');
                const cleaned = parts.map(p => {
                    // C(name)[T.level] -> level
                    const m = p.match(/^C\(([^)]+)\)\[T\.([^\]]+)\]$/);
                    if (m) {
                        return m[2];
                    }
                    // Q("name") or Q('name')
                    const q = p.match(/^Q\(["']([^"']+)["']\)$/);
                    if (q) {
                        return q[1];
                    }
                    // C(name) -> name
                    const c = p.match(/^C\(([^)]+)\)$/);
                    if (c) {
                        return c[1];
                    }
                    // Default: return as-is (continuous terms)
                    return p;
                });
                return cleaned.join(':');
            };

            return (
                <div className="space-y-4">
                    {tables.map((table, tIdx) => {
                        const tableTitle = [
                            'Model & Fit Statistics',
                            'Parameter Estimates'
                        ][tIdx] || `Table ${tIdx + 1}`;
                        const rows = Array.from(table.querySelectorAll('tr')).map(tr =>
                            Array.from(tr.querySelectorAll('th, td')).map(cell => cleanCell(cell.textContent?.trim() || ''))
                        );
                        const firstRow = table.querySelector('tr');
                        const firstHasTh = firstRow ? firstRow.querySelectorAll('th').length > 0 : false;
                        let headers = firstHasTh ? Array.from(firstRow!.querySelectorAll('th')).map(th => cleanCell(th.textContent?.trim() || '')) : [];
                        let dataRows = firstHasTh ? rows.slice(1) : rows;

                        const isParamEstimates = tableTitle === 'Parameter Estimates' || tIdx === 1;
                        if (isParamEstimates) {
                            if (headers.length > 0) {
                                headers = ['', ...headers];
                            } else if (dataRows.length > 0) {
                                headers = Array.from({ length: dataRows[0].length }, (_, i) => (i === 0 ? '' : `Col ${i + 1}`));
                            }
                            // Ensure the first column shows condensed effect names
                            dataRows = dataRows.map(row => {
                                if (row.length === 0) return row;
                                const first = String(row[0] ?? '');
                                const condensed = formatParamEffect(first);
                                return [condensed, ...row.slice(1)];
                            });
                        }

                        return (
                            <div key={`model-summary-table-${tIdx}`} className="overflow-x-auto">
                                <div className="text-sm font-semibold mb-1">{tableTitle}</div>
                                <table className="w-full border-collapse border border-purple-300 font-mono text-sm">
                                    {headers.length > 0 && (
                                        <thead className="bg-purple-50">
                                            <tr>
                                                {headers.map((h, i) => (
                                                    <th key={`${h}-${i}`} className="border border-purple-300 px-3 py-1 text-left">
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                    )}
                                    <tbody>
                                        {dataRows.map((row, rIdx) => (
                                            <tr key={`row-${rIdx}`}>
                                                {row.map((cell, cIdx) => {
                                                    const cellValue = parseFloat(String(cell));
                                                    const isPValueCol = isParamEstimates && headers[cIdx] === 'P>|z|';
                                                    const bgColorClass = isPValueCol
                                                        ? (cellValue > 0.05 ? 'bg-pink-200' : 'bg-green-200')
                                                        : '';
                                                    return (
                                                        <td key={`cell-${rIdx}-${cIdx}`} className={`border border-purple-300 px-3 py-1 ${bgColorClass}`}>
                                                            {cleanCell(String(cell))}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })}
                </div>
            );
        } catch (e) {
            return null;
        }
    };

    return (
        <div className="my-4">
            <h3 className="text-lg font-semibold mb-2">Mixed Linear Model Regression Results</h3>
            {renderParsedTables(html) || (
                <div className="overflow-x-auto border rounded-lg p-3 bg-white font-mono text-sm" dangerouslySetInnerHTML={{ __html: html }} />
            )}
        </div>
    );
};

const renderResultsTable = (data: string) => {
    try {
        if (typeof data === 'string' && data.includes('<table')) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(data, 'text/html');
            const table = doc.querySelector('table');
            if (table) {
                const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent?.trim() || '');
                const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr =>
                    Array.from(tr.querySelectorAll('td, th')).map(cell => cell.textContent?.trim() || '')
                ).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
                return (
                    <div className="overflow-x-auto mb-6">
                        <table className="w-full border-collapse border border-purple-300">
                            <thead className="bg-purple-50">
                                <tr className="bg-purple-50">
                                    {headers.map((h, i) => <th key={`${h}-${i}`} className="border border-purple-300 px-4 py-2 text-left">{h}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, i) => (
                                    <tr key={i}>
                                        {row.map((cell, j) => <td key={`${i}-${j}`} className="border border-purple-300 px-4 py-2">{cell}</td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            }
        }
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
            const headers = Object.keys(parsed[0]);
            const sortedParsed = parsed.sort((a: any, b: any) => String(a[headers[0]]).localeCompare(String(b[headers[0]])));
            return (
                <div className="overflow-x-auto mb-6">
                    <table className="w-full border-collapse border border-purple-300">
                        <thead className="bg-purple-50">
                            <tr className="bg-purple-50">
                                {headers.map(h => <th key={h} className="border border-purple-300 px-4 py-2 text-left">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedParsed.map((row: any, i: number) => (
                                <tr key={i}>
                                    {headers.map(h => (
                                        <td key={`${i}-${h}`} className="border border-purple-300 px-4 py-2">
                                            {!isNaN(Number(row[h])) && row[h] !== null && String(row[h]).trim() !== ''
                                                ? Number(row[h]).toFixed(2)
                                                : String(row[h])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }
        const objHeaders = Object.keys(parsed);
        if (objHeaders.length > 0 && typeof (parsed as any)[objHeaders[0]] === 'object') {
            const rowKeys = Object.keys((parsed as any)[objHeaders[0]]).sort((a, b) => a.localeCompare(b));
            return (
                <div className="overflow-x-auto mb-6">
                    <table className="w-full border-collapse border border-purple-300">
                        <thead className="bg-purple-50">
                            <tr className="bg-purple-50">
                                <th className="border border-purple-300 px-4 py-2 text-left"></th>
                                {objHeaders.map(h => <th key={h} className="border border-purple-300 px-4 py-2 text-left">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {rowKeys.map(key => (
                                <tr key={key}>
                                    <td className="border border-purple-300 px-4 py-2 font-medium">{key}</td>
                                    {objHeaders.map(h => (
                                        <td key={`${key}-${h}`} className="border border-purple-300 px-4 py-2">
                                            {!isNaN(Number((parsed as any)[h][key])) && (parsed as any)[h][key] !== null && String((parsed as any)[h][key]).trim() !== ''
                                                ? Number((parsed as any)[h][key]).toFixed(2)
                                                : String((parsed as any)[h][key])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }
        return null;
    } catch (e) {
        return null;
    }
};

const ResultsDisplay = ({ results, loading, error }: { results: any, loading: boolean, error: string }) => {
    if (loading) return <div className="text-center py-4">Loading...</div>;
    if (error) return <div className="text-red-500 bg-red-100 p-4 rounded-md">Error: {error}</div>;
    if (!results) return null;

    return (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle className="flex items-center"><FaChartBar className="mr-2" /> Analysis Results</CardTitle>
            </CardHeader>
            <CardContent>
                {results.model_summary_html && <ModelSummaryHtml html={results.model_summary_html} />}

                {/* Diagnostics */}
                {results.plots && (
                    <div className="mt-6">
                        <h3 className="text-lg font-semibold mb-2">Diagnostic Plots</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {results.plots.residuals_vs_fitted && (
                                <div className="border rounded-lg p-2">
                                <img src={`data:image/png;base64,${results.plots.residuals_vs_fitted}`} alt="Residuals vs Fitted" className="mx-auto" />
                                </div>
                            )}
                            {results.plots.qq_plot && (
                                <div className="border rounded-lg p-2">
                                    
                                    <img src={`data:image/png;base64,${results.plots.qq_plot}`} alt="Q-Q Plot" className="mx-auto" />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {results.shapiro && (
                    <div className="bg-purple-50 p-4 rounded-md my-4">
                        <p><b>Shapiro-Wilk Statistic:</b> {results.shapiro.stat != null ? Number(results.shapiro.stat).toFixed(4) : 'NA'}</p>
                        <p><b>P-value:</b> {results.shapiro.p != null ? Number(results.shapiro.p).toFixed(4) : 'NA'}</p>
                        <p className="text-sm text-muted-foreground mt-2">
                            {results.shapiro.p != null && !isNaN(Number(results.shapiro.p))
                                ? (Number(results.shapiro.p) < 0.05
                                    ? 'Residuals deviate from normality (p < 0.05). Consider checking outliers, transforming the response, or using robust methods.'
                                    : 'Residuals are consistent with a normal distribution (p ≥ 0.05). Normality assumption holds.')
                                : ''}
                        </p>
                    </div>
                )}

                {/* Tukey HSD */}
                {results.tukey_results && Object.keys(results.tukey_results)
                    .filter((factor: string) => {
                        const f = factor || '';
                        const cleaned = cleanCell(f);
                        return cleaned !== 'TREAT' && f !== 'TREAT';
                    })
                    .map((factor: string) => (
                        <div key={factor} className="my-4">
                            <h3 className="text-lg font-semibold mb-2">Tukey HSD: {factor}</h3>
                            {renderResultsTable(results.tukey_results[factor])}
                        </div>
                    ))}

                {/* Mean Separation */}
                {results.mean_separation_results && Object.keys(results.mean_separation_results).map((factor: string) => (
                    <div key={factor} className="my-4">
                        <h3 className="text-lg font-semibold mb-2">Mean Separation (Tukey HSD Post-hoc): {factor}</h3>
                        {renderResultsTable(results.mean_separation_results[factor])}
                    </div>
                ))}

                {typeof results.overall_cv === 'number' && (
                    <p className="mt-4 text-sm text-muted-foreground"><b>Overall CV (%):</b> {Number(results.overall_cv).toFixed(2)}</p>
                )}
                {typeof results.cd_value === 'number' && (
                    <p className="mt-1 text-sm text-muted-foreground"><b>Critical Difference (CD):</b> {Number(results.cd_value).toFixed(2)}</p>
                )}

                {/* Mean Plots */}
                {results.plots && (results.plots.mean_bar_plot || results.plots.mean_box_plot) && (
                    <div className="mt-6">
                        <h3 className="text-lg font-semibold mb-2">Mean Plots</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {results.plots.mean_bar_plot && (
                                <div className="border rounded-lg p-2">
                                    
                                    <img src={`data:image/png;base64,${results.plots.mean_bar_plot}`} alt="Bar Plot" className="mx-auto" />
                                </div>
                            )}
                            {results.plots.mean_box_plot && (
                                <div className="border rounded-lg p-2">
                                    
                                    <img src={`data:image/png;base64,${results.plots.mean_box_plot}`} alt="Box Plot" className="mx-auto" />
                                </div>
                            )}
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
                        <CardDescription>Upload a .CSV file. Process it to see a preview.</CardDescription>
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

                {dataPreview.length > 0 && (
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