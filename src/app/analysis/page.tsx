
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DataUploadStep } from '@/components/statviz/data-upload-step';
import { VariableDefinitionStep } from '@/components/statviz/variable-definition-step';
import { AnalysisSelectionStep } from '@/components/statviz/analysis-selection-step';
import { ResultsDisplayStep } from '@/components/statviz/results-display-step';
import { StepWrapper } from '@/components/statviz/step-wrapper';
import { Button } from '@/components/ui/button';
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Sparkles, BarChart3 } from 'lucide-react';
import type { DataRow, ColumnDefinition, VariableMapping, AnalysisType, AnalysisResult } from '@/types';
import { performStatisticalAnalysis } from '@/lib/statistical-calculations'; // Mocked
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';

const TOTAL_STEPS = 4;

export default function StatVizAnalysisPage() {
  const [currentStep, setCurrentStep] = useState<number>(1);
  
  // Step 1 State
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<DataRow[]>([]);
  const [columns, setColumns] = useState<ColumnDefinition[]>([]);
  
  // Step 2 State
  const [variableMapping, setVariableMapping] = useState<VariableMapping>({
    dependentVariable: null,
    independentVariables: [],
    valuesColumn: null,
    covariates: [],
  });

  // Step 3 State
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisType | null>(null);

  // Step 4 State
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const { toast } = useToast();

  const progress = (currentStep / TOTAL_STEPS) * 100;

  const handleDataProcessed = useCallback((data: DataRow[], cols: ColumnDefinition[], name: string) => {
    setParsedData(data);
    setColumns(cols);
    setFileName(name);
    // Reset downstream states if new data is uploaded
    setVariableMapping({ dependentVariable: null, independentVariables: [], valuesColumn: null, covariates: [] });
    setSelectedAnalysis(null);
    setAnalysisResults(null);
    toast({ title: "Data Ready", description: `${name} processed. Define variables next.`, });
  }, [toast]);

  const handleVariablesDefined = useCallback((mapping: VariableMapping) => {
    setVariableMapping(mapping);
  }, []);

  const handleAnalysisSelected = useCallback((analysis: AnalysisType) => {
    setSelectedAnalysis(analysis);
  }, []);
  
  const runAnalysis = useCallback(() => {
    if (!selectedAnalysis || !variableMapping.dependentVariable || variableMapping.independentVariables.length === 0) {
       toast({
        title: "Analysis Error",
        description: "Please select an analysis type and define at least one dependent and one independent variable.",
        variant: "destructive",
      });
      return;
    }
    setIsCalculating(true);
    try {
      // Simulate delay for calculation
      setTimeout(() => {
        const results = performStatisticalAnalysis(parsedData, variableMapping, selectedAnalysis);
        setAnalysisResults(results);
        setIsCalculating(false);
        setCurrentStep(4);
        toast({ title: "Analysis Complete", description: `Results for ${selectedAnalysis} are ready.`, });
      }, 1500); // 1.5s mock delay
    } catch (error) {
      console.error("Error performing analysis:", error);
      toast({ title: "Analysis Failed", description: `An error occurred during ${selectedAnalysis} calculation.`, variant: "destructive" });
      setIsCalculating(false);
    }
  }, [selectedAnalysis, parsedData, variableMapping, toast]);


  const nextStep = () => {
    if (currentStep === 1 && parsedData.length === 0) {
      toast({ title: "No Data", description: "Please upload and process a data file first.", variant: "destructive" });
      return;
    }
     if (currentStep === 2 && (!variableMapping.dependentVariable || variableMapping.independentVariables.length === 0)) {
      toast({ title: "Variables Needed", description: "Please define at least one dependent and one independent variable.", variant: "destructive" });
      return;
    }
    if (currentStep === 3 && !selectedAnalysis) {
      toast({ title: "Analysis Type Needed", description: "Please select a statistical analysis type.", variant: "destructive" });
      return;
    }

    if (currentStep === 3 && selectedAnalysis) { // Transition from step 3 to 4 means run analysis
      runAnalysis();
      // setCurrentStep is handled by runAnalysis after completion
    } else if (currentStep < TOTAL_STEPS) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };
  
  const startOver = () => {
    setCurrentStep(1);
    setFileName(null);
    setParsedData([]);
    setColumns([]);
    setVariableMapping({ dependentVariable: null, independentVariables: [], valuesColumn: null, covariates: [] });
    setSelectedAnalysis(null);
    setAnalysisResults(null);
    toast({ title: "Workflow Reset", description: "Starting over. Please upload your data.", });
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return "Upload & Prepare Data";
      case 2: return "Define Variables";
      case 3: return "Select Statistical Analysis";
      case 4: return "View Results & Interpretation";
      default: return "";
    }
  };

  const getStepDescription = () => {
     switch (currentStep) {
      case 1: return "Upload your .csv or .xlsx file and preview your data.";
      case 2: return "Assign columns from your data to their roles in the analysis (e.g., dependent, independent).";
      case 3: return "Choose the statistical test you want to perform on your data.";
      case 4: return "Review the statistical output, get AI explanations, and download your findings.";
      default: return "";
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 flex flex-col items-center min-h-screen">
       <header className="mb-8 text-center w-full flex justify-between items-center">
        <Link href="/" passHref>
            <Button variant="outline" size="sm"> &larr; Home</Button>
        </Link>
        <div className="flex items-center justify-center">
          <BarChart3 className="h-10 w-10 text-primary mr-3" />
          <h1 className="font-headline text-4xl font-bold tracking-tight">StatViz</h1>
        </div>
        <div style={{width: '80px'}}></div>
      </header>

      <div className="w-full max-w-4xl mb-6">
          <Progress value={progress} className="w-full h-3" />
          <p className="text-sm text-muted-foreground mt-1 text-center">Step {currentStep} of {TOTAL_STEPS}: {getStepTitle()}</p>
      </div>

      {currentStep === 1 && (
        <StepWrapper title={getStepTitle()} description={getStepDescription()} onNext={nextStep} isNextDisabled={parsedData.length === 0 || columns.length === 0}>
          <DataUploadStep onDataProcessed={handleDataProcessed} />
        </StepWrapper>
      )}

      {currentStep === 2 && (
        <StepWrapper title={getStepTitle()} description={getStepDescription()} onNext={nextStep} onBack={prevStep} isNextDisabled={!variableMapping.dependentVariable || variableMapping.independentVariables.length === 0}>
          <VariableDefinitionStep columns={columns} onVariablesDefined={handleVariablesDefined} initialMapping={variableMapping} />
        </StepWrapper>
      )}

      {currentStep === 3 && (
        <StepWrapper title={getStepTitle()} description={getStepDescription()} onNext={nextStep} onBack={prevStep} nextButtonText="Run Analysis" isNextDisabled={!selectedAnalysis || isCalculating} isLoading={isCalculating}>
          <AnalysisSelectionStep selectedAnalysis={selectedAnalysis} onAnalysisSelected={handleAnalysisSelected} />
        </StepWrapper>
      )}

      {currentStep === 4 && (
        <StepWrapper title={getStepTitle()} description={getStepDescription()} onBack={prevStep} nextButtonText="Start New Analysis" onNext={startOver} isFinalStep>
            {isCalculating ? (
                <div className="text-center p-10">
                    <Sparkles className="mx-auto h-12 w-12 text-primary animate-pulse mb-4" />
                    <p className="text-lg font-semibold">Calculating results for {selectedAnalysis}...</p>
                    <p className="text-muted-foreground">Please wait a moment.</p>
                </div>
            ) : analysisResults ? (
                 <ResultsDisplayStep results={analysisResults} analysisType={selectedAnalysis} statisticalContext={`Variables used - Dependent: ${variableMapping.dependentVariable}, Independent: ${variableMapping.independentVariables.join(', ')}.`}/>
            ) : (
                 <Card className="text-center">
                    <CardHeader>
                        <CardTitle className="font-headline">Error</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
                        <p>Could not generate analysis results. Please check your selections and try again.</p>
                        <Button onClick={prevStep} variant="outline" className="mt-4">Go Back</Button>
                    </CardContent>
                 </Card>
            )}
        </StepWrapper>
      )}
       <footer className="mt-12 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} StatViz. All rights reserved.</p>
        <p>Powered by Next.js, ShadCN/UI, and Genkit AI.</p>
      </footer>
    </div>
  );
}
