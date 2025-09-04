'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Terminal, BarChart3, Upload, PlayCircle, FileText, Info, RotateCcw, ChevronDown } from "lucide-react";

type Step = 1 | 2 | 3 | 4;

// Re-implementing Alert and Label components locally as they are not found in the UI library
const Alert = ({ children, variant }: { children: React.ReactNode, variant?: string }) => (
  <div className={`mb-4 p-4 rounded-md ${variant === 'destructive' ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-blue-50 border border-blue-200 text-blue-800'}`}>
    {children}
  </div>
);
const AlertTitle = ({ children }: { children: React.ReactNode }) => <h5 className="font-bold mb-1 flex items-center"><Info className="h-4 w-4 mr-2" /> {children}</h5>;
const AlertDescription = ({ children }: { children: React.ReactNode }) => <div className="text-sm pl-6">{children}</div>;
const Label = (props: React.LabelHTMLAttributes<HTMLLabelElement>) => <label className="block mb-1 font-medium" {...props} />;

export default function NonParametricTestTool() {
  const [step, setStep] = useState<Step>(1);
  const [groups, setGroups] = useState('');
  const [sampleType, setSampleType] = useState('');
  const [dependentVar, setDependentVar] = useState('');
  const [recommendedTest, setRecommendedTest] = useState('');
  const [dataFile, setDataFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDataTypesVisible, setIsDataTypesVisible] = useState(false);

  const decisionTree: { [key: string]: string } = {
    '1--nominal': 'Chi-square goodness of fit',
    '2-independent-continuous': 'Mann-Whitney U test',
    '2-independent-ordinal': 'Mann-Whitney U test',
    '2-independent-nominal2': 'Chi-square (or Fisher’s exact)',
    '2-paired-continuous': 'Wilcoxon signed-rank',
    '2-paired-ordinal': 'Wilcoxon signed-rank',
    '2-paired-nominal2': 'McNemar’s test',
    '>2-independent-continuous': 'Kruskal-Wallis',
    '>2-independent-ordinal': 'Kruskal-Wallis',
    '>2-paired-continuous': 'Friedman test',
    '>2-paired-ordinal': 'Friedman test',
  };

  const testNameToKey: { [key: string]: string } = {
    'Chi-square goodness of fit': 'chi_square_goodness_of_fit',
    'Mann-Whitney U test': 'mann_whitney_u',
    'Kruskal-Wallis': 'kruskal_wallis',
    'Chi-square (or Fisher’s exact)': 'chi_square_independence',
    'Wilcoxon signed-rank': 'wilcoxon_signed_rank',
    'McNemar’s test': 'mcnemar',
    'Friedman test': 'friedman',
  };

  const dataFormatDescriptions: { [key: string]: string } = {
    'Chi-square goodness of fit': 'Your data should be in a single column representing the observed frequencies for each category. Optionally, a second column can be provided for expected frequencies. If no expected frequencies are given, they will be assumed to be equal.',
    'Mann-Whitney U test': 'Your CSV data should have exactly two columns, one for each independent group.',
    'Kruskal-Wallis': 'Your CSV data should have two or more columns, with each column representing a different group for comparison.',
    'Chi-square (or Fisher’s exact)': 'Your data should be a contingency table in CSV format (e.g., a 2x2 table representing observed frequencies). The file should not contain headers or index columns.',
    'Wilcoxon signed-rank': 'Your CSV data should have exactly two columns for paired data (e.g., \'before\' and \'after\' values for the same set of subjects).',
    'McNemar’s test': 'Requires a 2x2 contingency table in CSV format representing paired nominal data.',
    'Friedman test': 'Your CSV data should have at least three columns, where each column represents a repeated measure on the same subjects.',
  };

  const handleRecommendTest = () => {
    setError(null);
    const key = `${groups}-${sampleType}-${dependentVar}`;
    const test = decisionTree[key];
    if (test) {
      setRecommendedTest(test);
    } else {
      setRecommendedTest('');
      setError("No suitable test found for the selected combination.");
    }
  };

  const handleResetStep1 = () => {
    setGroups('');
    setSampleType('');
    setDependentVar('');
    setRecommendedTest('');
    setError(null);
  };

  const handleResetData = () => {
    setDataFile(null);
    setAnalysisResults(null);
    setError(null);
  };

  const handleResetAnalysis = () => {
    setStep(1);
    handleResetData();
    handleResetStep1();
  };

  const handleRunAnalysis = async () => {
    setError(null);
    setIsLoading(true);
    setAnalysisResults(null);

    const testKey = testNameToKey[recommendedTest];
    if (!testKey) {
        setError(`Invalid test name: ${recommendedTest}`);
        setIsLoading(false);
        return;
    }

    const formData = new FormData();
    formData.append('test_type', testKey);
    if (dataFile) {
      formData.append('file', dataFile);
    } else {
      setError("Please upload a file to run the analysis.");
      setIsLoading(false);
      return;
    }

    try {
      const nonpServiceUrl = process.env.NEXT_PUBLIC_NONP_SERVICE_URL || 'http://127.0.0.1:8080/nonp/analyze';
      const response = await fetch(nonpServiceUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Backend analysis failed.');
      }

      const results = await response.json();
      setAnalysisResults(results);
      setStep(4);
    } catch (e: any) {
      setError(`Analysis failed: ${e.message}.`);
      setAnalysisResults(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGroupsChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newGroups = e.target.value;
    setGroups(newGroups);
    if (newGroups === '1') {
        setSampleType(''); // Reset sample type
    }
  }

  const isStep1Complete = useMemo(() => {
    if (groups === '1') {
        return !!dependentVar;
    }
    return !!(groups && sampleType && dependentVar);
  }, [groups, sampleType, dependentVar]);

  const isDataProvided = useMemo(() => !!dataFile, [dataFile]);

  const selectClasses = "block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm";

  const renderStep1 = () => (
    <Card className="border border-blue-200 rounded-lg">
      <CardHeader>
        <CardTitle>Step 1: Select Analysis Parameters</CardTitle>
        <CardDescription>Choose the parameters that describe your data.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!recommendedTest ? (
          <>
            <div className="grid gap-2">
              <Label htmlFor="groups">How many groups do you want to compare?</Label>
              <select id="groups" value={groups} onChange={handleGroupsChange} className={selectClasses}>
                <option value="">Select...</option>
                <option value="1">1 group</option>
                <option value="2">2 groups</option>
                <option value=">2">More than 2 groups</option>
              </select>
            </div>
            {groups !== '1' && (
                <div className="grid gap-2">
                  <Label htmlFor="sampleType">Are your samples independent or paired?</Label>
                  <select id="sampleType" value={sampleType} onChange={(e) => setSampleType(e.target.value)} className={selectClasses}>
                    <option value="">Select...</option>
                    <option value="independent">Independent</option>
                    <option value="paired">Paired/Matched</option>
                  </select>
                </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="dependentVar">Type of dependent variable</Label>
              <select id="dependentVar" value={dependentVar} onChange={(e) => setDependentVar(e.target.value)} className={selectClasses}>
                <option value="">Select...</option>
                <option value="continuous">Continuous</option>
                <option value="ordinal">Ordinal</option>
                <option value="nominal">Nominal</option>
                <option value="nominal2">Nominal (2 categories)</option>
              </select>
            </div>
            <Button onClick={handleRecommendTest} disabled={!isStep1Complete} className="w-full">Get Recommendation</Button>
          </>
        ) : (
          <div className="text-center space-y-4 p-4">
            <Alert>
              <AlertTitle>Recommended Test</AlertTitle>
              <AlertDescription>
                <p className="text-lg font-bold text-blue-700">{recommendedTest}</p>
              </AlertDescription>
            </Alert>
            <div className="flex justify-center gap-4">
              <Button onClick={() => setStep(2)}>Next</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderStep2 = () => (
    <Card className="border border-blue-200 rounded-lg">
      <CardHeader>
        <CardTitle>Step 2: Upload Data</CardTitle>
        <CardDescription>Recommended Test: <span className="font-semibold">{recommendedTest}</span></CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {recommendedTest && dataFormatDescriptions[recommendedTest] && (
          <Alert>
            <AlertTitle>Expected Data Format</AlertTitle>
            <AlertDescription>
              {dataFormatDescriptions[recommendedTest]}
            </AlertDescription>
          </Alert>
        )}
        <div className="grid gap-2">
          <Label htmlFor="dataFile"><Upload className="h-4 w-4 mr-2 inline-block"/>Upload CSV file (max 1MB)</Label>
          <Input id="dataFile" type="file" accept=".csv" onChange={(e) => setDataFile(e.target.files ? e.target.files[0] : null)} />
          {dataFile && <p className="text-sm text-muted-foreground">Selected: {dataFile.name}</p>}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setStep(3)} disabled={!isDataProvided}>Next</Button>
          <Button variant="outline" onClick={handleResetData}>Reset</Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderStep3 = () => (
    <Card className="border border-blue-200 rounded-lg">
      <CardHeader>
        <CardTitle>Step 3: Run Analysis</CardTitle>
        <CardDescription>Ready to run <span className="font-semibold">{recommendedTest}</span>.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <Button onClick={handleRunAnalysis} disabled={isLoading || !isDataProvided}>
          <PlayCircle className="h-4 w-4 mr-2"/>
          {isLoading ? 'Analysis in progress...' : 'Analyze Data'}
        </Button>
        {isLoading && <div className="flex justify-center items-center pt-4"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}
      </CardContent>
    </Card>
  );

  const renderStep4 = () => (
    <Card className="border border-blue-200 rounded-lg">
      <CardHeader>
        <CardTitle>Step 4: Results</CardTitle>
        <CardDescription>The analysis is complete. Here are the results.</CardDescription>
      </CardHeader>
      <CardContent>
        {analysisResults && (
          <div className="space-y-4">
            <Alert>
              <div className="flex items-center">
                <Terminal className="h-4 w-4 mr-2" />
                <AlertTitle>Analysis Complete: {recommendedTest}</AlertTitle>
              </div>
              <AlertDescription>
                {Object.entries(analysisResults).map(([key, value]) => {
                    if (key === 'interpretation') return null;
                    const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    return <p key={key} className="mt-2"><strong>{formattedKey}:</strong> {String(value)}</p>;
                })}
                <p className="mt-4"><strong>Interpretation:</strong> {analysisResults.interpretation}</p>
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <BarChart3 className="h-8 w-8 text-blue-600 mr-3" />
            <h1 className="text-3xl font-bold">Non-Parametric Tests</h1>
          </div>
          <p className="text-muted-foreground">
            A step-by-step guide to help you choose and run the right non-parametric test.
          </p>
        </div>

        <Card className="mb-8 border border-blue-200 rounded-lg">
          <CardHeader className="cursor-pointer" onClick={() => setIsDataTypesVisible(!isDataTypesVisible)}>
            <div className="flex justify-between items-center">
                <div>
                    <CardTitle>Understanding Data Types</CardTitle>
                    <CardDescription>Click to expand and learn about data types.</CardDescription>
                </div>
                <ChevronDown className={`h-5 w-5 transform transition-transform ${isDataTypesVisible ? 'rotate-180' : ''}`} />
            </div>
          </CardHeader>
          {isDataTypesVisible && (
            <CardContent>
              <table className="w-full text-sm text-left">
                <thead className="border-b">
                  <tr>
                    <th className="pb-2 font-semibold">Data Type</th>
                    <th className="pb-2 font-semibold">What it is</th>
                    <th className="pb-2 font-semibold">Examples</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 align-top font-bold">Continuous</td>
                    <td className="py-2 align-top text-muted-foreground pr-4">Data that can take any numeric value within a range. It's measured, not counted.</td>
                    <td className="py-2 align-top">Crop yield (tons/hectare), soil pH, plant height.</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 align-top font-bold">Ordinal</td>
                    <td className="py-2 align-top text-muted-foreground pr-4">Categorical data with a clear order or ranking. The intervals between ranks aren't necessarily equal.</td>
                    <td className="py-2 align-top">Disease severity ("Low", "Medium", "High"), soil quality.</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 align-top font-bold">Nominal</td>
                    <td className="py-2 align-top text-muted-foreground pr-4">Categorical data with no intrinsic order or ranking.</td>
                    <td className="py-2 align-top">Crop type ("Wheat", "Corn"), soil type, treatment group.</td>
                  </tr>
                  <tr>
                    <td className="py-2 align-top font-bold">Count (Discrete)</td>
                    <td className="py-2 align-top text-muted-foreground pr-4">Data representing whole-number counts of an event. For this tool, treat it as Ordinal (to compare counts) or Nominal (if counts are categories).</td>
                    <td className="py-2 align-top">Number of fruits per plant, pest count, germinated seeds.</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          )}
        </Card>

        {error && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        
        <div className="flex items-start space-x-8">
          <div className="w-1/4">
            <ol className="space-y-4">
              {([1, 2, 3, 4] as Step[]).map((s, index) => (
                <li key={s} className="flex items-center space-x-3">
                  <span className={`flex items-center justify-center w-8 h-8 rounded-full text-lg ${step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>{s}</span>
                  <span className={`text-md ${step >= s ? 'font-semibold text-blue-700' : 'text-gray-500'}`}>
                    {['Parameters', 'Data', 'Analysis', 'Results'][index]}
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-8">
              <Button variant="outline" onClick={handleResetAnalysis} className="border-blue-500">
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset Analysis
              </Button>
            </div>
          </div>

          <div className="w-3/4">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
          </div>
        </div>
      </div>
    </div>
  );
}