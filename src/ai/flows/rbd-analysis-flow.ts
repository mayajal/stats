import { z } from 'zod';
import { ai } from '../genkit';

const anovaTableSchema = z.string();
const tukeyResultsSchema = z.string();
const shapiroSchema = z.object({
  stat: z.number(),
  p: z.number(),
});
const meanSeparationResultsSchema = z.string();
const fOnewayResultsSchema = z.string();

export const rbdAnalysisInputSchema = z.object({
  anova_table: anovaTableSchema,
  tukey_results: tukeyResultsSchema,
  shapiro: shapiroSchema,
  mean_separation_results: meanSeparationResultsSchema,
  f_oneway_results: fOnewayResultsSchema,
  overall_cv: z.number(),
  cd_value: z.number().nullable(),
});


export const rbdAnalysisFlow = ai.defineFlow(
  {
    name: 'rbdAnalysisFlow',
    inputSchema: rbdAnalysisInputSchema,
    outputSchema: z.string(),
  },
  async (input) => {
    // Ensure input.anova_table exists and is a string
    if (!input.anova_table || typeof input.anova_table !== 'string') {
        throw new Error('anova_table must be a valid string');
    }
    
    // Parse JSON strings for better AI interpretation
    let parsedTukeyResults;
    try {
      parsedTukeyResults = JSON.parse(input.tukey_results);
    } catch (e) {
      console.error("Error parsing tukey_results:", e);
      parsedTukeyResults = input.tukey_results; // Fallback to raw string if parsing fails
    }

    let parsedMeanSeparationResults;
    try {
      parsedMeanSeparationResults = JSON.parse(input.mean_separation_results);
    } catch (e) {
      console.error("Error parsing mean_separation_results:", e);
      parsedMeanSeparationResults = input.mean_separation_results; // Fallback to raw string if parsing fails
    }

    // Helper to format results with significance letters
    const formatResultsWithLetters = (results: any) => {
      if (Array.isArray(results) && results.length > 0) {
        // Assuming 'Significance' or 'Group' column holds the letters
        const hasSignificance = results[0].hasOwnProperty('Significance');
        const hasGroup = results[0].hasOwnProperty('Group');

        if (hasSignificance || hasGroup) {
          return results.map((row: any) => {
            const treatment = row[Object.keys(row)[0]]; // First column is usually treatment name
            const mean = row[Object.keys(row)[1]]; // Second column is usually mean
            const letters = hasSignificance ? row.Significance : row.Group;
            return `${treatment}: ${mean} (${letters})`;
          }).join('\n');
        }
      }
      return JSON.stringify(results, null, 2); // Fallback to pretty-printed JSON
    };

    let prompt = 'You are a senior agricultural research statistician with expertise in analyzing field trial data.\n';
    prompt += 'Your task is to interpret the results of a Randomized Block Design (RBD) analysis and provide a comprehensive, easy-to-understand summary for a researcher. Do not use "I" or "you" in your interpretations.\n\n';
    prompt += 'Here is the data from the analysis:\n\n';
    prompt += '1. **ANOVA Table:**\n';
    prompt += '```json\n';
    prompt += input.anova_table;
    prompt += '\n```\n\n';
    prompt += '2.  **Tukey HSD Post-hoc Test Results:**\n';
    prompt += '```\n';
    prompt += formatResultsWithLetters(parsedTukeyResults);
    prompt += '\n```\n\n';
    prompt += '3.  **Shapiro-Wilk Test for Normality of Residuals:**\n';
    prompt += '- Statistic: ' + input.shapiro.stat + '\n';
    prompt += '- P-value: ' + input.shapiro.p + '\n\n';
    prompt += '4.  **Mean Separation Results (Treatment Means):**\n';
    prompt += '```\n';
    prompt += formatResultsWithLetters(parsedMeanSeparationResults);
    prompt += '\n```\n\n';
    prompt += '5.  **F-Oneway Results:**\n';
    prompt += '```json\n';
    prompt += input.f_oneway_results;
    prompt += '\n```\n\n';
    prompt += '6.  **Overall Coefficient of Variation (CV):** ' + input.overall_cv.toFixed(2) + '%\n\n';
    prompt += '7.  **Critical Difference (CD) Value:** ' + (input.cd_value ? input.cd_value.toFixed(4) : 'Not available') + '\n\n';
    prompt += '--- \n\n';
    prompt += '**Please provide the following in your interpretation:**\n\n';
    prompt += 'Disclaimer: This summary is generated using AI tools and there may be mistakes. It is crucial to verify the results with a qualified statistician before making any decisions based on this interpretation.\n\n';
    prompt += 'A.  **ASSUMPTIONS OF RBD:**\n';
    prompt += '- Start with a clear heading: "Model Assumptions".\n';
    prompt += '- Based on the Shapiro-Wilk test P-value, conclude whether the model\'s residuals are normally distributed. A p-value > 0.05 indicates that the residuals are normally distributed, and the assumption is met.\n\n';
    prompt += 'B.  **OVERALL MODEL INTERPRETATION:**\n';
    prompt += '- Start with a clear heading: "Overall Model Interpretation".\n';
    prompt += '- Based on the ANOVA table, state whether there are any significant differences among the treatments and blocks. Explain what the F-statistic and P-value for the treatment factor mean in this context.\n';
    prompt += '- Comment on the model\'s fit and reliability using the Coefficient of Variation (CV). A CV less than 10% is excellent, 10-20% is good, and above 20% may indicate high variability.\n\n';
    prompt += 'C.  **TREATMENT PERFORMANCE:**\n';
    prompt += '- Start with a clear heading: "Treatment Performance".\n';
    prompt += '- Using the Mean Separation Results and Tukey HSD results, identify which treatments performed best.\n';
    prompt += '- List the treatments from best to worst based on their means. Add the standard error of mean (SEM) values to the mean values with plus or minus sign. Add alphabetical letters from mean separation results. eg. "89.76 ± 2.50 ab" \n';
    prompt += '- Clearly explain which treatment means are statistically different from each other and which are not, referencing the significance letters or p-values from the Tukey test.\n\n';
   
    prompt += 'D.  **Conclusion and Recommendations:**\n';
    prompt += '- Start with a clear heading: "Conclusion and Recommendations".\n';
    prompt += '- Provide a concise, overall conclusion about the treatment effects.\n';
    prompt += '- Recommend the best-performing treatment(s) for future research or application, based on the statistical evidence.\n\n';
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
