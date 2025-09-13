/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Upload } from 'lucide-react';
import { FaChartBar } from "react-icons/fa";
import { parse } from 'papaparse';
import * as XLSX from 'xlsx';

const cleanCell = (cell: string) => {
    if (typeof cell !== 'string') {
        return cell;
    }
    return cell.replace(/C\(Q\(\"([^\"]+)\"\)\)/g, '$1')
               .replace(/Q\(\"([^\"]+)\"\)/g, '$1');
};

const ModelSummaryHtml = ({ html }: { html: string }) => {
    if (!html) return null;

    const renderParsedTables = (htmlString: string) => {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlString, 'text/html');
            const tables = Array.from(doc.querySelectorAll('table'));

            if (tables.length < 2) {
                 return <div className="overflow-x-auto border rounded-lg p-3 bg-white font-mono text-sm" dangerouslySetInnerHTML={{ __html: htmlString }} />;
            }

            const formatParamEffect = (value: string) => {
                if (typeof value !== 'string') return value;
                if (value === 'Intercept') return value;
                
                const parts = value.split(':');
                const cleaned = parts.map(p => {
                    if (p.includes('[T.')) {
                        const start = p.indexOf('[T.');
                        const end = p.indexOf(']', start);
                        if (end !== -1) {
                            const content = p.substring(start + 3, end);
                            return p.substring(0, start) + '[' + content + ']';
                        }
                    }
                    return p;
                });
                return cleaned.join(':');
            };

            // Table 1: Model Information
            const modelInfoTable = tables[0];
            const modelInfoRows = Array.from(modelInfoTable.querySelectorAll('tr')).map(tr =>
                Array.from(tr.querySelectorAll('th, td')).map(cell => cleanCell(cell.textContent?.trim() || ''))
            );

            // Table 2: Fixed and Random Effects
            const effectsTable = tables[1];
            const allRows = Array.from(effectsTable.querySelectorAll('tr'));

            let fixedEffectsHeaders: string[] = [];
            let fixedEffectsData: string[][] = [];
            let randomEffectsHeaders: string[] = ['Parameter', 'Variance', 'Std.Dev.']; // Default, will try to extract if possible
            let randomEffectsData: string[][] = [];

            let inFixedEffectsSection = false;
            let inRandomEffectsSection = false;

            // Extract fixed effects headers from the thead of the second table
            const theadRows = Array.from(effectsTable.querySelectorAll('thead tr'));
            if (theadRows.length > 1) { // Expecting at least two rows for headers
                fixedEffectsHeaders = Array.from(theadRows[1].querySelectorAll('th, td')).map(cell => cleanCell(cell.textContent?.trim() || ''));
            } else if (theadRows.length === 1) { // Fallback if only one header row
                fixedEffectsHeaders = Array.from(theadRows[0].querySelectorAll('th, td')).map(cell => cleanCell(cell.textContent?.trim() || ''));
            }
            
            // Iterate through all rows to separate fixed and random effects data
            allRows.forEach(row => {
                const cells = Array.from(row.querySelectorAll('th, td')).map(cell => cleanCell(cell.textContent?.trim() || ''));
                const firstCellText = cells[0];

                if (row.classList.contains('thead') && firstCellText === 'Fixed Effects') {
                    inFixedEffectsSection = true;
                    inRandomEffectsSection = false;
                    // Fixed effects headers are already extracted from thead
                } else if (row.classList.contains('theadd') && firstCellText === 'Random Effects') {
                    inRandomEffectsSection = true;
                    inFixedEffectsSection = false;
                    // For random effects, statsmodels often puts headers in tfoot or implies them.
                    // We'll try to extract from tfoot if available, otherwise use default.
                    const tfootRows = Array.from(effectsTable.querySelectorAll('tfoot tr'));
                    if (tfootRows.length > 0) {
                        const tfootCells = Array.from(tfootRows[0].querySelectorAll('th, td')).map(cell => cleanCell(cell.textContent?.trim() || ''));
                        // Assuming the tfoot row contains relevant headers for random effects
                        // This might need further refinement based on exact statsmodels output
                        if (tfootCells.includes('Var') && tfootCells.includes('Std.Dev.')) {
                             randomEffectsHeaders = ['Parameter', 'Var', 'Std.Dev.']; // Adjust as per actual output
                        }
                    }
                } else if (inFixedEffectsSection && !row.classList.contains('thead') && !row.classList.contains('theadd') && cells.length === fixedEffectsHeaders.length) {
                    fixedEffectsData.push(cells);
                } else if (inRandomEffectsSection && !row.classList.contains('thead') && !row.classList.contains('theadd') && cells.length >= 2) { // Random effects usually have Parameter, Var, Std.Dev.
                    // Filter out rows that are just footers or empty
                    if (!firstCellText.includes('Covariance Type:') && firstCellText !== '') {
                        randomEffectsData.push(cells);
                    }
                }
            });

            // Filter out any empty rows that might have been added due to parsing nuances
            fixedEffectsData = fixedEffectsData.filter(row => row.some(cell => cell !== ''));
            randomEffectsData = randomEffectsData.filter(row => row.some(cell => cell !== ''));

            return (
                <div className="space-y-6">
                    {/* Model Information Table */}
                    <div>
                        <h4 className="text-md font-semibold mb-2">Model Information</h4>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse !border !border-primary font-mono text-sm">
                                <tbody>
                                    {modelInfoRows.map((row, rIdx) => (
                                        <tr key={`info-row-${rIdx}`}>
                                            {row.map((cell, cIdx) => (
                                                <td key={`info-cell-${rIdx}-${cIdx}`} className={`!border !border-primary px-3 py-1 ${cIdx % 2 === 0 ? 'font-semibold' : ''}`}>
                                                    {cell}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Fixed Effects Table */}
                    {fixedEffectsData.length > 0 && (
                        <div>
                            <h4 className="text-md font-semibold mb-2">Fixed Effects</h4>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse !border !border-primary font-mono text-sm">
                                    <thead className="bg-cyan-50">
                                        <tr>
                                            {effectsHeaders.map((h, i) => (
                                                <th key={`fix-header-${i}`} className="!border !border-primary px-2 py-1 text-left">
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {fixedEffectsData.map((row, rIdx) => (
                                            <tr key={`fix-row-${rIdx}`}>
                                                {row.map((cell, cIdx) => (
                                                    <td key={`fix-cell-${rIdx}-${cIdx}`} className={`!border !border-primary px-3 py-1 ${cIdx === 0 ? 'font-semibold' : ''}`}>
                                                        {cIdx === 0 ? formatParamEffect(cell) : cell}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Random Effects Table */}
                    {randomEffectsData.length > 0 && (
                        <div>
                            <h4 className="text-md font-semibold mb-2">Random Effects (Variance Components)</h4>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse !border !border-primary font-mono text-sm">
                                    <thead className="bg-cyan-50">
                                        <tr>
                                            {effectsHeaders.map((h, i) => (
                                                <th key={`rand-header-${i}`} className="!border !border-primary px-2 py-1 text-left">
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {randomEffectsData.map((row, rIdx) => (
                                            <tr key={`rand-row-${rIdx}`}>
                                                {row.map((cell, cIdx) => (
                                                    <td key={`rand-cell-${rIdx}-${cIdx}`} className={`!border !border-primary px-3 py-1 ${cIdx === 0 ? 'font-semibold' : ''}`}>
                                                        {cell}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            );
        } catch (e) {
            console.error("Failed to parse model summary:", e);
            return <div className="overflow-x-auto border rounded-lg p-3 bg-white font-mono text-sm" dangerouslySetInnerHTML={{ __html: htmlString }} />;
        }
    };

    return (
        <div className="my-4">
            <h3 className="text-lg font-semibold mb-2">Model Summary</h3>
            {renderParsedTables(html) || (
                <div className="overflow-x-auto border rounded-lg p-3 bg-white font-mono text-sm" dangerouslySetInnerHTML={{ __html: html }} />
            )}
        </div>
    );
};

const renderHtmlTable = (htmlString: string) => {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        const table = doc.querySelector('table');
        if (!table) return null;

        const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent?.trim() || '');
        const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr =>
            Array.from(tr.querySelectorAll('td, th')).map(cell => cell.textContent?.trim() || '')
        );

        return (
            <div className="overflow-x-auto mb-6">
                <table className="w-full border-collapse !border !border-primary">
                    <thead className="bg-cyan-50">
                        <tr className="bg-cyan-50">
                            {headers.map((h, i) => <th key={`${h}-${i}`} className="!border !border-primary px-4 py-2 text-left">{h}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr key={i}>
                                {row.map((cell, j) => <td key={`${i}-${j}`} className="!border !border-primary px-4 py-2">{cell}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    } catch (e) {
        return <div dangerouslySetInnerHTML={{ __html: htmlString }} />;
    }
};


const ResultsDisplay = ({ results, loading, error }: { results: any, loading: boolean, error: string }) => {
    if (loading) return <div className="text-center py-4">Loading...</div>;
    if (error) return <div className="text-red-500 bg-red-100 p-4 rounded-md">Error: {error}</div>;
    if (!results) return null;

    return (
        <Card className="mt-6 !border !border-primary rounded-lg">
            <CardHeader>
                <CardTitle className="flex items-center"><FaChartBar className="mr-2" /> Analysis Results</CardTitle>
            </CardHeader>
            <CardContent>
                {results.message && (
                    <div className={`p-4 rounded-md my-4 ${results.message.includes('Warning') ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                        <p>{results.message}</p>
                    </div>
                )}

                {results.model_summary && <ModelSummaryHtml html={results.model_summary} />}

                {results.blup_genotypes && (
                    <div className="my-4">
                        <h3 className="text-lg font-semibold mb-2">BLUPs for Genotypes</h3>
                        {renderHtmlTable(results.blup_genotypes)}
                    </div>
                )}

                {results.blue_fixed_effects && (
                    <div className="my-4">
                        <h3 className="text-lg font-semibold mb-2">BLUEs for Fixed Effects</h3>
                        {renderHtmlTable(results.blue_fixed_effects)}
                    </div>
                )}

                {results.broad_sense_heritability && (
                    <div className="my-4 bg-cyan-50 p-4 rounded-md">
                        <h3 className="text-lg font-semibold mb-2">Broad-sense Heritability (H²)</h3>
                        <p className="text-2xl font-bold">
                            {typeof results.broad_sense_heritability === 'number'
                                ? results.broad_sense_heritability.toFixed(4)
                                : results.broad_sense_heritability}
                        </p>
                    </div>
                )}

                {results.plots && (
                    <div className="mt-6">
                        <h3 className="text-lg font-semibold mb-2">Diagnostic Plots</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {results.plots.residuals_vs_fitted && (
                                <div className="!border !border-primary rounded-lg p-2">
                                <img src={`data:image/png;base64,${results.plots.residuals_vs_fitted}`} alt="Residuals vs Fitted" className="mx-auto" />
                                </div>
                            )}
                            {results.plots.qq_plot_residuals && (
                                <div className="!border !border-primary rounded-lg p-2">
                                    <img src={`data:image/png;base64,${results.plots.qq_plot_residuals}`} alt="Q-Q Plot" className="mx-auto" />
                                </div>
                            )}
                            {results.plots.influence_plot && (
                                <div className="!border !border-primary rounded-lg p-2">
                                    <img src={`data:image/png;base64,${results.plots.influence_plot}`} alt="Influence Plot" className="mx-auto" />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default function BlupPage() {
    const [file, setFile] = useState<File | null>(null);
    const [dataPreview, setDataPreview] = useState<any[]>([]);
    const [showAnalysisTabs, setShowAnalysisTabs] = useState(false);
    const [columnHeaders, setColumnHeaders] = useState<string[]>([]);
    const [results, setResults] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [availableSheets, setAvailableSheets] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState<string>("");

    // State for inputs
    const [dependentVar, setDependentVar] = useState("");
    const [genotypeVar, setGenotypeVar] = useState("");
    const [repVar, setRepVar] = useState("");
    const [blockVar, setBlockVar] = useState("");
    const [envVar, setEnvVar] = useState("");
    const [yearVar, setYearVar] = useState("");

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const f = e.target.files[0];
            setFile(f);
            setError("");
            setResults(null);
            setShowAnalysisTabs(false);
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
                    setShowAnalysisTabs(true);
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
                    setShowAnalysisTabs(true);
                }
            });
        }
    };

    const handleAnalyze = async () => {
        if (!file) {
            setError("Please upload a CSV or XLSX file.");
            return;
        }

        if (!dependentVar || !genotypeVar || !envVar || !yearVar || !repVar || !blockVar) {
            setError("Please select all required column mappings (Dependent, Genotype, Environment, Year, Replication, Block).");
            setLoading(false);
            return;
        }

        if (genotypeVar && repVar && genotypeVar === repVar) {
            setError("Genotype and Replication columns cannot be the same.");
            setLoading(false);
            return;
        }

        setLoading(true);
        setError("");
        setResults(null);

        const name = file.name.toLowerCase();
        const isXlsx = name.endsWith('.xlsx') || name.endsWith('.xls');

        const processAndFetch = (jsonData: string) => {
            const formData = new FormData();
            formData.append("data", jsonData);
            formData.append("dependent_var", dependentVar);
            formData.append("genotype_var", genotypeVar);
            formData.append("rep_var", repVar);
            formData.append("block_var", blockVar);
            formData.append("env_var", envVar);
            formData.append("year_var", yearVar);

            const serviceUrl = process.env.NEXT_PUBLIC_BLUP_SERVICE_URL || 'http://127.0.0.1:8080/blup';
            if (!serviceUrl) {
                setError("BLUP service URL is not configured");
                setLoading(false);
                return;
            }

            fetch(serviceUrl, { method: "POST", body: formData })
                .then(response => {
                    if (!response.ok) {
                        return response.text().then(text => { throw new Error(text || `Analysis failed (${response.status})`) });
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.error) {
                        throw new Error(data.error);
                    }
                    setResults(data);
                })
                .catch(err => {
                    setError(err.message || "An unexpected error occurred");
                })
                .finally(() => {
                    setLoading(false);
                });
        };

        if (isXlsx) {
            if (!selectedSheet) {
                setError("Please select a sheet for analysis.");
                setLoading(false);
                return;
            }
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    const data = new Uint8Array(reader.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheet = workbook.Sheets[selectedSheet];
                    if (!sheet) throw new Error("Selected sheet not found");
                    const json = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[];
                    processAndFetch(JSON.stringify(json));
                } catch (err: any) {
                    setError(err.message || "Failed to read XLSX for analysis");
                    setLoading(false);
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            const reader = new FileReader();
            reader.readAsText(file);
            reader.onload = async () => {
                const csvData = reader.result as string;
                const jsonData = JSON.stringify(parse(csvData, { header: true, skipEmptyLines: true }).data);
                processAndFetch(jsonData);
            };
        }
    };

    const handleReset = () => {
        setFile(null);
        setResults(null);
        setError("");
        setDataPreview([]);
        setShowAnalysisTabs(false);
        setColumnHeaders([]);
        setDependentVar("");
        setGenotypeVar("");
        setRepVar("");
        setBlockVar("");
        setEnvVar("");
        setYearVar("");
        setAvailableSheets([]);
        setSelectedSheet("");
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const renderColumnSelector = (value: string, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, placeholder: string) => (
        <select value={value} onChange={onChange} className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
            <option value="" disabled>{placeholder}</option>
            {columnHeaders.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
    );

    return (
        <div className="min-h-screen bg-background p-4">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center mb-4">
                        <h1 className="text-3xl font-bold">Alpha Lattice LMM Analysis</h1>
                    </div>
                    <p className="text-muted-foreground">Comprehensive Linear Mixed Model Analysis of Multi-Environment Alpha Lattice Trials with BLUP, Heritability, and Diagnostic Visualization.</p>
                </div>

                <Card className="mb-8 !border !border-primary rounded-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center"><Upload className="mr-2" /> Upload Data</CardTitle>
                        <CardDescription>Upload a .CSV or .XLSX file (max 1 MB). Select the sheet and process to see a preview.</CardDescription>
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
                        <CardHeader>
                            <CardTitle>Column Mapping</CardTitle>
                            <CardDescription>
                                Assign columns from your data to the model parameters. The model treats Genotype as a primary random effect for BLUPs, while other factors can be fixed or additional random effects (variance components).
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-md font-semibold text-muted-foreground">Response Variable</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                        {renderColumnSelector(dependentVar, e => setDependentVar(e.target.value), "Select Dependent Variable")}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-md font-semibold text-muted-foreground">Primary Random Effect (Genotype)</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                        {renderColumnSelector(genotypeVar, e => setGenotypeVar(e.target.value), "Select Genotype Variable")}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-md font-semibold text-muted-foreground">Fixed Effects</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                        {renderColumnSelector(yearVar, e => setYearVar(e.target.value), "Select Year Variable")}
                                        {renderColumnSelector(envVar, e => setEnvVar(e.target.value), "Select Environment Variable")}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-md font-semibold text-muted-foreground">Additional Random Effects (Variance Components)</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                        {renderColumnSelector(repVar, e => setRepVar(e.target.value), "Select Replication Variable")}
                                        {renderColumnSelector(blockVar, e => setBlockVar(e.target.value), "Select Block Variable")}
                                    </div>
                                </div>
                            </div>
                            <Button onClick={handleAnalyze} disabled={loading} variant="secondary" className="bg-gray-200 text-black-800 font-bold hover:bg-black-300 border border-gray-300">Run Analysis</Button>
                        </CardContent>
                    </Card>
                )}

                <ResultsDisplay results={results} loading={loading} error={error} />
            </div>
        </div>
    );
}
