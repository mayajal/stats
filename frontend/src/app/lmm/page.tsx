/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Upload, ChevronDown } from 'lucide-react';
import { FaChartBar, FaMixer } from "react-icons/fa";
import { parse } from 'papaparse';
import * as XLSX from 'xlsx';

const cleanCell = (cell: string) => {
    if (typeof cell !== 'string') {
        return cell;
    }
    return cell.replace(/C\(Q\(\"([^\"]+)\"\)\)/g, '$1')
               .replace(/Q\(\"([^\"]+)\"\)/g, '$1')
               .replace(/(\w+)\[T\.\([^\\]+\) \\\\]/g, '$2');
};

const ModelSummaryHtml = ({ html, fixedEffects, randomEffects, treatmentLevels, locationLevels }: { html: string, fixedEffects: string[], randomEffects: string[], treatmentLevels: string[], locationLevels: string[] }) => {
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
                    const m = p.match(/^C\(([^)]+)\)\[T\.([^\\]+)\]$/);
                    if (m) {
                        return m[2];
                    }
                    // Q("name") or Q('name')
                    const q = p.match(/^Q\([\"']([^\"']+)["']\)$/);
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

                            const getEffectCategory = (effectName: string) => {
                                const cleanedEffectName = effectName.toLowerCase();
                                const fixedEffectNamesLower = fixedEffects.map(fe => fe.toLowerCase());
                                const randomEffectNamesLower = randomEffects.map(re => re.toLowerCase());

                                if (cleanedEffectName === 'intercept') {
                                    return 'Fixed';
                                }

                                // Check for Random effects (more robust heuristic)
                                for (const randEffect of randomEffectNamesLower) {
                                    // Look for the random effect name and 'group' (common in statsmodels output for random effects)
                                    // Or if it contains 'var' or 'cov' and the random effect name
                                    if (cleanedEffectName.includes(randEffect) && 
                                        (cleanedEffectName.includes('group') || cleanedEffectName.includes('var') || cleanedEffectName.includes('cov'))) {
                                        return 'Random';
                                    }
                                }

                                // Check for Interaction effects (after random effects, before main fixed effects)
                                if (cleanedEffectName.includes(':')) {
                                    // A simple check for ':' is often sufficient for interaction terms
                                    // We can optionally add a check that its components are fixed effects, but ':' is a strong indicator.
                                    // For now, let's rely on ':' as the primary indicator.
                                    return 'Interaction';
                                }

                                // Check for Main (Fixed) effects
                                for (const fixedEffect of fixedEffectNamesLower) {
                                    if (cleanedEffectName.includes(fixedEffect)) {
                                        return 'Fixed';
                                    }
                                }
                                
                                return 'Other'; // Fallback for anything not categorized
                            };

                            const fixedEffectRows: string[][] = [];
                            const randomEffectRows: string[][] = [];
                            const interactionEffectRows: string[][] = [];

                            dataRows.forEach(row => {
                                const effectName = String(row[0]);
                                const category = getEffectCategory(effectName);
                                if (category === 'Fixed' || category === 'Other') { // Group 'Other' with Fixed for now
                                    fixedEffectRows.push(row);
                                } else if (category === 'Random') {
                                    randomEffectRows.push(row);
                                } else if (category === 'Interaction') {
                                    interactionEffectRows.push(row);
                                }
                            });

                            // Sort rows within each category
                            fixedEffectRows.sort((a, b) => naturalSort(String(a[0]), String(b[0])));
                            randomEffectRows.sort((a, b) => naturalSort(String(a[0]), String(b[0])));
                            interactionEffectRows.sort((a, b) => naturalSort(String(a[0]), String(b[0])));

                            // Ensure Intercept is the first row in Fixed Effects
                            const interceptIndex = fixedEffectRows.findIndex(row => String(row[0]).toLowerCase() === 'intercept');
                            if (interceptIndex > -1) {
                                const interceptRow = fixedEffectRows.splice(interceptIndex, 1)[0];
                                fixedEffectRows.unshift(interceptRow);
                            }

                            const renderSubTable = (title: string, rowsToRender: string[][], tableHeaders: string[]) => {
                                if (rowsToRender.length === 0) return null;
                                return (
                                    <div key={`sub-table-${title}`} className="overflow-x-auto mb-4">
                                        <div className="text-sm font-semibold mb-1">{title}</div>
                                        <table className="w-full border-collapse !border !border-primary font-mono text-sm">
                                            <thead className="bg-cyan-50">
                                                <tr>
                                                    {tableHeaders.map((h, i) => (
                                                        <th key={`${h}-${i}`} className="!border !border-primary px-2 py-1 text-left">
                                                            {h}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rowsToRender.map((row, rIdx) => (
                                                    <tr key={`row-${rIdx}`}>
                                                        {row.map((cell, cIdx) => {
                                                            const cellValue = parseFloat(String(cell));
                                                            const isPValueCol = tableHeaders[cIdx] === 'P>|z|';
                                                            const bgColorClass = isPValueCol
                                                                ? (cellValue > 0.05 ? 'bg-pink-200' : 'bg-green-200')
                                                                : '';
                                                            return (
                                                                <td key={`cell-${rIdx}-${cIdx}`} className={`!border !border-primary px-3 py-1 ${bgColorClass} ${cIdx > 0 ? 'text-right' : ''}`}>
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
                            };

                            return (
                                <div key={`model-summary-param-estimates-${tIdx}`}>
                                    <div className="text-lg font-semibold mb-2">Parameter Estimates</div>
                                    <div className="text-sm text-muted-foreground mb-4 p-3 bg-blue-50 rounded-md border border-blue-200">
                                        <p><b>Interpretation of P-values (P&gt;|z|) for Fixed and Interaction Effects:</b></p>
                                        <ul>
                                            <li>If <b>P&gt;|z| &#60; 0.05</b>: The effect is statistically significant. This means the estimated coefficient is significantly different from zero, suggesting a real impact on the response variable.</li>
                                            <li>If <b>P&gt;|z| &#8805; 0.05</b>: The effect is not statistically significant. This means there is not enough evidence to conclude that the estimated coefficient is different from zero, suggesting its observed impact might be due to random chance.</li>
                                        </ul>
                                        <p className="mt-2">For interaction effects (e.g., &apos;Factor1:Factor2&apos;), the P-value indicates the significance of the combined effect of those factors.</p>
                                    </div>
                                    {renderSubTable('Main (Fixed) Effects', fixedEffectRows, headers)}
                                    {renderSubTable('Interaction Effects', interactionEffectRows, headers)}
                                    {renderSubTable('Random Effects', randomEffectRows, headers)}
                                </div>
                            );
                        }

                        // Original rendering for other tables (Model & Fit Statistics)
                        return (
                            <div key={`model-summary-table-${tIdx}`} className="overflow-x-auto">
                                <div className="text-sm font-semibold mb-1">{tableTitle}</div>
                                <table className="w-full border-collapse !border !border-primary font-mono text-sm">
                                    {headers.length > 0 && (
                                        <thead className="bg-cyan-50">
                                            <tr>
                                                {headers.map((h, i) => (
                                                    <th key={`${h}-${i}`} className="!border !border-primary px-2 py-1 text-left">
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
                                                    const isPValueCol = headers[cIdx] === 'P>|z|'; // Use headers here, not isParamEstimates
                                                    const bgColorClass = isPValueCol
                                                        ? (cellValue > 0.05 ? 'bg-pink-200' : 'bg-green-200')
                                                        : '';
                                                    return (
                                                        <td key={`cell-${rIdx}-${cIdx}`} className={`!border !border-primary px-3 py-1 ${bgColorClass}`}>
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
            console.error("Error rendering parsed tables:", e);
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

const naturalSort = (a: string, b: string) => {
    const regex = /(\d+)|(\D+)/g;
    const aParts = a.match(regex);
    const bParts = b.match(regex);

    if (!aParts || !bParts) {
        return a.localeCompare(b);
    }

    for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
        const aPart = aParts[i];
        const bPart = bParts[i];

        const aNum = parseInt(aPart);
        const bNum = parseInt(bPart);

        if (!isNaN(aNum) && !isNaN(bNum)) {
            if (aNum !== bNum) {
                return aNum - bNum;
            }
        } else {
            const comparison = aPart.localeCompare(bPart);
            if (comparison !== 0) {
                return comparison;
            }
        }
    }

    return aParts.length - bParts.length;
};

const renderResultsTable = (data: string | object) => { // data can be string or object
    let parsedData: any;

    try {
        if (typeof data === 'string') {
            if (data.includes('<table>')) {
                // Existing HTML table parsing logic
                const parser = new DOMParser();
                const doc = parser.parseFromString(data, 'text/html');
                const table = doc.querySelector('table');
                if (table) {
                    const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent?.trim() || '');
                    const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr =>
                        Array.from(tr.querySelectorAll('td, th')).map(cell => cell.textContent?.trim() || '')
                    ).sort((a, b) => String(a[0]).localeCompare(String(b[0]))); // Keep original sort for HTML tables
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
                }
            }
            // Try parsing as JSON if not an HTML table
            parsedData = JSON.parse(data);
        } else {
            // If data is already an object/array, use it directly
            parsedData = data;
        }

        if (Array.isArray(parsedData) && parsedData.length > 0) {
            const headers = Object.keys(parsedData[0]);
            const sortedParsed = parsedData.sort((a: any, b: any) => naturalSort(String(a[headers[0]]), String(b[headers[0]])));
            return (
                <div className="overflow-x-auto mb-6">
                    <table className="w-full border-collapse !border !border-primary">
                        <thead className="bg-cyan-50">
                            <tr className="bg-cyan-50">
                                {headers.map(h => <th key={h} className="!border !border-primary px-4 py-2 text-left">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedParsed.map((row: any, i: number) => (
                                <tr key={i}>
                                    {headers.map(h => (
                                        <td key={`${i}-${h}`} className="!border !border-primary px-4 py-2">
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
        // Handle object case (if needed, currently uses localeCompare)
        const objHeaders = Object.keys(parsedData);
        if (objHeaders.length > 0 && typeof (parsedData as any)[objHeaders[0]] === 'object') {
            const rowKeys = Object.keys((parsedData as any)[objHeaders[0]]).sort((a, b) => a.localeCompare(b));
            return (
                <div className="overflow-x-auto mb-6">
                    <table className="w-full border-collapse !border !border-primary">
                        <thead className="bg-cyan-50">
                            <tr className="bg-cyan-50">
                                <th className="!border !border-primary px-4 py-2 text-left"></th>
                                {objHeaders.map(h => <th key={h} className="!border !border-primary px-4 py-2 text-left">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {rowKeys.map(key => (
                                <tr key={key}>
                                    <td className="!border !border-primary px-4 py-2 font-medium">{key}</td>
                                    {objHeaders.map(h => (
                                        <td key={`${key}-${h}`} className="!border !border-primary px-4 py-2">
                                            {!isNaN(Number((parsedData as any)[h][key])) && (parsedData as any)[h][key] !== null && String((parsedData as any)[h][key]).trim() !== ''
                                                ? Number((parsedData as any)[h][key]).toFixed(2)
                                                : String((parsedData as any)[h][key])}
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

const VarianceComponentsTable = ({ components }: { components: { [key: string]: number } }) => {
    if (!components || Object.keys(components).length === 0) {
        return null;
    }

    // Ensure a specific order: user-defined random effects first, then Residual
    const randomEffectOrder = ["Replication", "Block", "Season"];
    const sortedKeys = Object.keys(components).sort((a, b) => {
        const aIndex = randomEffectOrder.indexOf(a);
        const bIndex = randomEffectOrder.indexOf(b);

        if (aIndex > -1 && bIndex > -1) return aIndex - bIndex; // Both are known random effects
        if (aIndex > -1) return -1; // a is known, b is not
        if (bIndex > -1) return 1;  // b is known, a is not
        if (a === 'Residual') return 1; // Push Residual to the end
        if (b === 'Residual') return -1;
        return a.localeCompare(b); // Fallback for other keys
    });

    return (
        <div className="my-4">
            <h3 className="text-lg font-semibold mb-2">Variance Components</h3>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse !border !border-primary font-mono text-sm">
                    <thead className="bg-cyan-50">
                        <tr>
                            <th className="!border !border-primary px-2 py-1 text-left">Component</th>
                            <th className="!border !border-primary px-2 py-1 text-right">Variance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedKeys.map(key => (
                            <tr key={key}>
                                <td className="!border !border-primary px-3 py-1">{key}</td>
                                <td className="!border !border-primary px-3 py-1 text-right">{Number(components[key]).toFixed(4)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="text-sm text-muted-foreground mt-2 p-3 bg-blue-50 rounded-md border border-blue-200">
                <p><b>Interpretation of Variance Components:</b></p>
                <ul className="list-disc pl-5 space-y-1">
                    <li>These values estimate how much of the total variation in the response variable is attributable to each random effect.</li>
                    <li>A higher variance indicates that the component contributes more to the overall variability.</li>
                    <li>A variance of 0 (e.g., for &apos;Replication&apos;) suggests that this factor did not contribute to the variation in this specific dataset, and the model simplified itself by removing this effect.</li>
                    <li><b>Residual</b> variance represents the random, unexplained variation or &quot;noise&quot; that remains after accounting for all effects in the model.</li>
                </ul>
            </div>
        </div>
    );
};

const ResultsDisplay = ({ results, loading, error, fixedEffects, randomEffects, treatmentLevels, locationLevels }: { results: any, loading: boolean, error: string, fixedEffects: string[], randomEffects: string[], treatmentLevels: string[], locationLevels: string[] }) => {
    if (loading) return <div className="text-center py-4">Loading...</div>;
    if (error) return <div className="text-red-500 bg-red-100 p-4 rounded-md">Error: {error}</div>;
    if (!results) return null;

    return (
        <Card className="mt-6 !border !border-primary rounded-lg">
            <CardHeader>
                <CardTitle className="flex items-center"><FaChartBar className="mr-2" /> Analysis Results</CardTitle>
            </CardHeader>
            <CardContent>
                {results.model_summary_html && <ModelSummaryHtml html={results.model_summary_html} fixedEffects={fixedEffects} randomEffects={randomEffects} treatmentLevels={treatmentLevels} locationLevels={locationLevels} />}

                {results.variance_components && <VarianceComponentsTable components={results.variance_components} />}

                {/* Diagnostics */}
                {results.plots && (
                    <div className="mt-6">
                        <h3 className="text-lg font-semibold mb-2">Diagnostic Plots</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {results.plots.residuals_vs_fitted && (
                                <div className="!border !border-primary rounded-lg p-2">
                                <img src={`data:image/png;base64,${results.plots.residuals_vs_fitted}`} alt="Residuals vs Fitted" className="mx-auto" />
                                </div>
                            )}
                            {results.plots.qq_plot && (
                                <div className="!border !border-primary rounded-lg p-2">
                                    
                                    <img src={`data:image/png;base64,${results.plots.qq_plot}`} alt="Q-Q Plot" className="mx-auto" />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {results.shapiro && (
                    <div className="bg-cyan-50 p-4 rounded-md my-4">
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

                

                                {/* Tukey HSD (hidden)
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
                */}

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
                        <div className="space-y-4"> {/* Use space-y for vertical stacking */}                            {results.plots.mean_bar_plot && (                                <div className="!border !border-primary rounded-lg p-2 w-full"> {/* w-full to ensure full width */}                                    
                                    <img src={`data:image/png;base64,${results.plots.mean_bar_plot}`} alt="Bar Plot" className="mx-auto" />
                                </div>
                            )}
                            {results.plots.mean_box_plot && (                                <div className="!border !border-primary rounded-lg p-2 w-full"> {/* w-full to ensure full width */}                                    
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
    const [availableSheets, setAvailableSheets] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState<string>("");

    // State for inputs
    const [responseCol, setResponseCol] = useState("");
    const [tukeyFactor, setTukeyFactor] = useState("");
    
    const [treatment, setTreatment] = useState("");
    const [location, setLocation] = useState("");
    const [replication, setReplication] = useState("");
    const [block, setBlock] = useState("");
    const [season, setSeason] = useState("");

    const [treatmentLevels, setTreatmentLevels] = useState<string[]>([]);
    const [locationLevels, setLocationLevels] = useState<string[]>([]);

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
                // Enforce 1 MB max for xlsx
                if (f.size > 1024 * 1024) {
                    setError("XLSX file too large. Max allowed size is 1 MB.");
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                    return;
                }
                // Read workbook to list sheets
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

                    if (treatment) {
                        const levels = Array.from(new Set(json.map(row => row[treatment]).filter(Boolean).map(String)));
                        setTreatmentLevels(levels);
                    }
                    if (location) {
                        const levels = Array.from(new Set(json.map(row => row[location]).filter(Boolean).map(String)));
                        setLocationLevels(levels);
                    }

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

                    const allData = result.data as any[];
                    if (treatment) {
                        const levels = Array.from(new Set(allData.map(row => row[treatment]).filter(Boolean).map(String)));
                        setTreatmentLevels(levels);
                    }
                    if (location) {
                        const levels = Array.from(new Set(allData.map(row => row[location]).filter(Boolean).map(String)));
                        setLocationLevels(levels);
                    }
                }
            });
        }
    };

    const handleAnalyze = async () => {
        if (!file) { setError("Please upload a CSV or XLSX file."); return; }
        setLoading(true);
        setError("");
        setResults(null);

        const processAndFetch = async (jsonData: string) => {
            const fixedEffects = [treatment, location].filter(Boolean);
            const randomEffects = [replication, block, season].filter(Boolean);

            const formData = new FormData();
            formData.append("data", jsonData);
            formData.append("response_col", responseCol);
            
            formData.append("tukey_factor", tukeyFactor);
            formData.append("fixed_effects", fixedEffects.join(','));
            formData.append("random_effects", randomEffects.join(','));

            try {
                const serviceUrl = process.env.NEXT_PUBLIC_LMM_SERVICE_URL || '';
                if (!serviceUrl) throw new Error("LMM service URL is not configured");
                const response = await fetch(serviceUrl, { method: "POST", body: formData });
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

        const name = file.name.toLowerCase();
        const isXlsx = name.endsWith('.xlsx') || name.endsWith('.xls');
        const reader = new FileReader();

        if (isXlsx) {
            if (!selectedSheet) { setError("Please select a sheet for analysis."); setLoading(false); return; }
            reader.onload = async () => {
                try {
                    const data = new Uint8Array(reader.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheet = workbook.Sheets[selectedSheet];
                    if (!sheet) throw new Error("Selected sheet not found");
                    const json = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[];
                    await processAndFetch(JSON.stringify(json));
                } catch (err: any) {
                    setError(err.message || "Failed to read XLSX for analysis");
                    setLoading(false);
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            reader.onload = async () => {
                const csvData = reader.result as string;
                const jsonData = JSON.stringify(parse(csvData, { header: true, skipEmptyLines: true }).data);
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
        setShowAnalysisTabs(false);
        setColumnHeaders([]);
        setResponseCol("");
        
        setTukeyFactor("");
        setTreatment("");
        setLocation("");
        setReplication("");
        setBlock("");
        setSeason("");
        setAvailableSheets([]);
        setSelectedSheet("");
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
                        <FaMixer style={{ height: '2rem', width: '2rem', color: '#2563eb', marginRight: '0.75rem' }} />
                        <h1 className="text-3xl font-bold">Linear Mixed Model (LMM)</h1>
                    </div>
                    <p className="text-muted-foreground">Analyze data with both fixed and random effects using Linear Mixed Model.  This model assumes that the effect of a fixed effect (eg genotype) on response variable (eg. yield) might be different depending on the Location. For example, Genotype A might be the best in Location 1, but Genotype B might be the best in Location 2. This model is ideal if you want to find the best-performing genotype for each specific location.</p>
                    
                    <p className="text-muted-foreground">In case you want to just measure the average effect of each genotype use <a href="https://vita.chloropy.com/alpha" target="_blank" rel="noopener noreferrer" className="font-bold underline text-blue-600">Alpha Lattice Design</a>.</p>
                
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
                        <CardHeader><CardTitle>Model Specification</CardTitle></CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="response-col">Response Variable <span className="text-red-500">*</span></label>
                                        {renderColumnSelector(responseCol, setResponseCol, "Select Response")}
                                    </div>
                                    <div>
                                        <h4 className="font-medium mb-2">Fixed Variables</h4>
                                        <div className="space-y-2">
                                            <div>
                                                <label>Fixed (1) <span className="text-red-500">*</span></label>
                                                {renderColumnSelector(treatment, setTreatment, "Select Fixed (1)")}
                                            </div>
                                            <div>
                                                <label>Fixed (2) optional</label>
                                                {renderColumnSelector(location, setLocation, "Select Fixed (2)", true)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="tukey-factor">Factor for Tukey&apos;s Test <span className="text-red-500">*</span></label>
                                        {renderColumnSelector(tukeyFactor, setTukeyFactor, "Select Tukey Factor")}
                                    </div>
                                    <div>
                                        <h4 className="font-medium mb-2">Random Variables</h4>
                                        <div className="space-y-2">
                                            <div>
                                                <label>Random (1) <span className="text-red-500">*</span></label>
                                                {renderColumnSelector(replication, setReplication, "Select Random (1)")}
                                            </div>
                                            <div>
                                                <label>Random (2) <span className="text-red-500">*</span></label>
                                                {renderColumnSelector(block, setBlock, "Select Random (2)")}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <Button onClick={handleAnalyze} disabled={loading || !responseCol || !treatment || !replication || !block} variant="secondary" className="bg-gray-200 text-black-800 font-bold hover:bg-black-300 border border-gray-300">
                                {loading ? "Analyzing..." : "Run Analysis"}
                            </Button>
                            <p className="text-sm text-muted-foreground">may take 30s to finish analysis</p>
                        </CardContent>
                    </Card>
                )}

                <ResultsDisplay
                    results={results}
                    loading={loading}
                    error={error}
                    fixedEffects={[treatment, location].filter(Boolean)}
                    randomEffects={[replication, block, season].filter(Boolean)}
                    treatmentLevels={treatmentLevels}
                    locationLevels={locationLevels}
                />
            </div>
        </div>
    );
}