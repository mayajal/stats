import type { DataRow, VariableMapping, AnalysisResult, AnalysisType } from '@/types';

function createMockAnovaTable(): AnalysisResult['summaryTable'] {
  return {
    headers: ['Source', 'SS', 'df', 'MS', 'F', 'p-value'],
    rows: [
      ['Between Groups', 120.5, 2, 60.25, 15.6, 0.001],
      ['Within Groups', 180.2, 45, 4.004, '', ''],
      ['Total', 300.7, 47, '', '', ''],
    ],
  };
}

function createMockTukeyResults(): AnalysisResult['postHocTests'] {
  return {
    testName: "Tukey's HSD",
    results: [
      { comparison: 'Group A - Group B', diff: -5.5, lower: -10.2, upper: -0.8, pValue: 0.02, significant: true },
      { comparison: 'Group A - Group C', diff: 2.1, lower: -3.5, upper: 7.7, pValue: 0.65, significant: false },
      { comparison: 'Group B - Group C', diff: 7.6, lower: 2.0, upper: 13.2, pValue: 0.008, significant: true },
    ],
  };
}

function createMockRegressionCoefficients(): AnalysisResult['regressionCoefficients'] {
  return [
    { term: 'Intercept', estimate: 2.5, stdError: 0.5, tValue: 5.0, pValue: 0.0001 },
    { term: 'Predictor1', estimate: 1.8, stdError: 0.2, tValue: 9.0, pValue: '<0.0001' },
    { term: 'Predictor2', estimate: -0.5, stdError: 0.3, tValue: -1.67, pValue: '0.098' },
  ];
}

export function performStatisticalAnalysis(
  _data: DataRow[], // Data is not used in mock
  _variables: VariableMapping, // Variables not used in mock
  analysisType: AnalysisType
): AnalysisResult {
  console.log(`Performing mock analysis: ${analysisType}`);
  switch (analysisType) {
    case 'ANOVA':
      return {
        title: 'ANOVA Results (Mock)',
        summaryTable: createMockAnovaTable(),
        statistics: { 'Overall Model Fit (F)': 15.6, 'p-value': 0.001 },
      };
    case 'ANCOVA':
      return {
        title: 'ANCOVA Results (Mock)',
        summaryTable: {
          headers: ['Source', 'SS', 'df', 'MS', 'F', 'p-value'],
          rows: [
            ['Covariate', 50.0, 1, 50.0, 12.0, 0.002],
            ['Between Groups', 100.0, 2, 50.0, 10.0, 0.005],
            ['Error', 170.2, 44, 3.868, '', ''],
            ['Total', 320.2, 47, '', '', ''],
          ],
        },
        statistics: { 'Main Effect (F)': 10.0, 'p-value': 0.005 },
      };
    case "Tukey's HSD":
      return {
        title: "Tukey's HSD Results (Mock)",
        summaryTable: createMockAnovaTable(), // Tukey often follows ANOVA
        postHocTests: createMockTukeyResults(),
      };
    case 'Linear Regression':
      return {
        title: 'Linear Regression Results (Mock)',
        regressionCoefficients: createMockRegressionCoefficients(),
        statistics: { 'R-squared': 0.75, 'Adjusted R-squared': 0.72, 'F-statistic': 35.2, 'p-value': '<0.0001' },
      };
    default:
      throw new Error(`Unsupported analysis type: ${analysisType}`);
  }
}
