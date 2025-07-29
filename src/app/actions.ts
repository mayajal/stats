
'use server';
import { getStatisticalGuidance as getStatisticalGuidanceFlow } from '@/ai/flows/statistical-guide-flow';

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
