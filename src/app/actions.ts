
'use server';

import {
  getStatisticalGuidance as getStatisticalGuidanceFlow,
  type StatisticalGuidanceInput,
  type StatisticalGuidanceOutput,
} from '@/ai/flows/statistical-guide-flow';

export async function getStatisticalGuidance(
  input: StatisticalGuidanceInput
): Promise<StatisticalGuidanceOutput> {
  return await getStatisticalGuidanceFlow(input);
}
