import base64
import io
import os

import pandas as pd
import statsmodels.api as sm
from flask import Flask, jsonify, request
from flask_cors import CORS
from scipy import stats
from statsmodels.formula.api import ols
from statsmodels.stats.multicomp import pairwise_tukeyhsd
import matplotlib.pyplot as plt
import seaborn as sns

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

@app.route('/analyze', methods=['POST'])
def analyze():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if not file.filename.lower().endswith(('.xlsx', '.xls')):
        return jsonify({"error": "Only Excel files (.xlsx, .xls) are allowed"}), 400

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

    block_col = request.form.get('block_col')
    factor_cols_input = request.form.get('factor_cols')
    response_col = request.form.get('response_col')

    if not all([block_col, factor_cols_input, response_col]):
        return jsonify({"error": "Missing one or more required fields: block_col, factor_cols, response_col"}), 400

    factor_cols = [col.strip() for col in factor_cols_input.split(',') if col.strip()]
    if not factor_cols:
        return jsonify({"error": "At least one factor column must be provided."}), 400

    selected_cols = [block_col] + factor_cols + [response_col]
    for col in selected_cols:
        if col not in df.columns:
            return jsonify({"error": f"Column '{col}' not found in the uploaded file."}), 400

    df_processed = df[selected_cols].copy()

    if not pd.api.types.is_numeric_dtype(df_processed[response_col]):
        return jsonify({"error": f"Response column '{response_col}' must be numeric"}), 400

    try:
        factors_str = " + ".join([f"C(Q('{col}'))" for col in factor_cols])
        formula = f'Q("{response_col}") ~ C(Q("{block_col}")) + {factors_str}'
        model = ols(formula, data=df_processed).fit()
        anova_table = sm.stats.anova_lm(model, typ=2)
    except Exception as e:
        return jsonify({"error": f"Error fitting ANOVA model: {str(e)}"}), 400

    tukey_results = {}
    for factor in factor_cols:
        try:
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

    shapiro_stat, shapiro_p = stats.shapiro(model.resid)

    plots = {}
    try:
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
    except Exception as e:
        return jsonify({"error": f"Error generating plots: {str(e)}"}), 500

    except Exception as e:
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500

if __name__ == "__main__":
    debug_mode = os.environ.get("FLASK_ENV", "production") == "development"
    app.run(debug=debug_mode, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
