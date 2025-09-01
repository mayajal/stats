import scipy.stats as stats
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

# Prompt user for input file path
file_path = input("Please enter the path to your Excel file: ")

try:
    # Load data from Excel file
    df = pd.read_excel(file_path)
    print(f"Successfully loaded data from {file_path}")

    # Identify numeric columns for analysis
    numeric_cols = df.select_dtypes(include=np.number).columns.tolist()

    if not numeric_cols:
        print("No numeric columns found in the dataset for analysis.")
    else:
        print("\nAnalyzing numeric columns:")
        for col in numeric_cols:
            print(f"\nAnalysis for column: {col}")

            # Descriptive statistics
            print("Descriptive Statistics:")
            print(df[col].describe())

            # Normality test (Shapiro-Wilk test)
            print("\nNormality Tests (Shapiro-Wilk):")
            if len(df[col].dropna()) >= 3: # Shapiro-Wilk requires at least 3 data points
                statistic, p_value = stats.shapiro(df[col].dropna())
                alpha = 0.05
                print(f"  - Shapiro-Wilk Statistic: {statistic:.4f}")
                print(f"  - P-value: {p_value:.4f}")
                print(f"  - Alpha: {alpha}")
                
                if p_value < alpha:
                    interpretation = f"Since the p-value ({p_value:.4f}) is less than alpha ({alpha}), we reject the null hypothesis.\n"
                    interpretation += f"  - Conclusion: The data in column '{col}' is not normally distributed."
                else:
                    interpretation = f"Since the p-value ({p_value:.4f}) is greater than alpha ({alpha}), we fail to reject the null hypothesis.\n"
                    interpretation += f"  - Conclusion: The data in column '{col}' appears to be normally distributed."
                print(interpretation)
            else:
                print("  - Not enough data points to perform Shapiro-Wilk test.")


        # Homogeneity of variances test (Levene's test) - requires grouping variable
        if len(df.columns) > 1 and df.iloc[:, 0].nunique() > 1:
            grouping_col = df.columns[0]
            print(f"\nHomogeneity of Variances Test (Levene's) across groups in column '{grouping_col}':")
            
            for num_col in numeric_cols:
              print(f"\n  Testing for column: {num_col}")
              try:
                data_for_levene_col = [group_df[num_col].dropna().values for name, group_df in df.groupby(grouping_col)]
                
                if all(len(arr) >= 2 for arr in data_for_levene_col) and len(data_for_levene_col) >= 2:
                    statistic, p_value = stats.levene(*data_for_levene_col)
                    alpha = 0.05
                    print(f"    - Levene's Statistic: {statistic:.4f}")
                    print(f"    - P-value: {p_value:.4f}")
                    print(f"    - Alpha: {alpha}")

                    if p_value < alpha:
                        interpretation = f"Since the p-value ({p_value:.4f}) is less than alpha ({alpha}), we reject the null hypothesis.\n"
                        interpretation += f"    - Conclusion: The variances for column '{num_col}' are not homogeneous across the groups in '{grouping_col}'."
                    else:
                        interpretation = f"Since the p-value ({p_value:.4f}) is greater than alpha ({alpha}), we fail to reject the null hypothesis.\n"
                        interpretation += f"    - Conclusion: The variances for column '{num_col}' are homogeneous across the groups in '{grouping_col}'."
                    print(interpretation)
                else:
                    print("    - Not enough data points or groups to perform Levene's test.")
              except Exception as e:
                  print(f"    - An error occurred during Levene's test for column '{num_col}': {e}")


        # Kruskal-Wallis test - requires a grouping variable and a dependent variable
        print("\nKruskal-Wallis Test:")
        print("Kruskal-Wallis test requires a grouping variable and a dependent variable.")
        print("Please specify which columns you'd like to use for this test if needed.")

except FileNotFoundError:
    print(f"Error: File not found at {file_path}")
except Exception as e:
    print(f"An error occurred while reading the Excel file: {e}")
