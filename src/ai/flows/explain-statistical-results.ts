'use server';

/**
 * @fileOverview A flow to explain statistical results in a user-friendly manner.
 *
 * - explainStatisticalResults - A function that takes statistical results as input and returns an AI-powered explanation.
 * - ExplainStatisticalResultsInput - The input type for the explainStatisticalResults function.
 * - ExplainStatisticalResultsOutput - The return type for the explainStatisticalResults function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExplainStatisticalResultsInputSchema = z.object({
  statisticalResults: z.string().describe('The statistical results to explain.'),
  analysisType: z.string().describe('The type of statistical analysis performed (e.g., ANOVA, Linear Regression).'),
});
export type ExplainStatisticalResultsInput = z.infer<typeof ExplainStatisticalResultsInputSchema>;

const ExplainStatisticalResultsOutputSchema = z.object({
  explanation: z.string().describe('A user-friendly explanation of the statistical results.'),
});
export type ExplainStatisticalResultsOutput = z.infer<typeof ExplainStatisticalResultsOutputSchema>;

export async function explainStatisticalResults(input: ExplainStatisticalResultsInput): Promise<ExplainStatisticalResultsOutput> {
  return explainStatisticalResultsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'explainStatisticalResultsPrompt',
  input: {schema: ExplainStatisticalResultsInputSchema},
  output: {schema: ExplainStatisticalResultsOutputSchema},
  prompt: `You are an AI assistant that explains statistical results in a way that is easy to understand for people who are new to statistics.

  You will be provided with the statistical results and the type of analysis that was performed.

  Based on this information, generate an explanation of the statistical results that is clear, concise, and easy to understand.

  Statistical Results:
  {{statisticalResults}}

  Type of Analysis:
  {{analysisType}}

  Explanation:
  `,
});

const explainStatisticalResultsFlow = ai.defineFlow(
  {
    name: 'explainStatisticalResultsFlow',
    inputSchema: ExplainStatisticalResultsInputSchema,
    outputSchema: ExplainStatisticalResultsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
