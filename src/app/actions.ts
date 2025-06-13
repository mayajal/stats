'use server';
import { explainStatisticalResults, type ExplainStatisticalResultsInput } from '@/ai/flows/explain-statistical-results';

export async function getAIExplanation(input: ExplainStatisticalResultsInput): Promise<string> {
  try {
    const result = await explainStatisticalResults(input);
    return result.explanation;
  } catch (error) {
    console.error('Error getting AI explanation:', error);
    return 'An error occurred while generating the explanation. Please try again.';
  }
}
