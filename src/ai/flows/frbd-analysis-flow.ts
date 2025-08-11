import { z } from 'zod';
import { ai } from '../genkit';

const anovaTableSchema = z.string();
const tukeyResultsSchema = z.record(z.string());
const shapiroSchema = z.object({
  stat: z.number(),
  p: z.number(),
});
const meanSeparationResultsSchema = z.record(z.string());

export const frbdAnalysisInputSchema = z.object({
  anova_table: anovaTableSchema,
  tukey_results: tukeyResultsSchema,
  shapiro: shapiroSchema,
  mean_separation_results: meanSeparationResultsSchema,
  overall_cv: z.number(),
  cd_value: z.number().nullable(),
});


export const frbdAnalysisFlow = ai.defineFlow(
  {
    name: 'frbdAnalysisFlow',
    inputSchema: frbdAnalysisInputSchema,
    outputSchema: z.string(),
  },
  async (input) => {
    if (!input.anova_table || typeof input.anova_table !== 'string') {
        throw new Error('anova_table must be a valid string');
    }

    const formatResultsWithLetters = (results: any) => {
        try {
            const parsed = JSON.parse(results);
            if (Array.isArray(parsed) && parsed.length > 0) {
                const hasSignificance = parsed[0].hasOwnProperty('Significance');
                const hasGroup = parsed[0].hasOwnProperty('Group');

                if (hasSignificance || hasGroup) {
                    return parsed.map((row: any) => {
                        const treatment = row[Object.keys(row)[0]];
                        const mean = row[Object.keys(row)[1]];
                        const letters = hasSignificance ? row.Significance : row.Group;
                        return `${treatment}: ${mean} (${letters})`;
                    }).join('\n');
                }
            }
            return JSON.stringify(parsed, null, 2);
        } catch (e) {
            return results; // Fallback to raw string if parsing fails
        }
    };

    let prompt = 'You are a senior agricultural research statistician with expertise in analyzing field trial data.\n';
    prompt += 'Your task is to interpret the results of a Factorial Randomized Block Design (FRBD) analysis and provide a comprehensive, easy-to-understand summary for a researcher. Do not use "I" or "you" in your interpretations.\n\n';
    prompt += 'Here is the data from the analysis:\n\n';
    prompt += '1. **ANOVA Table:**\n';
    prompt += '```json\n';
    prompt += input.anova_table;
    prompt += '\n```\n\n';
    prompt += '2.  **Tukey HSD Post-hoc Test Results:**\n';
    Object.entries(input.tukey_results).forEach(([factor, results]) => {
        prompt += `*   **Factor: ${factor}**\n`;
        prompt += '    ```\n';
        prompt += formatResultsWithLetters(results);
        prompt += '\n    ```\n';
    });
    prompt += '\n';
    prompt += '3.  **Shapiro-Wilk Test for Normality of Residuals:**\n';
    prompt += '- Statistic: ' + input.shapiro.stat + '\n';
    prompt += '- P-value: ' + input.shapiro.p + '\n\n';
    prompt += '4.  **Mean Separation Results (Treatment Means):**\n';
    Object.entries(input.mean_separation_results).forEach(([factor, results]) => {
        prompt += `*   **Factor: ${factor}**\n`;
        prompt += '    ```\n';
        prompt += formatResultsWithLetters(results);
        prompt += '\n    ```\n';
    });
    prompt += '\n';
    prompt += '5.  **Overall Coefficient of Variation (CV):** ' + input.overall_cv.toFixed(2) + '%\n\n';
    prompt += '6.  **Critical Difference (CD) Value:** ' + (input.cd_value ? input.cd_value.toFixed(4) : 'Not available') + '\n\n';
    prompt += '--- \n\n';
    prompt += '**Please provide the following in your interpretation:**\n\n';
    prompt += 'Disclaimer: This summary is generated using AI tools and there may be mistakes. It is crucial to verify the results with a qualified statistician before making any decisions based on this interpretation.\n\n';
    prompt += 'A.  **ASSUMPTIONS OF FRBD:**\n';
    prompt += '- Start with a clear heading: "Model Assumptions".\n';
    prompt += '- Based on the Shapiro-Wilk test P-value, conclude whether the model\'s residuals are normally distributed. A p-value > 0.05 indicates that the residuals are normally distributed, and the assumption is met.\n\n';
    prompt += 'B.  **OVERALL MODEL INTERPRETATION:**\n';
    prompt += '- Start with a clear heading: "Overall Model Interpretation".\n';
    prompt += '- Based on the ANOVA table, state whether there are any significant main effects (for each factor) and interaction effects. Explain what the F-statistic and P-value for each factor and their interaction mean in this context.\n';
    prompt += '- Comment on the model\'s fit and reliability using the Coefficient of Variation (CV). A CV less than 10% is excellent, 10-20% is good, and above 20% may indicate high variability.\n\n';
    prompt += 'C.  **FACTOR PERFORMANCE:**\n';
    prompt += '- Start with a clear heading: "Factor Performance".\n';
    prompt += '- For each factor, using the Mean Separation Results and Tukey HSD results, identify which levels performed best.\n';
    prompt += '- List the levels from best to worst based on their means. Add the standard error of mean (SEM) values to the mean values with plus or minus sign. Add alphabetical letters from mean separation results. eg. "89.76 \u00b1 2.50 ab" \n';
    prompt += '- Clearly explain which level means are statistically different from each other and which are not, referencing the significance letters from the Tukey test.\n';
    prompt += '- If the interaction is significant, explain the interaction effect. Describe how the effect of one factor changes across the levels of the other factor.\n\n';
    prompt += 'D.  **Conclusion and Recommendations:**\n';
    prompt += '- Start with a clear heading: "Conclusion and Recommendations".\n';
    prompt += '- Provide a concise, overall conclusion about the main effects and interaction effects.\n';
    prompt += '- Recommend the best-performing levels or combination of levels for future research or application, based on the statistical evidence.\n\n';
    prompt += 'Structure your response using clear headings and bullet points to make it easy to read and understand.\n';

    const llmResponse = await ai.generate({
      prompt: prompt,
      model: 'googleai/gemini-2.0-flash',
      config: {
        temperature: 0.3,
      },
    });

    return llmResponse.text;
  }
);