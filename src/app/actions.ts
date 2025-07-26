'use server';
import { explainStatisticalResults, type ExplainStatisticalResultsInput } from '@/ai/flows/explain-statistical-results';
import { getStatisticalGuidance as getStatisticalGuidanceFlow, type StatisticalGuidanceInput } from '@/ai/flows/statistical-guide-flow';

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
  } catch (error) {
    console.error('Error getting statistical guidance:', error);
    return 'An error occurred while getting guidance. Please try again.';
  }
}
