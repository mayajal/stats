'use server';

/**
 * @fileOverview A flow to provide statistical guidance based on a knowledge base.
 *
 * - getStatisticalGuidance - A function that takes a user's question and returns an answer based on a curated knowledge base.
 * - StatisticalGuidanceInput - The input type for the getStatisticalGuidance function.
 * - StatisticalGuidanceOutput - The return type for the getStatisticalGuidance function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import fs from 'fs';
import path from 'path';

const StatisticalGuidanceInputSchema = z.object({
  question: z.string().describe('The user\'s question about statistics.'),
});
export type StatisticalGuidanceInput = z.infer<typeof StatisticalGuidanceInputSchema>;

const StatisticalGuidanceOutputSchema = z.object({
  answer: z.string().describe('The AI-generated answer to the user\'s question, based on the provided knowledge base.'),
});
export type StatisticalGuidanceOutput = z.infer<typeof StatisticalGuidanceOutputSchema>;

export async function getStatisticalGuidance(input: StatisticalGuidanceInput): Promise<StatisticalGuidanceOutput> {
  return statisticalGuidanceFlow(input);
}

// Function to read knowledge base files
function getKnowledgeBase(): string {
  const dataDir = path.join(process.cwd(), 'src', 'ai', 'data');
  const fileNames = [
    'Guide_statistics_1.md',
    'common_mistakes_statistics.md',
    'common_statistical_tools.md',
  ];

  const knowledgeBase = fileNames
    .map(fileName => {
      try {
        return fs.readFileSync(path.join(dataDir, fileName), 'utf-8');
      } catch (error) {
        console.error(`Error reading file ${fileName}:`, error);
        return ''; // Return empty string if a file is not found or fails to read
      }
    })
    .join('\n\n---\n\n'); // Separate file contents clearly

  return knowledgeBase;
}


const prompt = ai.definePrompt({
  name: 'statisticalGuidancePrompt',
  input: {schema: z.object({
      question: StatisticalGuidanceInputSchema.shape.question,
      knowledgeBase: z.string(),
  })},
  output: {schema: StatisticalGuidanceOutputSchema},
  prompt: `You are a helpful AI assistant for the StatViz application. Your role is to provide clear and accurate guidance on statistical methods for agricultural research.

  You MUST base your answers exclusively on the information provided in the "Knowledge Base" section below. Do not use any external knowledge or make assumptions. If the answer cannot be found in the knowledge base, state that you do not have information on that topic.

  Keep your answers concise and easy to understand for someone new to statistics.

  Knowledge Base:
  ---
  {{{knowledgeBase}}}
  ---

  User's Question:
  "{{{question}}}"

  Answer:
  `,
});

const statisticalGuidanceFlow = ai.defineFlow(
  {
    name: 'statisticalGuidanceFlow',
    inputSchema: StatisticalGuidanceInputSchema,
    outputSchema: StatisticalGuidanceOutputSchema,
  },
  async (input) => {
    const knowledgeBase = getKnowledgeBase();
    const {output} = await prompt({ ...input, knowledgeBase });
    return output!;
  }
);
