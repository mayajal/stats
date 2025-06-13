
import type { DataRow, VariableMapping, AnalysisResult, AnalysisType } from '@/types';

// Helper function to get numeric values and filter out non-numbers or nulls
// This function is not directly used in the new ANOVA logic but kept for potential future use or other functions.
function getNumericDependentValues(data: DataRow[], depVarKey: string): number[] {
  return data
    .map(row => row[depVarKey])
    .filter(val => typeof val === 'number' && !isNaN(val)) as number[];
}

function calculateANOVA(data: DataRow[], variables: VariableMapping): AnalysisResult {
  const depVarKey = variables.dependentVariable;
  const indepVarKey = variables.independentVariables && variables.independentVariables.length > 0 ? variables.independentVariables[0] : null;

  if (!depVarKey || !indepVarKey) {
    return {
      title: 'ANOVA Error',
      statistics: { error: 'Dependent and at least one Independent variable must be selected for ANOVA.' },
      summaryTable: { headers: ['Error'], rows: [['Invalid variable selection.']] }
    };
  }

  // Prepare data in the format: { [groupName: string]: number[] }
  const groupedData: { [key: string]: number[] } = {};
  let allNumericValuesFlat: number[] = [];

  data.forEach(row => {
    const groupName = String(row[indepVarKey]);
    const value = row[depVarKey];

    if (typeof value === 'number' && !isNaN(value)) {
      if (!groupedData[groupName]) {
        groupedData[groupName] = [];
      }
      groupedData[groupName].push(value);
      allNumericValuesFlat.push(value);
    }
  });

  if (allNumericValuesFlat.length === 0) {
    return {
      title: 'ANOVA Error',
      statistics: { error: `Dependent variable '${depVarKey}' contains no numeric data, or no data matches the selected independent variable groups.` },
      summaryTable: { headers: ['Error'], rows: [['No numeric dependent data.']] }
    };
  }

  const groupKeys = Object.keys(groupedData);
  if (groupKeys.length < 2) {
    return {
      title: 'ANOVA Error',
      statistics: { error: `Independent variable '${indepVarKey}' must result in at least two distinct groups with numeric data.` },
      summaryTable: { headers: ['Error'], rows: [['Not enough groups with data.']] }
    };
  }

  for (const groupName of groupKeys) {
    if (groupedData[groupName].length === 0) {
        return {
            title: 'ANOVA Error',
            statistics: { error: `Group '${groupName}' for independent variable '${indepVarKey}' has no numeric data.` },
            summaryTable: { headers: ['Error'], rows: [[`Group ${groupName} is empty.`]] }
        };
    }
  }
  
  const N = allNumericValuesFlat.length; // Total number of observations
  const k = groupKeys.length; // Number of groups

  if (N <= k) {
    return {
      title: 'ANOVA Error',
      statistics: { error: 'Total number of observations must be greater than the number of groups for a valid ANOVA.' },
      summaryTable: { headers: ['Error'], rows: [['Insufficient data points relative to groups.']] }
    };
  }

  const overallMean = allNumericValuesFlat.reduce((sum, value) => sum + value, 0) / N;

  let ssBetween = 0;
  let ssWithin = 0;
  const groupMeans: { [key: string]: number } = {};
  const groupCounts: { [key: string]: number } = {};

  groupKeys.forEach(groupKey => {
    const groupValues = groupedData[groupKey];
    groupCounts[groupKey] = groupValues.length;
    const meanOfGroup = groupValues.reduce((sum, value) => sum + value, 0) / groupCounts[groupKey];
    groupMeans[groupKey] = meanOfGroup;
    
    ssBetween += groupCounts[groupKey] * Math.pow(meanOfGroup - overallMean, 2);
    ssWithin += groupValues.reduce((sum, value) => sum + Math.pow(value - meanOfGroup, 2), 0);
  });

  const ssTotal = ssBetween + ssWithin; // Or: allNumericValuesFlat.reduce((sum, value) => sum + Math.pow(value - overallMean, 2), 0);

  const dfBetween = k - 1;
  const dfWithin = N - k;
  const dfTotal = N - 1;

  if (dfBetween <= 0) { // Should not happen if k >= 2
     return {
      title: 'ANOVA Error',
      statistics: { error: 'Degrees of freedom between groups is zero or less. Check group definitions.' },
      summaryTable: { headers: ['Error'], rows: [['df Between groups error.']] }
    };
  }
  if (dfWithin <= 0) {
     return {
        title: `ANOVA Results (Calculated for ${depVarKey} by ${indepVarKey})`,
        summaryTable: {
            headers: ['Source', 'SS', 'df', 'MS', 'F', 'p-value'],
            rows: [
                [`Between Groups (Effect of ${indepVarKey})`, parseFloat(ssBetween.toFixed(3)), dfBetween, parseFloat((ssBetween/dfBetween).toFixed(3)), 'N/A', 'N/A'],
                ['Within Groups (Error)', parseFloat(ssWithin.toFixed(3)), dfWithin, 'N/A', '', ''],
                ['Total', parseFloat(ssTotal.toFixed(3)), dfTotal, '', '', ''],
            ],
        },
        statistics: { 
            error: 'Cannot calculate F-statistic: Degrees of freedom within groups is zero or less (dfWithin <= 0). Ensure each group has more than one data point if possible, or that N > k.',
            'Note': 'P-value is illustrative. Accurate p-values require a statistical library.'
        },
    };
  }

  const msBetween = ssBetween / dfBetween;
  const msWithin = ssWithin / dfWithin;
  const F_statistic = msWithin === 0 ? (msBetween === 0 ? 0 : Infinity) : msBetween / msWithin; // Handle division by zero

  const pValueIllustrative = F_statistic === Infinity ? "< 0.001 (illustrative, F is Infinity)" : (F_statistic > 3.5 ? "< 0.05 (illustrative)" : (F_statistic > 2.5 ? "< 0.10 (illustrative)" : "> 0.10 (illustrative)"));

  const finalStatistics: Record<string, string | number> = {
    'F-statistic': parseFloat(F_statistic.toFixed(3)),
    'p-value (illustrative)': pValueIllustrative,
    'Degrees of Freedom (Between)': dfBetween,
    'Degrees of Freedom (Within)': dfWithin,
    'Note': 'P-value is illustrative and very approximate. Accurate p-values require a dedicated statistical library.',
  };

  groupKeys.forEach(groupKey => {
    finalStatistics[`Mean of ${groupKey}`] = parseFloat(groupMeans[groupKey].toFixed(3));
  });

  return {
    title: `ANOVA Results (Calculated for ${depVarKey} by ${indepVarKey})`,
    summaryTable: {
      headers: ['Source', 'SS', 'df', 'MS', 'F', 'p-value'],
      rows: [
        [`Between Groups (Effect of ${indepVarKey})`, parseFloat(ssBetween.toFixed(3)), dfBetween, parseFloat(msBetween.toFixed(3)), parseFloat(F_statistic.toFixed(3)), pValueIllustrative],
        ['Within Groups (Error)', parseFloat(ssWithin.toFixed(3)), dfWithin, parseFloat(msWithin.toFixed(3)), '', ''],
        ['Total', parseFloat(ssTotal.toFixed(3)), dfTotal, '', '', ''],
      ],
    },
    statistics: finalStatistics,
  };
}


// --- Mock Functions for other analysis types (to be replaced with real calculations) ---
function createMockAncovaTable(): AnalysisResult['summaryTable'] {
  return {
    headers: ['Source', 'SS', 'df', 'MS', 'F', 'p-value'],
    rows: [
      ['Covariate', 50.0, 1, 50.0, 12.0, 0.002],
      ['Between Groups', 100.0, 2, 50.0, 10.0, 0.005],
      ['Error', 170.2, 44, 3.868, '', ''],
      ['Total', 320.2, 47, '', '', ''],
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
// --- End Mock Functions ---

export function performStatisticalAnalysis(
  data: DataRow[],
  variables: VariableMapping,
  analysisType: AnalysisType
): AnalysisResult {
  console.log(`Performing analysis: ${analysisType}`); // Log which analysis is being called
  switch (analysisType) {
    case 'ANOVA':
      return calculateANOVA(data, variables);
    case 'ANCOVA':
      // Placeholder: ANCOVA calculation is more complex and would typically build upon ANOVA
      console.warn("ANCOVA calculation is not fully implemented and uses mock data.");
      return {
        title: 'ANCOVA Results (Mock)',
        summaryTable: createMockAncovaTable(),
        statistics: { 'Main Effect (F)': 10.0, 'p-value': 0.005, Note: "Mock data" },
      };
    case "Tukey's HSD":
      // Placeholder: Tukey's HSD requires results from ANOVA (especially MSW and dfW)
      console.warn("Tukey's HSD calculation is not fully implemented and uses mock data.");
       const anovaForTukey = calculateANOVA(data, variables); // Run ANOVA first to get some values
      return {
        title: "Tukey's HSD Results (Mock - uses ANOVA inputs)",
        // If ANOVA had an error, anovaForTukey.summaryTable might be an error table.
        // If ANOVA was successful, we can show its table.
        summaryTable: anovaForTukey.summaryTable,
        postHocTests: createMockTukeyResults(),
        statistics: {
            ...(anovaForTukey.statistics || {}), // Spread existing stats (could include error messages or ANOVA stats)
            Note: "Tukey's HSD specific part is mock. ANOVA part is calculated."
        }
      };
    case 'Linear Regression':
      // Placeholder: Linear Regression is a distinct calculation
      console.warn("Linear Regression calculation is not fully implemented and uses mock data.");
      return {
        title: 'Linear Regression Results (Mock)',
        regressionCoefficients: createMockRegressionCoefficients(),
        statistics: { 'R-squared': 0.75, 'Adjusted R-squared': 0.72, 'F-statistic': 35.2, 'p-value': '<0.0001', Note: "Mock data" },
      };
    default:
      // Should not happen if UI is aligned with AnalysisType
      console.error(`Unsupported analysis type: ${analysisType}`);
      return {
        title: `Error: Unsupported Analysis`,
        summaryTable: { headers: ['Error'], rows: [[`Analysis type "${analysisType}" is not supported.`]] },
        statistics: { error: `Unsupported analysis type: ${analysisType}` }
      };
  }
}

