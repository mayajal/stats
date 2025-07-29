'use server';
import { explainStatisticalResults, type ExplainStatisticalResultsInput } from '@/ai/flows/explain-statistical-results';
import { getStatisticalGuidance as getStatisticalGuidanceFlow, type StatisticalGuidanceInput } from '@/ai/flows/statistical-guide-flow';
import type { AnalysisResult, AnalysisType, DataRow, VariableMapping } from '@/types';

export async function getAIExplanation(input: ExplainStatisticalResultsInput): Promise<string> {
  try {
    const result = await explainStatisticalResults(input);
    return result.explanation;
  } catch (error) {
    console.error('Error getting AI explanation:', error);
    return 'An error occurred while generating the explanation. Please try again.';
  }
}

export async function getStatisticalGuidance(question: string): Promise<string> {
  try {
    const result = await getStatisticalGuidanceFlow({ question });
    return result.answer;
  } catch (error)
    {
    console.error('Error getting statistical guidance:', error);
    return 'An error occurred while getting guidance. Please try again.';
  }
}

export async function performAnalysisAction(
  data: DataRow[],
  variables: VariableMapping,
  analysisType: AnalysisType
): Promise<AnalysisResult> {
  // Using http://127.0.0.1:5001 which is the default for a local flask server
  const backendUrl = process.env.NEXT_PUBLIC_PYTHON_BACKEND_URL || 'http://127.0.0.1:5001/analyze';
  
  try {
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data,
        variables,
        analysisType,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Backend error response:', errorBody);
      throw new Error(`Backend returned an error: ${response.status} ${response.statusText}`);
    }

    const results: AnalysisResult = await response.json();
    return results;

  } catch (error) {
    console.error(`Error calling Python backend for ${analysisType}:`, error);
    return {
      title: `Error: ${analysisType} Failed`,
      summaryTable: { 
        headers: ['Error'], 
        rows: [[`Could not connect to the Python backend at ${backendUrl}. Please ensure the backend server is running and accessible.`]] 
      },
      statistics: { 
        error: `Failed to fetch results from the Python backend. See server console for details.` 
      },
    };
  }
}
