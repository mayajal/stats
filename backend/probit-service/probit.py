import numpy as np
import pandas as pd
import statsmodels.api as sm
from scipy.stats import norm
from scipy.optimize import minimize
from scipy.interpolate import interp1d
from scipy.stats import chi2
import matplotlib.pyplot as plt
from flask import Flask, jsonify, request
from flask_cors import CORS
import io
import os
import base64

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
    
    """
    FINNEY'S METHOD OF PROBIT ANALYSIS WITH FIELLER'S THEOREM FOR ESTIMATING CONFIDENCE INTERVALS.
    """

def run_probit_analysis(df):

    control_conc = 0
    control_n = 0
    control_dead = 0
    control_mortality_proportion = 0
    control_exists = False

    if control_conc in df['DOSE'].values:
        control_row = df[df['DOSE'] == control_conc]
        if not control_row.empty:
            control_exists = True
            control_n = control_row['TOTAL'].iloc[0]
            control_dead = control_row['RESPONSE'].iloc[0]
            if control_n > 0:
                control_mortality_proportion = control_dead / control_n
            
    df_analysis = df[df['DOSE'] > 0].copy()

    if control_mortality_proportion > 0:
        df_analysis['OBS_PROP'] = df_analysis['RESPONSE'] / df_analysis['TOTAL']
        df_analysis['CORRECTED_OBS_PROP'] = np.nan 

        for index, row in df_analysis.iterrows():
            observed_mortality_proportion = row['OBS_PROP']
            if (1 - control_mortality_proportion) != 0:
                corrected_mortality_proportion = (observed_mortality_proportion - control_mortality_proportion) / (1 - control_mortality_proportion)
                df_analysis.loc[index, 'CORRECTED_OBS_PROP'] = np.maximum(0, np.minimum(1, corrected_mortality_proportion))
            else:
                df_analysis.loc[index, 'CORRECTED_OBS_PROP'] = 0

        df_analysis['CORRECTED_DEAD'] = (df_analysis['CORRECTED_OBS_PROP'] * df_analysis['TOTAL']).round().astype('Int64')

    df_analysis['OBS_PROP_USED'] = df_analysis.get('CORRECTED_OBS_PROP', df_analysis['RESPONSE'] / df_analysis['TOTAL'])
    
    epsilon = 1e-6
    df_analysis['EMP_PROBIT'] = norm.ppf(df_analysis['OBS_PROP_USED'].clip(epsilon, 1 - epsilon))
    df_analysis['log_CONC'] = np.log10(df_analysis['DOSE'])

    df_analysis_wls = df_analysis.replace([np.inf, -np.inf], np.nan).dropna(subset=['log_CONC', 'EMP_PROBIT', 'OBS_PROP_USED', 'TOTAL'])

    if len(df_analysis_wls) < 2:
        raise ValueError("Not enough valid data points for WLS regression after handling inf/nan.")

    df_analysis_wls['WEIGHTS'] = df_analysis_wls['TOTAL'] * (norm.pdf(df_analysis_wls['EMP_PROBIT'])**2) / (df_analysis_wls['OBS_PROP_USED'] * (1 - df_analysis_wls['OBS_PROP_USED']))
    df_analysis_wls['WEIGHTS'] = df_analysis_wls['WEIGHTS'].replace([np.inf, -np.inf], np.nan).fillna(1)

    wls_model = sm.WLS(df_analysis_wls['EMP_PROBIT'], sm.add_constant(df_analysis_wls['log_CONC']), weights=df_analysis_wls['WEIGHTS'])
    wls_results = wls_model.fit()

    intercept = wls_results.params['const']
    slope = wls_results.params['log_CONC']
    cov_matrix = wls_results.cov_params()

    ld_levels = [0.10, 0.25, 0.50, 0.75, 0.90, 0.99]
    ld_estimates = {}
    ld_lower_ci = {}
    ld_upper_ci = {}

    for level in ld_levels:
        target_probit = norm.ppf(level)
        ld_name = f'LD{int(level*100)}'
        
        if slope == 0:
            ld_value = float('nan')
            log_ld_lower, log_ld_upper = np.nan, np.nan
        else:
            ld_value = 10**((target_probit - intercept) / slope)
            log_ld_lower, log_ld_upper = fiellers_ci(target_probit, intercept, slope, cov_matrix)

        ld_lower_val = 10**log_ld_lower if not np.isnan(log_ld_lower) else float('nan')
        ld_upper_val = 10**log_ld_upper if not np.isnan(log_ld_upper) else float('nan')

        ld_estimates[ld_name] = ld_value
        ld_lower_ci[ld_name] = ld_lower_val
        ld_upper_ci[ld_name] = ld_upper_val

    # Goodness of fit test (Chi-squared)
    df_analysis_wls['EXPECTED_PROBIT'] = wls_results.predict(sm.add_constant(df_analysis_wls['log_CONC']))
    df_analysis_wls['EXPECTED_PROP'] = norm.cdf(df_analysis_wls['EXPECTED_PROBIT'])
    df_analysis_wls['EXPECTED_DEAD'] = df_analysis_wls['TOTAL'] * df_analysis_wls['EXPECTED_PROP']
    
    observed_dead = df_analysis_wls.get('CORRECTED_DEAD', df_analysis_wls['RESPONSE'])
    expected_dead = df_analysis_wls['EXPECTED_DEAD']
    
    chi_squared_stat = ((observed_dead - expected_dead)**2 / expected_dead).sum()
    degrees_of_freedom = len(df_analysis_wls) - 2
    
    gof_p_value = chi2.sf(chi_squared_stat, degrees_of_freedom) if degrees_of_freedom > 0 else np.nan
    
    goodness_of_fit = {
        "chi_squared": chi_squared_stat,
        "df": degrees_of_freedom,
        "p_value": gof_p_value
    }

    # Create plot
    plt.figure()
    plt.scatter(df_analysis_wls['log_CONC'], df_analysis_wls['EMP_PROBIT'], label='Empirical Probits (Corrected)')
    log_conc_range = np.linspace(df_analysis_wls['log_CONC'].min(), df_analysis_wls['log_CONC'].max(), 100)
    predictions = wls_results.get_prediction(sm.add_constant(log_conc_range))
    prediction_summary = predictions.summary_frame(alpha=0.05)
    plt.plot(log_conc_range, prediction_summary['mean'], color='red', label='Weighted Regression')
    
    plt.xlabel('log10(DOSE)')
    plt.ylabel('Probit of Mortality Proportion (Corrected)')
    plt.title("Probit Analysis-Finney's Method")
    plt.legend()
    plt.grid(True)
    
    img_io = io.BytesIO()
    plt.savefig(img_io, format='png', bbox_inches='tight')
    img_io.seek(0)
    plot_base64 = base64.b64encode(img_io.getvalue()).decode('utf-8')
    plt.close()

    return wls_results, ld_estimates, ld_lower_ci, ld_upper_ci, plot_base64, goodness_of_fit

def fiellers_ci(target_probit, intercept, slope, cov_matrix, alpha=0.05):
    try:
        var_intercept = cov_matrix.loc['const', 'const']
        var_slope = cov_matrix.loc['log_CONC', 'log_CONC']
        cov_intercept_slope = cov_matrix.loc['const', 'log_CONC']
    except KeyError:
        return np.nan, np.nan

    if slope == 0:
        return np.nan, np.nan

    g = (chi2.ppf(1 - alpha, 1) * var_slope) / (slope**2)

    if g >= 1:
        return np.nan, np.nan

    m = (target_probit - intercept) / slope
    term1 = (m - (g * cov_intercept_slope) / var_slope) / (1 - g)
    term2_sqrt_part = (var_intercept / (slope**2)) + (m**2 * var_slope / (slope**2)) - (2 * m * cov_intercept_slope / (slope**2)) + (g * (var_intercept * var_slope - cov_intercept_slope**2) / (slope**2 * var_slope))
    
    if term2_sqrt_part < 0:
        return np.nan, np.nan
        
    term2_sqrt = np.sqrt(term2_sqrt_part)
    
    term2 = term2_sqrt / (1 - g)

    log_ld_lower = term1 - term2 * np.sqrt(chi2.ppf(1 - alpha, 1))
    log_ld_upper = term1 + term2 * np.sqrt(chi2.ppf(1 - alpha, 1))

    return log_ld_lower, log_ld_upper


@app.route('/probit', methods=['POST'])
def analyze():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        df = pd.read_csv(file)
        required_cols = {'DOSE', 'TOTAL', 'RESPONSE'}
        if not required_cols.issubset(df.columns):
            return jsonify({"error": f"Missing required columns. Found: {list(df.columns)}, Required: {list(required_cols)}"}), 400

        # --- Finney's Method ---
        wls_results, ld_estimates, ld_lower_ci, ld_upper_ci, plot, goodness_of_fit = run_probit_analysis(df)
        model_summary = str(wls_results.summary()).split('\n')
        ed_values_data = {
            "Level": list(ld_estimates.keys()),
            "Estimate": [f"{v:.4f}" if not np.isnan(v) else "nan" for v in ld_estimates.values()],
            "Lower CI": [f"{v:.4f}" if not np.isnan(v) else "nan" for v in ld_lower_ci.values()],
            "Upper CI": [f"{v:.4f}" if not np.isnan(v) else "nan" for v in ld_upper_ci.values()]
        }
        goodness_of_fit_data = {
            "Chi-Squared": f"{goodness_of_fit['chi_squared']:.4f}",
            "Degrees of Freedom": goodness_of_fit['df'],
            "P-value": f"{goodness_of_fit['p_value']:.4f}" if not np.isnan(goodness_of_fit['p_value']) else "nan"
        }

        finney_results = {
            "model_summary": model_summary,
            "ed_values": ed_values_data,
            "plot": plot,
            "goodness_of_fit": goodness_of_fit_data
        }

        # --- Profile Likelihood Method ---
        # Prepare df_analysis as in Finney's method
        control_conc = 0
        control_mortality_proportion = 0
        if control_conc in df['DOSE'].values:
            control_row = df[df['DOSE'] == control_conc]
            if not control_row.empty:
                control_n = control_row['TOTAL'].iloc[0]
                control_dead = control_row['RESPONSE'].iloc[0]
                if control_n > 0:
                    control_mortality_proportion = control_dead / control_n
        df_analysis = df[df['DOSE'] > 0].copy()
        if control_mortality_proportion > 0:
            df_analysis['OBS_PROP'] = df_analysis['RESPONSE'] / df_analysis['TOTAL']
            df_analysis['CORRECTED_OBS_PROP'] = np.nan
            for index, row in df_analysis.iterrows():
                observed_mortality_proportion = row['OBS_PROP']
                if (1 - control_mortality_proportion) != 0:
                    corrected_mortality_proportion = (observed_mortality_proportion - control_mortality_proportion) / (1 - control_mortality_proportion)
                    df_analysis.loc[index, 'CORRECTED_OBS_PROP'] = np.maximum(0, np.minimum(1, corrected_mortality_proportion))
                else:
                    df_analysis.loc[index, 'CORRECTED_OBS_PROP'] = 0
            df_analysis['CORRECTED_DEAD'] = (df_analysis['CORRECTED_OBS_PROP'] * df_analysis['TOTAL']).round().astype('Int64')
        else:
            df_analysis['CORRECTED_OBS_PROP'] = df_analysis['RESPONSE'] / df_analysis['TOTAL']
            df_analysis['CORRECTED_DEAD'] = df_analysis['RESPONSE'].astype('Int64')
        df_analysis['N'] = df_analysis['TOTAL']
        df_analysis['log_CONC'] = np.log10(df_analysis['DOSE'])
        df_analysis['EMP_PROBIT'] = norm.ppf(df_analysis['CORRECTED_OBS_PROP'].clip(1e-6, 1 - 1e-6))
        df_analysis_valid = df_analysis.replace([np.inf, -np.inf], np.nan).dropna(subset=['log_CONC', 'EMP_PROBIT'])
        initial_params = [-1.4, 2.2]
        if len(df_analysis_valid) >= 2:
            try:
                from scipy.stats import linregress
                slope_initial, intercept_initial, _, _, _ = linregress(df_analysis_valid['log_CONC'], df_analysis_valid['EMP_PROBIT'])
                initial_params = [intercept_initial, slope_initial]
            except Exception:
                pass
        def probit_log_likelihood(params, log_conc, n, response):
            intercept, slope = params
            predicted_probits = intercept + slope * log_conc
            p = norm.cdf(predicted_probits)
            p = np.clip(p, 1e-10, 1 - 1e-10)
            log_likelihood = np.sum(response * np.log(p) + (n - response) * np.log(1 - p))
            return -log_likelihood
        result = minimize(probit_log_likelihood, initial_params, args=(df_analysis['log_CONC'], df_analysis['N'], df_analysis['CORRECTED_DEAD']))
        mle_intercept, mle_slope = result.x
        # LD values and profile likelihood CIs
        ld_levels = [0.10, 0.25, 0.50, 0.75, 0.90, 0.99]
        ld_estimates = {}
        ld_lower_ci = {}
        ld_upper_ci = {}
        from scipy.interpolate import interp1d
        for level in ld_levels:
            target_probit = norm.ppf(level)
            ld_value = 10**((target_probit - mle_intercept) / mle_slope)
            ld_name = f'LD{int(level*100)}'
            mle_ld_log_conc = (target_probit - mle_intercept) / mle_slope
            log_ld_range = np.linspace(mle_ld_log_conc - 1, mle_ld_log_conc + 1, 100)
            def profile_log_likelihood_ld_log_conc(ld_log_conc_fixed, target_probit_fixed, log_conc, n, response, mle_slope_for_init):
                initial_slope = mle_slope_for_init
                bounds = [(1e-5, None)]
                res = minimize(lambda slope: probit_log_likelihood([target_probit_fixed - slope[0] * ld_log_conc_fixed, slope[0]], log_conc, n, response),
                               [initial_slope], method='L-BFGS-B', bounds=bounds)
                return -res.fun
            profile_lls = [profile_log_likelihood_ld_log_conc(ll, target_probit, df_analysis['log_CONC'], df_analysis['N'], df_analysis['CORRECTED_DEAD'], mle_slope) for ll in log_ld_range]
            mle_log_likelihood = -result.fun
            threshold = mle_log_likelihood - chi2.ppf(0.95, 1) / 2
            ll_values = np.array(profile_lls)
            crossings = np.where(np.diff(np.sign(ll_values - threshold)))[0]
            lower_bound_log_conc_pl = float('nan')
            upper_bound_log_conc_pl = float('nan')
            if len(crossings) >= 2:
                lower_idx = crossings[0]
                upper_idx = crossings[-1]
                x1, y1 = log_ld_range[lower_idx], ll_values[lower_idx]
                x2, y2 = log_ld_range[lower_idx + 1], ll_values[lower_idx + 1]
                if (y2 - y1) != 0:
                    lower_bound_log_conc_pl = x1 + (threshold - y1) * (x2 - x1) / (y2 - y1)
                x1, y1 = log_ld_range[upper_idx], ll_values[upper_idx]
                x2, y2 = log_ld_range[upper_idx + 1], ll_values[upper_idx + 1]
                if (y2 - y1) != 0:
                    upper_bound_log_conc_pl = x1 + (threshold - y1) * (x2 - x1) / (y2 - y1)
                if not np.isnan(lower_bound_log_conc_pl) and not np.isnan(upper_bound_log_conc_pl) and lower_bound_log_conc_pl > upper_bound_log_conc_pl:
                    lower_bound_log_conc_pl, upper_bound_log_conc_pl = upper_bound_log_conc_pl, lower_bound_log_conc_pl
            elif len(crossings) == 1:
                idx = crossings[0]
                x1, y1 = log_ld_range[idx], ll_values[idx]
                x2, y2 = log_ld_range[idx + 1], ll_values[idx + 1]
                if profile_lls[0] > threshold:
                    if (y2 - y1) != 0:
                        upper_bound_log_conc_pl = x1 + (threshold - y1) * (x2 - x1) / (y2 - y1)
                    lower_bound_log_conc_pl = float('nan')
                else:
                    if (y2 - y1) != 0:
                        lower_bound_log_conc_pl = x1 + (threshold - y1) * (x2 - x1) / (y2 - y1)
                    upper_bound_log_conc_pl = float('nan')
            ld_lower_val = 10**lower_bound_log_conc_pl if not np.isnan(lower_bound_log_conc_pl) else float('nan')
            ld_upper_val = 10**upper_bound_log_conc_pl if not np.isnan(upper_bound_log_conc_pl) else float('nan')
            ld_estimates[ld_name] = ld_value
            ld_lower_ci[ld_name] = ld_lower_val
            ld_upper_ci[ld_name] = ld_upper_val
    
        # --- Generate unique plot for Profile Likelihood ---
        plt.figure()
        # Plot empirical probits
        plt.scatter(df_analysis['log_CONC'], df_analysis['EMP_PROBIT'], label='Empirical Probits (Corrected)')
        # Plot MLE fit
        log_conc_range = np.linspace(df_analysis['log_CONC'].min(), df_analysis['log_CONC'].max(), 100)
        predicted_probits_mle = mle_intercept + mle_slope * log_conc_range
        plt.plot(log_conc_range, predicted_probits_mle, color='red', label='MLE Fitted Probit Line')
        # Optionally, plot confidence intervals if desired (not profile likelihood CIs, but from statsmodels)
        # Add title and labels
        plt.xlabel('log10(DOSE)')
        plt.ylabel('Predicted Probits')
        plt.title('Profile Likelihood Method: Predicted Probits vs log10(DOSE)')
        plt.legend()
        plt.grid(True)
        img_io_profile = io.BytesIO()
        plt.savefig(img_io_profile, format='png', bbox_inches='tight')
        img_io_profile.seek(0)
        plot_profile_base64 = base64.b64encode(img_io_profile.getvalue()).decode('utf-8')
        plt.close()
        # Regression equation summary
        equation = f"y = {mle_intercept:.4f} + {mle_slope:.4f} * x"
        intercept_str = f"Intercept: {mle_intercept:.4f}"
        slope_str = f"Slope: {mle_slope:.4f}"
        model_summary = [equation, intercept_str, slope_str]
        # Goodness-of-fit: Pearson chi-square test (same as Finney's method)
        # Calculate expected counts using MLE parameters
        df_analysis['EXPECTED_PROBIT'] = mle_intercept + mle_slope * df_analysis['log_CONC']
        df_analysis['EXPECTED_PROP'] = norm.cdf(df_analysis['EXPECTED_PROBIT'])
        df_analysis['EXPECTED_DEAD'] = df_analysis['N'] * df_analysis['EXPECTED_PROP']
        observed_dead = df_analysis['CORRECTED_DEAD']
        expected_dead = df_analysis['EXPECTED_DEAD']
        chi_squared_stat = ((observed_dead - expected_dead) ** 2 / expected_dead).sum()
        degrees_of_freedom = len(df_analysis) - 2
        p_value = chi2.sf(chi_squared_stat, degrees_of_freedom) if degrees_of_freedom > 0 else np.nan
        goodness_of_fit_data = {
            "Chi-Squared": f"{chi_squared_stat:.4f}",
            "Degrees of Freedom": degrees_of_freedom,
            "P-value": f"{p_value:.4f}" if not np.isnan(p_value) else "nan"
        }
        profile_results = {
            "model_summary": model_summary,
            "ed_values": {
                "Level": list(ld_estimates.keys()),
                "Estimate": [f"{v:.4f}" if not np.isnan(v) else "nan" for v in ld_estimates.values()],
                "Lower CI": [f"{v:.4f}" if not np.isnan(v) else "nan" for v in ld_lower_ci.values()],
                "Upper CI": [f"{v:.4f}" if not np.isnan(v) else "nan" for v in ld_upper_ci.values()]
            },
            "plot": plot_profile_base64,
            "goodness_of_fit": goodness_of_fit_data
        }
    
        return jsonify({
            "finney": finney_results,
            "profile_likelihood": profile_results
        })
    
    except Exception as e:
        logging.error(f"An error occurred during analysis: {e}", exc_info=True)
        # For security, avoid exposing raw exception details to the client in production.
        # A more generic message is returned to the client, while full details are logged.
        return jsonify({"error": "An error occurred during probit analysis. Please check your input data and try again."}), 500


if __name__ == "__main__":
    debug_mode = os.environ.get("FLASK_ENV", "production") == "development"
    app.run(debug=debug_mode, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
