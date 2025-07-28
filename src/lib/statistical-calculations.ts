
import type { DataRow, VariableMapping, AnalysisResult, AnalysisType } from '@/types';

/**
 * Performs a statistical analysis by sending data to a Python backend.
 *
 * @param data The dataset to be analyzed.
 * @param variables The mapping of variables for the analysis.
 * @param analysisType The type of analysis to perform.
 * @returns A promise that resolves to the analysis result from the backend.
 */
export async function performStatisticalAnalysis(
  data: DataRow[],
  variables: VariableMapping,
  analysisType: AnalysisType
): Promise<AnalysisResult> {
  console.log(`Sending data to Python backend for: ${analysisType}`);

  // URL for the Python backend.
  // This should be replaced with your actual deployed function URL.
  // For local development, you might run the Python server on a different port.
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
    
    // Return a structured error message that the frontend can display
    return {
      title: `Error: ${analysisType} Failed`,
      summaryTable: { 
        headers: ['Error'], 
        rows: [[`Could not connect to the Python backend at ${backendUrl}. Please ensure the backend server is running and accessible.`]] 
      },
      statistics: { 
        error: `Failed to fetch results from the Python backend. See browser console for more details.`,
        details: error instanceof Error ? error.message : String(error),
      }
    };
  }
}
