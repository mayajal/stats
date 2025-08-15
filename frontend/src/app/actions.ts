
'use server';

import {
  getStatisticalGuidance as getStatisticalGuidanceFlow,
  type StatisticalGuidanceInput,
  type StatisticalGuidanceOutput,
} from '@/ai/flows/statistical-guide-flow';
import {
  rbdAnalysisFlow as rbdAnalysisFlowGenkit,
  rbdAnalysisInputSchema,
} from '@/ai/flows/rbd-analysis-flow';
import { z } from 'zod';
import {
  frbdAnalysisFlow as frbdAnalysisFlowGenkit,
  frbdAnalysisInputSchema,
} from '@/ai/flows/frbd-analysis-flow';

export async function getStatisticalGuidance(
  input: StatisticalGuidanceInput
): Promise<StatisticalGuidanceOutput> {
  return await getStatisticalGuidanceFlow({...input});
}

export async function generateRbdAnalysisSummary(
  input: z.infer<typeof rbdAnalysisInputSchema>
): Promise<string> {
  return await rbdAnalysisFlowGenkit(input);
}

export async function generateFrbdAnalysisSummary(
  input: z.infer<typeof frbdAnalysisInputSchema>
): Promise<string> {
  return await frbdAnalysisFlowGenkit(input);
}
