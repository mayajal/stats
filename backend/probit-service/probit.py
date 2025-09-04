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

    if control_conc in df['CONC'].values:
        control_row = df[df['CONC'] == control_conc]
        if not control_row.empty:
            control_exists = True
            control_n = control_row['TOTAL'].iloc[0]
            control_dead = control_row['DEAD'].iloc[0]
            if control_n > 0:
                control_mortality_proportion = control_dead / control_n
            
    df_analysis = df[df['CONC'] > 0].copy()

    if control_mortality_proportion > 0:
        df_analysis['OBS_PROP'] = df_analysis['DEAD'] / df_analysis['TOTAL']
        df_analysis['CORRECTED_OBS_PROP'] = np.nan 

        for index, row in df_analysis.iterrows():
            observed_mortality_proportion = row['OBS_PROP']
            if (1 - control_mortality_proportion) != 0:
                corrected_mortality_proportion = (observed_mortality_proportion - control_mortality_proportion) / (1 - control_mortality_proportion)
                df_analysis.loc[index, 'CORRECTED_OBS_PROP'] = np.maximum(0, np.minimum(1, corrected_mortality_proportion))
            else:
                df_analysis.loc[index, 'CORRECTED_OBS_PROP'] = 0

        df_analysis['CORRECTED_DEAD'] = (df_analysis['CORRECTED_OBS_PROP'] * df_analysis['TOTAL']).round().astype('Int64')

    df_analysis['OBS_PROP_USED'] = df_analysis.get('CORRECTED_OBS_PROP', df_analysis['DEAD'] / df_analysis['TOTAL'])
    
    epsilon = 1e-6
    df_analysis['EMP_PROBIT'] = norm.ppf(df_analysis['OBS_PROP_USED'].clip(epsilon, 1 - epsilon))
    df_analysis['log_CONC'] = np.log10(df_analysis['CONC'])

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
    
    observed_dead = df_analysis_wls.get('CORRECTED_DEAD', df_analysis_wls['DEAD'])
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
    
    plt.xlabel('log10(CONC)')
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
        # Ensure required columns are present
        required_cols = {'CONC', 'TOTAL', 'DEAD'}
        if not required_cols.issubset(df.columns):
            return jsonify({"error": f"Missing required columns. Found: {list(df.columns)}, Required: {list(required_cols)}"}), 400

        wls_results, ld_estimates, ld_lower_ci, ld_upper_ci, plot, goodness_of_fit = run_probit_analysis(df)

        # Format results for JSON response
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

        return jsonify({
            "model_summary": model_summary,
            "ed_values": ed_values_data,
            "plot": plot,
            "goodness_of_fit": goodness_of_fit_data
        })

    except Exception as e:
        logging.error(f"An error occurred during analysis: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    debug_mode = os.environ.get("FLASK_ENV", "production") == "development"
    app.run(debug=debug_mode, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))


    # Profile Likelihood Method for Probit Analysis

# The df_analysis DataFrame with corrected data is already prepared from the previous step.

# Convert to log10 concentration for analysis
df_analysis['log_CONC'] = np.log10(df_analysis['CONC'])

# Define the Probit likelihood function
def probit_log_likelihood(params, log_conc, n, dead):
    intercept, slope = params
    # Calculate predicted probits
    predicted_probits = intercept + slope * log_conc
    # Convert probits to probabilities using the inverse CDF of the normal distribution
    p = norm.cdf(predicted_probits)
    # Avoid log(0) or log(1) which can occur if p is exactly 0 or 1
    p = np.clip(p, 1e-10, 1 - 1e-10)
    # Calculate the log-likelihood for a binomial distribution
    # Use the corrected dead counts and original N
    log_likelihood = np.sum(dead * np.log(p) + (n - dead) * np.log(1 - p))
    return -log_likelihood # Minimize the negative log-likelihood

# Initial guess for parameters (intercept, slope)
# Use empirical probits from corrected data for initial guess
df_analysis['EMP_PROBIT'] = norm.ppf(df_analysis['CORRECTED_OBS_PROP'].clip(1e-6, 1 - 1e-6))
# Handle potential inf values in EMP_PROBIT before regression
df_analysis_valid = df_analysis.replace([np.inf, -np.inf], np.nan).dropna(subset=['log_CONC', 'EMP_PROBIT'])

initial_params = [-1.4, 2.2] # Fallback initial guess, close to Finney's results

if len(df_analysis_valid) >= 2:
    try:
        # Simple linear regression for a more informed initial guess
        from scipy.stats import linregress
        slope_initial, intercept_initial, _, _, _ = linregress(df_analysis_valid['log_CONC'], df_analysis_valid['EMP_PROBIT'])
        initial_params = [intercept_initial, slope_initial]
        print(f"\nInitial parameters from linear regression (for MLE guess): Intercept = {intercept_initial:.4f}, Slope = {slope_initial:.4f}")
    except ValueError as e:
        print(f"\nCould not perform linear regression for initial guess: {e}. Using fallback initial guess.")


from scipy.optimize import minimize
from scipy.stats import chi2 # Import chi2

# Maximize the likelihood (minimize the negative likelihood) using corrected dead counts
# Ensure to use the corrected dead counts ('CORRECTED_DEAD') and original N ('N') for the likelihood calculation
result = minimize(probit_log_likelihood, initial_params, args=(df_analysis['log_CONC'], df_analysis['N'], df_analysis['CORRECTED_DEAD']))

# Extract the maximum likelihood estimates (MLEs)
mle_intercept, mle_slope = result.x
print("\nProfile Likelihood Method Probit Analysis")
print("-------------------------------------------")
print(f"MLE Intercept: {mle_intercept:.4f}")
print(f"MLE Slope: {mle_slope:.4f}")
print(f"Maximum Log-Likelihood: {-result.fun:.4f}")

# Calculate the LD50, LD90, LD99 from MLEs
# LD_p is the concentration at which predicted probit is norm.ppf(p)
# norm.ppf(p) = intercept + slope * log10(LD_p)
# log10(LD_p) = (norm.ppf(p) - intercept) / slope

ld_levels = [0.50, 0.90, 0.99]
z = norm.ppf(0.975) # for 95% confidence interval

print("\nCalculated LD values and 95% Confidence Intervals (Profile Likelihood):")
print("---------------------------------------------------------------------")

# --- Profile Likelihood for LDs Confidence Intervals ---

# Define the profile log-likelihood function for a fixed log10(LD_p) - Define outside the loop
def profile_log_likelihood_ld_log_conc(ld_log_conc_fixed, target_probit_fixed, log_conc, n, dead, mle_slope_for_init):
     # Minimize the negative log-likelihood by optimizing slope for this fixed ld_log_conc
     # We need to express intercept in terms of slope and ld_log_conc_fixed: intercept = target_probit_fixed - slope * ld_log_conc_fixed
     # So the parameters to optimize are just the slope
     initial_slope = mle_slope_for_init # Use MLE slope as initial guess
     bounds = [(1e-5, None)] # Assuming positive slope

     res = minimize(lambda slope: probit_log_likelihood([target_probit_fixed - slope[0] * ld_log_conc_fixed, slope[0]], log_conc, n, dead),
                    [initial_slope], method='L-BFGS-B', bounds=bounds)

     return -res.fun # Return the maximized log-likelihood


for level in ld_levels:
    target_probit = norm.ppf(level)
    ld_value = 10**((target_probit - mle_intercept) / mle_slope)
    ld_name = f'LD{int(level*100)}'

    # Calculate the profile log-likelihood across a range of log10(LD_p) values
    # Choose a range around the MLE log10(LD_p) for this specific LD level
    mle_ld_log_conc = (target_probit - mle_intercept) / mle_slope
    # Adjust range dynamically based on MLE estimate
    log_ld_range = np.linspace(mle_ld_log_conc - 1, mle_ld_log_conc + 1, 100) # Adjust range as needed

    profile_lls = [profile_log_likelihood_ld_log_conc(ll, target_probit, df_analysis['log_CONC'], df_analysis['N'], df_analysis['CORRECTED_DEAD'], mle_slope) for ll in log_ld_range]

    # Calculate the threshold for the confidence interval (MLE Log-Likelihood - Chi-squared value / 2)
    mle_log_likelihood = -result.fun
    threshold = mle_log_likelihood - chi2.ppf(0.95, 1) / 2

    # Find the log10(LD_p) values where the profile log-likelihood crosses the threshold
    # This requires interpolation
    from scipy.interpolate import interp1d

    # Create an interpolation function for the profile log-likelihood
    sorted_indices = np.argsort(log_ld_range)
    interp_func = interp1d(np.array(profile_lls)[sorted_indices], np.array(log_ld_range)[sorted_indices], kind='linear', fill_value="extrapolate") # Use extrapolate

    # Find where the profile likelihood crosses the threshold
    ll_values = np.array(profile_lls)
    crossings = np.where(np.diff(np.sign(ll_values - threshold)))[0]

    lower_bound_log_conc_pl = float('nan')
    upper_bound_log_conc_pl = float('nan')

    if len(crossings) >= 2:
        # Interpolate to find the exact crossing points
        # A simpler approach for interpolation at the crossing points:
        lower_idx = crossings[0]
        upper_idx = crossings[-1]

        # Interpolate for the lower bound
        x1, y1 = log_ld_range[lower_idx], ll_values[lower_idx]
        x2, y2 = log_ld_range[lower_idx + 1], ll_values[lower_idx + 1]
        if (y2 - y1) != 0:
            lower_bound_log_conc_pl = x1 + (threshold - y1) * (x2 - x1) / (y2 - y1)


        # Interpolate for the upper bound
        x1, y1 = log_ld_range[upper_idx], ll_values[upper_idx]
        x2, y2 = log_ld_range[upper_idx + 1], ll_values[upper_idx + 1]
        if (y2 - y1) != 0:
            upper_bound_log_conc_pl = x1 + (threshold - y1) * (x2 - x1) / (y2 - y1)


        # Ensure lower is indeed lower than upper
        if not np.isnan(lower_bound_log_conc_pl) and not np.isnan(upper_bound_log_conc_pl) and lower_bound_log_conc_pl > upper_bound_log_conc_pl:
             lower_bound_log_conc_pl, upper_bound_log_conc_pl = upper_bound_log_conc_pl, lower_bound_log_conc_pl


    elif len(crossings) == 1:
         print(f"\nWarning for {ld_name}: Only one crossing found. Confidence interval may extend beyond the calculated range.")
         # Depending on which side the crossing is, one bound will be outside the range
         if profile_lls[0] > threshold: # Threshold is below the start of the profile
             # Interpolate for the upper bound
             idx = crossings[0]
             x1, y1 = log_ld_range[idx], ll_values[idx]
             x2, y2 = log_ld_range[idx + 1], ll_values[idx + 1]
             if (y2 - y1) != 0:
                 upper_bound_log_conc_pl = x1 + (threshold - y1) * (x2 - x1) / (y2 - y1)
             else:
                 upper_bound_log_conc_pl = float('nan')
             # Lower bound is effectively negative infinity on log scale, represent as nan
             lower_bound_log_conc_pl = float('nan')
         else: # Threshold is below the end of the profile
             # Interpolate for the lower bound
             idx = crossings[0]
             x1, y1 = log_ld_range[idx], ll_values[idx]
             x2, y2 = log_ld_range[idx + 1], ll_values[idx + 1]
             if (y2 - y1) != 0:
                 lower_bound_log_conc_pl = x1 + (threshold - y1) * (x2 - x1) / (y2 - y1)
             else:
                 lower_bound_log_conc_pl = float('nan')
             # Upper bound is effectively positive infinity on log scale, represent as nan
             upper_bound_log_conc_pl = float('nan')
    else:
        print(f"\nCould not determine confidence interval bounds for {ld_name} from profile likelihood.")


    # Convert log10 confidence interval back to original scale
    ld_lower_pl = 10**lower_bound_log_conc_pl if not np.isnan(lower_bound_log_conc_pl) else float('nan')
    ld_upper_pl = 10**upper_bound_log_conc_pl if not np.isnan(upper_bound_log_conc_pl) else float('nan')

    print(f'{ld_name}: {ld_value:.4f}')
    print(f'{ld_name} 95% Confidence Interval (Profile Likelihood): ({ld_lower_pl:.4f}, {ld_upper_pl:.4f})')

# Store LD values and confidence intervals for comparison plot
ld50_mle = 10**((norm.ppf(0.50) - mle_intercept) / mle_slope)
ld50_lower_pl = 10**((norm.ppf(0.50) - mle_intercept) / mle_slope - z * np.sqrt((1/mle_slope**2) * (wls_results.cov_params().loc['const','const'] + ((norm.ppf(0.50) - mle_intercept)/mle_slope)**2 * wls_results.cov_params().loc['log_CONC','log_CONC'] + 2*((norm.ppf(0.50) - mle_intercept)/mle_slope)*wls_results.cov_params().loc['const','log_CONC'])))
ld50_upper_pl = 10**((norm.ppf(0.50) - mle_intercept) / mle_slope + z * np.sqrt((1/mle_slope**2) * (wls_results.cov_params().loc['const','const'] + ((norm.ppf(0.50) - mle_intercept)/mle_slope)**2 * wls_results.cov_params().loc['log_CONC','log_CONC'] + 2*((norm.ppf(0.50) - mle_intercept)/mle_slope)*wls_results.cov_params().loc['const','log_CONC'])))


# Plotting the profile likelihood for LD50 as an example
# Recalculate for LD50 specifically for the plot
ld50_target_probit = norm.ppf(0.50)
ld50_mle_log_conc = (ld50_target_probit - mle_intercept) / mle_slope
log_ld50_range_plot = np.linspace(ld50_mle_log_conc - 1, ld50_mle_log_conc + 1, 100)
profile_lls_ld50_plot = [profile_log_likelihood_ld_log_conc(ll, ld50_target_probit, df_analysis['log_CONC'], df_analysis['N'], df_analysis['CORRECTED_DEAD'], mle_slope) for ll in log_ld50_range_plot]
threshold_ld50_plot = -result.fun - chi2.ppf(0.95, 1) / 2


plt.figure()
plt.plot(log_ld50_range_plot, profile_lls_ld50_plot, label='Profile Log-Likelihood for LD50')
plt.axhline(y=-result.fun, color='green', linestyle='--', label='Maximum Log-Likelihood (MLE)')
plt.axhline(y=threshold_ld50_plot, color='red', linestyle='--', label='95% Confidence Interval Threshold')
plt.xlabel('log10(LD50)')
plt.ylabel('Profile Log-Likelihood')
plt.title('Profile Log-Likelihood for LD50')
plt.legend()
plt.grid(True)
plt.show()

# New plot: Predicted probits vs log10(CONC) with MLE line and confidence interval
plt.figure()

# Use statsmodels Probit model for plotting confidence intervals on predicted values
# Prepare data in binomial format
response_list_analysis = []
for index, row in df_analysis.iterrows():
    corrected_dead_count = row['CORRECTED_DEAD']
    alive_count = row['N'] - corrected_dead_count
    response_list_analysis.extend([1] * corrected_dead_count + [0] * alive_count)

df_binomial_analysis = pd.DataFrame({
    'CONC': np.repeat(df_analysis['CONC'], df_analysis['N']),
    'DEAD': response_list_analysis
})
df_binomial_analysis['log_CONC'] = np.log10(df_binomial_analysis['CONC'])
df_binomial_analysis['const'] = 1

X_binomial_analysis = df_binomial_analysis[['const', 'log_CONC']]
y_binomial_analysis = df_binomial_analysis['DEAD']

# Fit the probit model using statsmodels (to get prediction intervals easily)
# Use the MLE parameters from scipy.minimize as starting values for statsmodels for consistency
model_sm_analysis = sm.Probit(y_binomial_analysis, X_binomial_analysis)
# Fit the model, potentially using the MLE results as initial parameters
result_sm_analysis = model_sm_analysis.fit(start_params=[mle_intercept, mle_slope], disp=False)


# Get predictions and confidence intervals from statsmodels result
log_conc_range_plot = np.linspace(df_analysis['log_CONC'].min(), df_analysis['log_CONC'].max(), 100)
predictions_sm_analysis = result_sm_analysis.get_prediction(sm.add_constant(log_conc_range_plot))
# Based on previous check, column names are 'ci_lower' and 'ci_upper'
prediction_summary_sm_analysis = predictions_sm_analysis.summary_frame(alpha=0.05)


# Plot the empirical probits from the corrected data
plt.scatter(df_analysis['log_CONC'], df_analysis['EMP_PROBIT'], label='Empirical Probits (Corrected)')

# Plot the fitted probit line using MLE parameters (from scipy.minimize)
predicted_probits_mle = mle_intercept + mle_slope * log_conc_range_plot
plt.plot(log_conc_range_plot, predicted_probits_mle, color='red', label='MLE Fitted Probit Line')

# Plot the confidence interval band from statsmodels using the correct column names
plt.fill_between(log_conc_range_plot, prediction_summary_sm_analysis['ci_lower'], prediction_summary_sm_analysis['ci_upper'], color='red', alpha=0.2, label='95% Confidence Interval')


plt.xlabel('log10(CONC)')
plt.ylabel('Predicted Probits')
plt.title('Profile Likelihood Method: Predicted Probits vs log10(CONC) with 95% CI')
plt.legend()
plt.grid(True)
plt.show()