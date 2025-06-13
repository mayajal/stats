
import type { DataRow, VariableMapping, AnalysisResult, AnalysisType } from '@/types';

// Helper function to get numeric values and filter out non-numbers or nulls
function getNumericDependentValues(data: DataRow[], depVarKey: string): number[] {
  return data
    .map(row => row[depVarKey])
    .filter(val => typeof val === 'number' && !isNaN(val)) as number[];
}

function calculateANOVA(data: DataRow[], variables: VariableMapping): AnalysisResult {
  const depVarKey = variables.dependentVariable;
  // For one-way ANOVA, use the first selected independent variable
  const indepVarKey = variables.independentVariables && variables.independentVariables.length > 0 ? variables.independentVariables[0] : null;

  if (!depVarKey || !indepVarKey) {
    return {
      title: 'ANOVA Error',
      statistics: { error: 'Dependent and at least one Independent variable must be selected for ANOVA.' },
      summaryTable: { headers: ['Error'], rows: [['Invalid variable selection.']] }
    };
  }

  const groups: Record<string, number[]> = {};
  let allNumericDependentValues: number[] = [];

  data.forEach(row => {
    const groupVal = String(row[indepVarKey]); // Independent variable forms the groups
    const depValue = row[depVarKey];

    if (typeof depValue === 'number' && !isNaN(depValue)) {
      if (!groups[groupVal]) {
        groups[groupVal] = [];
      }
      groups[groupVal].push(depValue);
      allNumericDependentValues.push(depValue);
    }
  });

  if (allNumericDependentValues.length === 0) {
    return {
      title: 'ANOVA Error',
      statistics: { error: `Dependent variable '${depVarKey}' contains no numeric data.` },
      summaryTable: { headers: ['Error'], rows: [['No numeric dependent data.']] }
    };
  }

  const groupNames = Object.keys(groups);
  if (groupNames.length < 2) {
    return {
      title: 'ANOVA Error',
      statistics: { error: `Independent variable '${indepVarKey}' must have at least two distinct groups with numeric data.` },
      summaryTable: { headers: ['Error'], rows: [['Not enough groups.']] }
    };
  }
  
  for (const groupName of groupNames) {
    if (groups[groupName].length < 1) { // Each group needs at least one data point, ideally more
        return {
            title: 'ANOVA Error',
            statistics: { error: `Group '${groupName}' for independent variable '${indepVarKey}' has no numeric data.` },
            summaryTable: { headers: ['Error'], rows: [[`Group ${groupName} is empty.`]] }
        };
    }
  }


  const N = allNumericDependentValues.length; // Total number of observations
  const k = groupNames.length; // Number of groups

  if (N <= k) {
    return {
      title: 'ANOVA Error',
      statistics: { error: 'Total number of observations must be greater than the number of groups.' },
      summaryTable: { headers: ['Error'], rows: [['Insufficient data points for groups.']] }
    };
  }

  const overallMean = allNumericDependentValues.reduce((sum, val) => sum + val, 0) / N;

  let SSB = 0; // Sum of Squares Between groups
  const groupMeans: Record<string, number> = {};
  const groupCounts: Record<string, number> = {};

  for (const groupName of groupNames) {
    const groupData = groups[groupName];
    groupCounts[groupName] = groupData.length;
    groupMeans[groupName] = groupData.reduce((sum, val) => sum + val, 0) / groupCounts[groupName];
    SSB += groupCounts[groupName] * Math.pow(groupMeans[groupName] - overallMean, 2);
  }

  let SSW = 0; // Sum of Squares Within groups
  for (const groupName of groupNames) {
    const groupData = groups[groupName];
    const meanOfGroup = groupMeans[groupName];
    SSW += groupData.reduce((sum, val) => sum + Math.pow(val - meanOfGroup, 2), 0);
  }

  const SST = SSB + SSW; // Sum of Squares Total

  const dfBetween = k - 1;
  const dfWithin = N - k;
  const dfTotal = N - 1;

  if (dfWithin <= 0) {
     return {
        title: `ANOVA Results (Calculated for ${depVarKey} by ${indepVarKey})`,
        summaryTable: {
            headers: ['Source', 'SS', 'df', 'MS', 'F', 'p-value'],
            rows: [
                [`Between Groups (Effect of ${indepVarKey})`, SSB.toFixed(3), dfBetween, dfBetween > 0 ? (SSB/dfBetween).toFixed(3) : 'N/A', 'N/A', 'N/A'],
                ['Within Groups (Error)', SSW.toFixed(3), dfWithin, 'N/A', '', ''],
                ['Total', SST.toFixed(3), dfTotal, '', '', ''],
            ],
        },
        statistics: { 
            error: 'Cannot calculate F-statistic: Not enough data for degrees of freedom within groups (dfWithin <= 0).',
            'Note': 'P-value is illustrative. Accurate p-values require a statistical library.'
        },
    };
  }

  const MSB = SSB / dfBetween; // Mean Square Between
  const MSW = SSW / dfWithin; // Mean Square Within
  const F_statistic = MSW === 0 ? Infinity : MSB / MSW; // Handle division by zero if MSW is 0


  // P-value calculation is complex and requires statistical distribution functions (e.g., F-distribution CDF)
  // For this basic implementation, p-value will be illustrative.
  // A real app would use a library like jStat or similar for accurate p-values.
  const pValueIllustrative = F_statistic > 3.5 ? "< 0.05 (illustrative)" : (F_statistic > 2.5 ? "< 0.10 (illustrative)" : "> 0.10 (illustrative)");


  return {
    title: `ANOVA Results (Calculated for ${depVarKey} by ${indepVarKey})`,
    summaryTable: {
      headers: ['Source', 'SS', 'df', 'MS', 'F', 'p-value'],
      rows: [
        [`Between Groups (Effect of ${indepVarKey})`, parseFloat(SSB.toFixed(3)), dfBetween, parseFloat(MSB.toFixed(3)), parseFloat(F_statistic.toFixed(3)), pValueIllustrative],
        ['Within Groups (Error)', parseFloat(SSW.toFixed(3)), dfWithin, parseFloat(MSW.toFixed(3)), '', ''],
        ['Total', parseFloat(SST.toFixed(3)), dfTotal, '', '', ''],
      ],
    },
    statistics: {
      'F-statistic': parseFloat(F_statistic.toFixed(3)),
      'p-value (illustrative)': pValueIllustrative,
      'Degrees of Freedom (Between)': dfBetween,
      'Degrees of Freedom (Within)': dfWithin,
      'Note': 'P-value is illustrative and very approximate. Accurate p-values require a dedicated statistical library.',
    },
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
        summaryTable: anovaForTukey.summaryTable, // Tukey often follows ANOVA
        postHocTests: createMockTukeyResults(),
        statistics: {...(anovaForTukey.statistics || {}), Note: "Tukey's HSD specific part is mock."}
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
