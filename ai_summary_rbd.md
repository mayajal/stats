'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RbdAnalysisInputSchema = z.object({
  anova_table: z.string().describe('JSON string of the ANOVA table.'),
  tukey_results: z.record(z.string()).describe('JSON string of Tukey HSD results per factor.'),
  shapiro: z.object({
    stat: z.number(),
    p: z.number(),
  }).describe('Shapiro-Wilk test results.'),
  overall_cv: z.number().nullable().describe('Overall Coefficient of Variation.'),
  cd_value: z.number().nullable().describe('Critical Difference for Tukey HSD.'),
  factor_col: z.string().describe('The name of the factor column.'),
  block_col: z.string().describe('The name of the block column.'),
});

export type RbdAnalysisInput = z.infer<typeof RbdAnalysisInputSchema>;

const RbdSummaryOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the RBD analysis results.'),
});

export type RbdSummaryOutput = z.infer<typeof RbdSummaryOutputSchema>;

export async function getRbdSummary(input: RbdAnalysisInput): Promise<RbdSummaryOutput> {
  return rbdSummaryFlow(input);
}

const rbdSummaryPrompt = ai.definePrompt({
  name: 'rbdSummaryPrompt',
  input: {schema: RbdAnalysisInputSchema},
  output: {schema: RbdSummaryOutputSchema},
  prompt: `You are an expert statistical analyst. Summarize the following Randomized Block Design (RBD) analysis results.
  Focus on the key findings:
  - Is the main factor significant? (Refer to ANOVA table's PR(>F) for the factor_col)
  - Are there significant differences between factor levels based on Tukey HSD? (Refer to tukey_results and 'reject' column)
  - Are the residuals normally distributed? (Refer to Shapiro-Wilk test p-value)
  - Mention the Overall Coefficient of Variation (CV) and Critical Difference (CD) if available.

  Present the summary in a clear, concise, and easy-to-understand paragraph.

  RBD Analysis Results:
  ANOVA Table: {{{anova_table}}}
  Tukey HSD Results: {{{tukey_results}}}
  Shapiro-Wilk Test: {{{shapiro}}}
  Overall CV: {{{overall_cv}}}
  Critical Difference: {{{cd_value}}}
  Factor Column: {{{factor_col}}}
  Block Column: {{{block_col}}}

  Summary:
  `,
});

const rbdSummaryFlow = ai.defineFlow(
  {
    name: 'rbdSummaryFlow',
    inputSchema: RbdAnalysisInputSchema,
    outputSchema: RbdSummaryOutputSchema,
  },
  async (input) => {
    const {output} = await rbdSummaryPrompt(input);
    return output!;
  }
);
