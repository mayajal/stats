export type DataRow = Record<string, string | number | boolean | null>;

export type ColumnDefinition = {
  id: string;
  name: string;
  type?: 'numeric' | 'categorical'; // Optional: for future type inference
};

export type AnalysisType = "ANOVA" | "ANCOVA" | "Tukey's HSD" | "Linear Regression";

export interface VariableMapping {
  dependentVariable: string | null;
  independentVariables: string[];
  valuesColumn: string | null; // For analyses that need a specific values column (e.g. if data is long)
  covariates?: string[]; // For ANCOVA
}

export interface AnalysisResult {
  title: string;
  summaryTable?: { // e.g., ANOVA table
    headers: string[];
    rows: (string | number)[][];
  };
  statistics?: Record<string, string | number>; // e.g., F-stat, p-value, R-squared
  postHocTests?: { // For Tukey's HSD
    testName: string;
    results: {
      comparison: string;
      diff: number;
      lower: number;
      upper: number;
      qValue?: number; // For Tukey
      pValue: number;
      significant: boolean;
    }[];
  };
  regressionCoefficients?: { // For Linear Regression
    term: string;
    estimate: number;
    stdError: number;
    tValue: number;
    pValue: number;
  }[];
  plots?: { type: string; data: any; layout?: any }[]; // For future visualization
  rawOutput?: string; // Optional: for any text-based output not fitting tables
}

export interface SheetData {
  name: string;
  data: DataRow[];
  columns: ColumnDefinition[];
}
