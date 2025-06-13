'use client';

import React, { useState } from 'react';
import type { AnalysisResult, AnalysisType } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Download, Wand2, AlertCircle, CheckCircle } from 'lucide-react';
import { getAIExplanation } from '@/app/actions'; // Server Action
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

interface ResultsDisplayStepProps {
  results: AnalysisResult | null;
  analysisType: AnalysisType | null; // Needed for AI explanation context
  statisticalContext?: string; // Additional context for AI like variable names, data summary
}

export function ResultsDisplayStep({ results, analysisType, statisticalContext = "No additional context provided." }: ResultsDisplayStepProps) {
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const { toast } = useToast();

  const handleGetAIExplanation = async () => {
    if (!results || !analysisType) {
      toast({ title: "Error", description: "No results or analysis type available to explain.", variant: "destructive" });
      return;
    }
    setIsLoadingAI(true);
    setAiExplanation(null);
    try {
      // Prepare a string representation of the results
      let resultsString = `Analysis Title: ${results.title}\n`;
      if (results.statistics) {
        resultsString += `Key Statistics: ${JSON.stringify(results.statistics)}\n`;
      }
      if (results.summaryTable) {
        resultsString += `Summary Table: ${results.summaryTable.headers.join(', ')}\n${results.summaryTable.rows.map(row => row.join(', ')).join('\n')}\n`;
      }
      if (results.regressionCoefficients) {
        resultsString += `Regression Coefficients: ${results.regressionCoefficients.map(c => `${c.term}: est=${c.estimate}, pval=${c.pValue}`).join('; ')}\n`;
      }
      if (results.postHocTests) {
        resultsString += `Post-hoc Tests (${results.postHocTests.testName}): ${results.postHocTests.results.map(r => `${r.comparison}: diff=${r.diff}, pval=${r.pValue}`).join('; ')}\n`;
      }
      resultsString += `\nUser context: ${statisticalContext}`;


      const explanation = await getAIExplanation({
        statisticalResults: resultsString,
        analysisType: analysisType,
      });
      setAiExplanation(explanation);
      toast({ title: "AI Explanation Ready", description: "The explanation has been generated.", variant: "default" });
    } catch (error) {
      console.error("AI Explanation Error:", error);
      toast({ title: "AI Error", description: "Failed to get AI explanation.", variant: "destructive" });
      setAiExplanation("Sorry, I couldn't generate an explanation at this time.");
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleDownloadPDF = () => {
    toast({ title: "PDF Download", description: "Preparing PDF for download..." });
    // Best effort client-side PDF via print
    const printContents = document.getElementById('results-content')?.innerHTML;
    const originalContents = document.body.innerHTML;

    if (printContents) {
        // Temporarily set body to only results content for printing
        // This is a basic approach, more sophisticated methods exist.
        // A dedicated PDF library would offer better control.
        document.body.innerHTML = `<div class="print-container p-8">${printContents}</div>
        <style>
          body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
          .print-container { width: 100%; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          h2, h3, h4 { font-family: 'Space Grotesk', sans-serif; margin-bottom: 0.5rem; }
          .ai-explanation { margin-top: 1rem; padding: 1rem; border: 1px solid #eee; border-radius: 0.5rem; background-color: #f9f9f9; }
        </style>
        `;
        window.print();
        document.body.innerHTML = originalContents; // Restore original content
        // Re-attach event listeners if needed, or simply reload for complex apps.
        // For this app, it might be acceptable to just restore. A better way is a dedicated print view.
        window.location.reload(); // Easiest way to restore state and listeners in a complex app
    } else {
        toast({ title: "PDF Error", description: "Could not find results content to print.", variant: "destructive" });
    }
  };

  if (!results) {
    return (
      <Card className="text-center">
        <CardHeader>
          <CardTitle className="font-headline">No Results</CardTitle>
        </CardHeader>
        <CardContent>
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p>Statistical analysis has not been performed or no results are available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div id="results-content" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-xl">{results.title}</CardTitle>
          {analysisType && <CardDescription>Results for {analysisType} analysis.</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-4">
          {results.summaryTable && (
            <div>
              <h3 className="font-headline text-lg mb-2">Summary Table</h3>
              <ScrollArea className="w-full whitespace-nowrap rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {results.summaryTable.headers.map((header, i) => <TableHead key={i}>{header}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.summaryTable.rows.map((row, i) => (
                      <TableRow key={i}>
                        {row.map((cell, j) => <TableCell key={j}>{typeof cell === 'number' ? cell.toFixed(3) : cell}</TableCell>)}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          )}

          {results.statistics && (
            <div>
              <h3 className="font-headline text-lg mb-2">Key Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(results.statistics).map(([key, value]) => (
                  <div key={key} className="p-3 border rounded-md bg-muted/30">
                    <p className="text-sm font-medium text-muted-foreground">{key}</p>
                    <p className="text-lg font-semibold">{typeof value === 'number' ? value.toFixed(3) : value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.regressionCoefficients && (
             <div>
              <h3 className="font-headline text-lg mb-2">Regression Coefficients</h3>
              <ScrollArea className="w-full whitespace-nowrap rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Term</TableHead>
                      <TableHead>Estimate</TableHead>
                      <TableHead>Std. Error</TableHead>
                      <TableHead>t-value</TableHead>
                      <TableHead>p-value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.regressionCoefficients.map((coef, i) => (
                      <TableRow key={i}>
                        <TableCell>{coef.term}</TableCell>
                        <TableCell>{coef.estimate.toFixed(3)}</TableCell>
                        <TableCell>{coef.stdError.toFixed(3)}</TableCell>
                        <TableCell>{coef.tValue.toFixed(2)}</TableCell>
                        <TableCell>{typeof coef.pValue === 'number' ? coef.pValue.toFixed(4) : coef.pValue}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          )}

          {results.postHocTests && (
            <div>
              <h3 className="font-headline text-lg mb-2">{results.postHocTests.testName} Results</h3>
              <ScrollArea className="w-full whitespace-nowrap rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Comparison</TableHead>
                      <TableHead>Difference</TableHead>
                      <TableHead>Lower CI</TableHead>
                      <TableHead>Upper CI</TableHead>
                      {results.postHocTests.results[0]?.qValue !== undefined && <TableHead>q-value</TableHead>}
                      <TableHead>p-value</TableHead>
                      <TableHead>Significant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.postHocTests.results.map((res, i) => (
                      <TableRow key={i} className={res.significant ? 'bg-green-500/10' : ''}>
                        <TableCell>{res.comparison}</TableCell>
                        <TableCell>{res.diff.toFixed(3)}</TableCell>
                        <TableCell>{res.lower.toFixed(3)}</TableCell>
                        <TableCell>{res.upper.toFixed(3)}</TableCell>
                        {res.qValue !== undefined && <TableCell>{res.qValue.toFixed(2)}</TableCell>}
                        <TableCell>{res.pValue.toFixed(4)}</TableCell>
                        <TableCell>
                            {res.significant ? <CheckCircle className="h-5 w-5 text-green-600"/> : <AlertCircle className="h-5 w-5 text-yellow-600"/>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          )}

          {results.rawOutput && (
            <div>
              <h3 className="font-headline text-lg mb-2">Raw Output</h3>
              <pre className="p-4 bg-muted/50 rounded-md text-sm overflow-auto max-h-60">{results.rawOutput}</pre>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-xl">AI-Powered Explanation</CardTitle>
          <CardDescription>Get an AI-generated explanation of your statistical results.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleGetAIExplanation} disabled={isLoadingAI}>
            <Wand2 className="mr-2 h-4 w-4" />
            {isLoadingAI ? 'Generating Explanation...' : 'Explain Results with AI'}
          </Button>
          {aiExplanation && (
            <div className="mt-4 p-4 border rounded-md bg-background shadow prose prose-sm max-w-none ai-explanation">
              <h4 className="font-headline text-md">Explanation:</h4>
              <div dangerouslySetInnerHTML={{ __html: aiExplanation.replace(/\n/g, '<br />') }} />
            </div>
          )}
        </CardContent>
      </Card>
      
      <Separator />

      <div className="text-center">
        <Button onClick={handleDownloadPDF} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Download Results as PDF
        </Button>
      </div>
    </div>
  );
}
