import pandas as pd
from lifelines import KaplanMeierFitter, CoxPHFitter
import matplotlib.pyplot as plt
from flask import Flask, jsonify, request
from flask_cors import CORS
import io
import base64
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": [
    "https://vita.chloropy.com",
    "https://vita-zur5dejluq-uc.a.run.app",
    "http://localhost:9002",
    "https://vita--statviz-j3txi.us-central1.hosted.app"
]}})

@app.route("/")
def health():
    return "OK", 200

def run_kaplan_meier(data, group_column_name):
    kmf = KaplanMeierFitter()
    groups = data[group_column_name].unique()

    plt.figure()
    event_tables = {}
    median_survival_times = {}

    for group in groups:
        group_data = data[data[group_column_name] == group]
        T = group_data['TIME']
        E = group_data['EVENT']
        kmf.fit(T, event_observed=E, label=group)
        kmf.plot_survival_function(ci_show=False)

        event_tables[str(group)] = kmf.event_table.reset_index().to_dict('list')
        median_survival_times[str(group)] = kmf.median_survival_time_

    plt.xlabel('Time elapsed')
    plt.ylabel('Probability of survival')
    plt.title(f'Kaplan-Meier Survival Curves by {group_column_name}')
    plt.legend()
    
    img_io = io.BytesIO()
    plt.savefig(img_io, format='png', bbox_inches='tight')
    img_io.seek(0)
    plot_base64 = base64.b64encode(img_io.getvalue()).decode('utf-8')
    plt.close()

    return plot_base64, event_tables, median_survival_times

def run_cox_regression(data, covariates=None):
    if covariates is None:
        covariates = []

    all_categorical_cols = ['GROUP'] + [cov for cov in covariates if data[cov].dtype == 'object']
    
    reference_categories = {}
    for col in all_categorical_cols:
        categories = sorted(data[col].unique())
        if categories:
            reference_categories[col] = categories[0]

    data_encoded = pd.get_dummies(data, columns=all_categorical_cols, drop_first=True)
    
    cph = CoxPHFitter()
    
    fit_columns = [col for col in data_encoded.columns if col not in ['TIME', 'EVENT']]
    
    cph.fit(data_encoded, duration_col='TIME', event_col='EVENT', formula=' + '.join(fit_columns))

    summary_df = cph.summary
    summary_dict = summary_df.to_dict()

    textual_summary = []
    for covariate_name in summary_df.index:
        p_value = summary_df.loc[covariate_name, 'p']
        hazard_ratio = summary_df.loc[covariate_name, 'exp(coef)']
        
        interpretation = f"For the covariate '{covariate_name}'"
        
        is_dummy = False
        for cat_col in all_categorical_cols:
            if covariate_name.startswith(f"{cat_col}_"):
                ref_cat = reference_categories.get(cat_col)
                if ref_cat:
                    interpretation += f" (compared to the reference category '{ref_cat}')"
                is_dummy = True
                break
        
        if p_value < 0.05:
            effect = "an increase" if hazard_ratio > 1 else "a decrease"
            interpretation += (
                f", there is a statistically significant effect on the hazard rate (p < 0.05). "
                f"This corresponds to {effect} in the hazard by a factor of {hazard_ratio:.2f}."
            )
        else:
            interpretation += (
                f", there is no statistically significant effect on the hazard rate (p >= 0.05)."
            )
        textual_summary.append(interpretation)

    plt.figure()
    cph.plot()
    plt.title('Cox Regression Coefficients with 95% Confidence Intervals')
    
    img_io = io.BytesIO()
    plt.savefig(img_io, format='png', bbox_inches='tight')
    img_io.seek(0)
    plot_base64 = base64.b64encode(img_io.getvalue()).decode('utf-8')
    plt.close()

    unique_groups = data['GROUP'].unique()
    plt.figure()

    baseline_values = {}
    if covariates:
        numerical_covariates = [cov for cov in covariates if data[cov].dtype != 'object']
        if numerical_covariates:
            baseline_values = data[numerical_covariates].mean().to_dict()

    for group in unique_groups:
        row = baseline_values.copy()
        for g in sorted(data['GROUP'].unique())[1:]:
            row[f'GROUP_{g}'] = 0
        if f'GROUP_{group}' in data_encoded.columns:
            row[f'GROUP_{group}'] = 1
        
        group_df = pd.DataFrame([row])
        
        for col in fit_columns:
            if col not in group_df:
                group_df[col] = 0

        survival_function = cph.predict_survival_function(group_df[fit_columns])
        plt.plot(survival_function.index, survival_function.values, label=f'Group {group}')


    plt.xlabel('Time')
    plt.ylabel('Survival Probability')
    plt.title('Adjusted Survival Curves from Cox Model')
    plt.legend()
    
    adj_plot_io = io.BytesIO()
    plt.savefig(adj_plot_io, format='png', bbox_inches='tight')
    adj_plot_io.seek(0)
    adj_plot_base64 = base64.b64encode(adj_plot_io.getvalue()).decode('utf-8')
    plt.close()

    # Cumulative Hazard Plot
    plt.figure()
    for group in unique_groups:
        row = baseline_values.copy()
        for g in sorted(data['GROUP'].unique())[1:]:
            row[f'GROUP_{g}'] = 0
        if f'GROUP_{group}' in data_encoded.columns:
            row[f'GROUP_{group}'] = 1
        
        group_df = pd.DataFrame([row])
        
        for col in fit_columns:
            if col not in group_df:
                group_df[col] = 0

        cumulative_hazard = cph.predict_cumulative_hazard(group_df[fit_columns])
        plt.plot(cumulative_hazard.index, cumulative_hazard.values, label=f'Group {group}')

    plt.xlabel('Time')
    plt.ylabel('Cumulative Hazard')
    plt.title('Cumulative Hazard by Group')
    plt.legend()
    
    cum_haz_plot_io = io.BytesIO()
    plt.savefig(cum_haz_plot_io, format='png', bbox_inches='tight')
    cum_haz_plot_io.seek(0)
    cum_haz_plot_base64 = base64.b64encode(cum_haz_plot_io.getvalue()).decode('utf-8')
    plt.close()

    return summary_dict, plot_base64, adj_plot_base64, reference_categories.get('GROUP'), textual_summary, cum_haz_plot_base64

@app.route('/survival', methods=['POST'])
def analyze():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        data = pd.read_csv(file)
        required_cols = {'TIME', 'EVENT', 'GROUP'}
        if not required_cols.issubset(data.columns):
            return jsonify({"error": f"Missing required columns. Found: {list(data.columns)}, Required: {list(required_cols)}"}), 400

        group_column_name = 'GROUP'
        
        covariates = request.form.getlist('covariates[]')

        km_plot, event_tables, median_survival_times = run_kaplan_meier(data, group_column_name)

        cox_summary, cox_plot, adj_cox_plot, reference_group, textual_summary, cum_haz_plot = run_cox_regression(data.copy(), covariates)

        return jsonify({
            "kaplan_meier": {
                "plot": km_plot,
                "event_tables": event_tables,
                "median_survival_times": median_survival_times
            },
            "cox_regression": {
                "summary": cox_summary,
                "plot": cox_plot,
                "adjusted_survival_plot": adj_cox_plot,
                "reference_group": reference_group,
                "textual_summary": textual_summary,
                "cumulative_hazard_plot": cum_haz_plot
            }
        })

    except Exception as e:
        logging.error(f"An error occurred during survival analysis: {e}", exc_info=True)
        return jsonify({"error": "An error occurred during survival analysis. Please check your input data and try again."}), 500

if __name__ == "__main__":
    debug_mode = os.environ.get("FLASK_ENV", "production") == "development"
    app.run(debug=debug_mode, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
