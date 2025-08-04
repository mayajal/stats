import pandas as pd
import os
import statsmodels.api as sm
from statsmodels.formula.api import ols
from statsmodels.stats.multicomp import pairwise_tukeyhsd
from scipy import stats
from flask import Flask, request, jsonify
from flask_cors import CORS
import io
import base64
import matplotlib.pyplot as plt
import seaborn as sns

app = Flask(__name__)
# For development
allowed_origins = os.environ.get("ALLOWED_ORIGINS", "*").split(",")
CORS(app, resources={r"/*": {"origins": allowed_origins}})

#for development
## CORS(app, resources={r"/*": {"origins": "*"}})


@app.route('/analyze', methods=['POST'])
def analyze():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    # Validate file extension
    if not file.filename.lower().endswith(('.xlsx', '.xls')):
        return jsonify({"error": "Only Excel files (.xlsx, .xls) are allowed"}), 400

    # Check file size (e.g., 10MB limit)
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)
    if file_size > 10 * 1024 * 1024:  # 10MB
        return jsonify({"error": "File size exceeds 10MB limit"}), 400

    try:
        df = pd.read_excel(file)
    except pd.errors.EmptyDataError:
        return jsonify({"error": "The Excel file is empty"}), 400
    except Exception as e:
        return jsonify({"error": f"Error reading Excel file: {str(e)}"}), 400

@app.route('/analyze', methods=['POST'])
def analyze():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
    df_processed = df[selected_cols].copy()

    # Validate response column is numeric
    if not pd.api.types.is_numeric_dtype(df_processed[response_col]):
        return jsonify({"error": f"Response column '{response_col}' must be numeric"}), 400

    # ANOVA model
    factors_str = " + ".join([f"C(Q('{col}'))" for col in factor_cols])
    formula = f'Q("{response_col}") ~ C(Q("{block_col}")) + {factors_str}'
    try:
        model = ols(formula, data=df_processed).fit()
    if __name__ == "__main__":
    debug_mode = os.environ.get("FLASK_ENV", "production") == "development"
    app.run(debug=debug_mode, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))except Exception as e:
        return jsonify({"error": f"Error fitting ANOVA model: {str(e)}"}), 400
    # Tukey's HSD test
    tukey_results = {}
    for factor in factor_cols:
        try:
            # Check if factor has more than one level
            if df_processed[factor].nunique() < 2:
                tukey_results[factor] = f"Factor '{factor}' has less than 2 levels, Tukey HSD not applicable"
            else:
                tukey = pairwise_tukeyhsd(
                    endog=df_processed[response_col],
                    groups=df_processed[factor],
                    alpha=0.05
                )
                tukey_results[factor] = tukey.summary().as_html()
        except Exception as e:
            tukey_results[factor] = f"Error performing Tukey HSD for '{factor}': {e}"

    factor_cols = [col.strip() for col in factor_cols_input.split(',') if col.strip()]
    if not factor_cols:
        return jsonify({"error": "At least one factor column must be provided."}), 400
    
    # --- Full analysis logic ---
    
    selected_cols = [block_col] + factor_cols + [response_col]
    for col in selected_cols:
        if col not in df.columns:
            return jsonify({"error": f"Column '{col}' not found in the uploaded file."}), 400

    df_processed = df[selected_cols].copy()
    
    # ANOVA model
    factors_str = " + ".join([f"C(Q('{col}'))" for col in factor_cols])
    formula = f'Q("{response_col}") ~ C(Q("{block_col}")) + {factors_str}'
    model = ols(formula, data=df_processed).fit()
    anova_table = sm.stats.anova_lm(model, typ=2)
    
    # Tukey's HSD test
    tukey_results = {}
    for factor in factor_cols:
        tukey = pairwise_tukeyhsd(endog=df_processed[response_col], groups=df_processed[factor], alpha=0.05)
        tukey_results[factor] = tukey.summary().as_html()

    # Shapiro-Wilk test for normality of residuals
    shapiro_stat, shapiro_p = stats.shapiro(model.resid)
    
    # Plots
    plots = {}
    
    # Residuals vs Fitted
    fig, ax = plt.subplots()
    sns.residplot(x=model.fittedvalues, y=model.resid, lowess=True, ax=ax)
    ax.set_xlabel("Fitted values")
    ax.set_ylabel("Residuals")
    ax.set_title("Residuals vs Fitted")
    img_io = io.BytesIO()
    plt.savefig(img_io, format='png', bbox_inches='tight')
    plots['residuals_vs_fitted'] = base64.b64encode(img_io.getvalue()).decode('utf-8')
    plt.close(fig)

    # Q-Q plot
    fig, ax = plt.subplots()
    stats.probplot(model.resid, dist="norm", plot=ax)
    ax.set_title("Normal Q-Q Plot")
    img_io = io.BytesIO()
    plt.savefig(img_io, format='png', bbox_inches='tight')
    plots['qq_plot'] = base64.b64encode(img_io.getvalue()).decode('utf-8')
    plt.close(fig)

    return jsonify({
        "message": "Analysis complete!",
        "anova_table": anova_table.to_html(),
        "tukey_results": tukey_results,
        "shapiro_test": {"statistic": shapiro_stat, "p_value": shapiro_p},
        "plots": plots
    })

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))