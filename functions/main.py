
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import statsmodels.api as sm
from statsmodels.formula.api import ols
import scipy.stats as stats

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

def perform_anova(data, variables):
    """
    Performs one-way or two-way ANOVA based on the number of independent variables.
    """
    dep_var = variables.get('dependentVariable')
    ind_vars = variables.get('independentVariables', [])

    if not dep_var or not ind_vars:
        return {"error": "Dependent and at least one Independent variable must be selected."}

    df = pd.DataFrame(data)

    # Ensure variable names are valid for the formula
    dep_var_clean = f'`{dep_var}`'
    ind_vars_clean = [f'`{var}`' for var in ind_vars]
    
    # Check if dependent variable is numeric
    if not pd.api.types.is_numeric_dtype(df[dep_var]):
        return {"error": f"Dependent variable '{dep_var}' must be numeric."}
    
    # Construct the formula for OLS
    formula = f"{dep_var_clean} ~ {' * '.join(ind_vars_clean)}"
    
    try:
        model = ols(formula, data=df).fit()
        anova_table = sm.stats.anova_lm(model, typ=2)
        
        # Format the table for the frontend
        anova_table_reset = anova_table.reset_index()
        # headers = ['Source'] + list(anova_table_reset.columns) # This was the old way
        headers = ['Source', 'Sum of Squares', 'df', 'F-statistic', 'p-value'] # Correct headers
        rows = []
        # for index, row in anova_table_reset.iterrows(): # Old way, had issues with column names
        #     row_data = [row['index']] + [f'{val:.3f}' if isinstance(val, float) else str(val) for val in row[1:]]
        #     rows.append(row_data)

        # Let's rebuild the rows correctly based on anova_lm output
        for i, (index, series) in enumerate(anova_table.iterrows()):
             row = [index] # Source
             row.append(f'{series["sum_sq"]:.3f}')
             row.append(f'{series["df"]:.0f}')
             if "F" in series and pd.notna(series["F"]):
                 row.append(f'{series["F"]:.3f}')
             else:
                 row.append('') # No F-value for Residual row
             if "PR(>F)" in series and pd.notna(series["PR(>F)"]):
                 row.append(f'{series["PR(>F)"]:.4f}')
             else:
                 row.append('') # No p-value for Residual row
             rows.append(row)

        
        # Calculate group means for the first independent variable
        means = df.groupby(ind_vars[0])[dep_var].mean().to_dict()

        return {
            "title": f"ANOVA Results for {dep_var} by {', '.join(ind_vars)}",
            "summaryTable": {
                "headers": headers,
                "rows": rows
            },
            "statistics": {
                "F-statistic": f'{anova_table["F"][0]:.3f}',
                "p-value": f'{anova_table["PR(>F)"][0]:.4f}',
                "Model-Note": "Results calculated by Python backend.",
                **{f"Mean of {key}": f'{value:.3f}' for key, value in means.items()}
            }
        }

    except Exception as e:
        return {"error": f"An error occurred during ANOVA calculation: {str(e)}"}


@app.route('/analyze', methods=['POST'])
def analyze():
    """
    Endpoint to receive data and perform statistical analysis.
    """
    try:
        payload = request.get_json()
        data = payload.get('data')
        variables = payload.get('variables')
        analysis_type = payload.get('analysisType')

        if not all([data, variables, analysis_type]):
            return jsonify({"error": "Missing data, variables, or analysisType in request"}), 400

        if analysis_type == 'ANOVA':
            results = perform_anova(data, variables)
        # Placeholder for other analyses
        # elif analysis_type == 'ANCOVA':
        #     results = perform_ancova(data, variables)
        else:
            return jsonify({"title": "Analysis Not Implemented", "statistics": {"error": f"Analysis type '{analysis_type}' is not implemented in the Python backend."}}), 200

        if "error" in results:
             return jsonify({"title": f"{analysis_type} Error", "statistics": results}), 200

        return jsonify(results)

    except Exception as e:
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500

if __name__ == '__main__':
    # For local development, you can run this file directly.
    # The server will run on http://127.0.0.1:5001
    app.run(host='0.0.0.0', port=5001, debug=True)
