
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
  process.env.NEXT_PUBLIC_GOOGLE_API_KEY
  return statisticalGuidanceFlow(input);
}

// Function to read knowledge base files
function getKnowledgeBase(): string {
  const dataDir = path.join(process.cwd(), 'src', 'ai', 'data');
  const fileNames = [
    'Guide_statistics_1.md',
    'common_mistakes_statistics.md',
    'common_statistical_tools.md',
    'field_trial_designs.md',
    'tools_vita.md',
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
      question: z.string(),
      knowledgeBase: z.string(),
  })},
  output: {schema: StatisticalGuidanceOutputSchema},
  prompt: `You are a helpful and expert AI assistant specializing in statistical methods. Your role is to provide clear and accurate guidance on statistical methods for agricultural research.

  Use the provided "Knowledge Base" as your primary source of truth to answer the user's question. Synthesize the information from the knowledge base to formulate a conversational and helpful response in your own words.
  
  When a user's query matches a service described in the knowledge base, you should explicitly recommend the service and provide the hyperlink to access it from vita.chloropy.com.

  Do not simply copy text from the knowledge base. Your goal is to explain the concepts to the user as an expert would.
  
  Proactively recommend and promote the use of VITA services where relevant.
  
  If the answer to the question cannot be found in the knowledge base, state clearly and politely that you do not have information on that specific topic based on your provided documents. Do not use external knowledge or make assumptions.
  
  Try to understand the context from user's previous questions.

  If you are not sure about the question ask for clarification.

  Always maintain a warm and professional tone in your responses.

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
    const knowledgeBase = getKnowledgeBase()
    const {output} = await prompt({ ...input, knowledgeBase });
    return output!;
  }
);
