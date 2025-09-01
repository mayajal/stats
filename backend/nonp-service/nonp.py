
import os
import logging
from flask import Flask, request, jsonify
import pandas as pd
from scipy import stats
from statsmodels.stats.contingency_tables import mcnemar
from io import StringIO
from flask_cors import CORS

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["https://vita.chloropy.com","https://vita-zur5dejluq-uc.a.run.app", "http://localhost:9002", "https://vita--statviz-j3txi.us-central1.hosted.app"]}})

@app.route("/")
def health():
    return "OK", 200

def perform_mann_whitney_u_test(data):
    if data.shape[1] != 2:
        raise ValueError("Mann-Whitney U test requires data with exactly two columns, each representing a group.")
    
    group1 = data.iloc[:, 0].dropna()
    group2 = data.iloc[:, 1].dropna()

    statistic, p_value = stats.mannwhitneyu(group1, group2)
    alpha = 0.05
    
    interpretation = f"The Mann-Whitney U test was performed to compare the distributions of the two groups. "
    interpretation += f"The calculated U statistic is {statistic:.4f} and the p-value is {p_value:.4f}. "
    
    if p_value < alpha:
        interpretation += f"Since the p-value ({p_value:.4f}) is less than the significance level alpha ({alpha}), we reject the null hypothesis. "
        interpretation += "This suggests that there is a statistically significant difference in the distributions of the two groups."
    else:
        interpretation += f"Since the p-value ({p_value:.4f}) is not less than the significance level alpha ({alpha}), we fail to reject the null hypothesis. "
        interpretation += "This suggests that there is no statistically significant difference in the distributions of the two groups."

    return {
        "summary": f"Mann-Whitney U test performed between the two groups.",
        "test_statistic": f"U = {statistic:.4f}",
        "p_value": f"p = {p_value:.4f}",
        "alpha_level": alpha,
        "interpretation": interpretation
    }

def perform_kruskal_wallis_test(data):
    if data.shape[1] < 2:
        raise ValueError("Kruskal-Wallis test requires at least two columns, each representing a group.")

    samples = [data[col].dropna() for col in data.columns]
    
    statistic, p_value = stats.kruskal(*samples)
    alpha = 0.05
    
    interpretation = f"The Kruskal-Wallis test was performed to compare the distributions across {len(samples)} groups. "
    interpretation += f"The calculated H statistic is {statistic:.4f} and the p-value is {p_value:.4f}. "
    
    if p_value < alpha:
        interpretation += f"Since the p-value ({p_value:.4f}) is less than the significance level alpha ({alpha}), we reject the null hypothesis. "
        interpretation += "This suggests that there is a statistically significant difference in the distributions of at least two of the groups."
    else:
        interpretation += f"Since the p-value ({p_value:.4f}) is not less than the significance level alpha ({alpha}), we fail to reject the null hypothesis. "
        interpretation += "This suggests that there is no statistically significant difference in the distributions among the groups."

    return {
        "summary": f"Kruskal-Wallis test performed on {len(samples)} groups.",
        "test_statistic": f"H = {statistic:.4f}",
        "p_value": f"p = {p_value:.4f}",
        "alpha_level": alpha,
        "interpretation": interpretation
    }

def perform_chi_square_independence_test(data):
    chi2, p, dof, ex = stats.chi2_contingency(data)
    alpha = 0.05
    critical_value = stats.chi2.ppf(1 - alpha, dof)
    
    interpretation = f"The calculated Chi-square value is {chi2:.4f}. "
    interpretation += f"The critical value at alpha={alpha} with {dof} degrees of freedom is {critical_value:.4f}. "
    
    if chi2 > critical_value:
        interpretation += f"Since the calculated Chi-square value ({chi2:.4f}) is greater than the critical value ({critical_value:.4f}), we reject the null hypothesis. "
        interpretation += "The result is statistically significant, suggesting a significant association between the variables."
    else:
        interpretation += f"Since the calculated Chi-square value ({chi2:.4f}) is not greater than the critical value ({critical_value:.4f}), we fail to reject the null hypothesis. "
        interpretation += "The result is not statistically significant, suggesting no significant association between the variables."

    return {
        "summary": "Chi-square test of independence performed.",
        "calculated_chi_square": f"{chi2:.4f}",
        "p_value": f"{p:.4f}",
        "degrees_of_freedom": dof,
        "alpha_level": alpha,
        "critical_value": f"{critical_value:.4f}",
        "interpretation": interpretation
    }

def perform_chi_square_goodness_of_fit_test(data):
    if data.shape[1] not in [1, 2]:
        raise ValueError("Chi-square goodness of fit test requires one column for observed frequencies, and an optional second column for expected frequencies.")

    observed = data.iloc[:, 0].dropna()
    expected = None
    if data.shape[1] == 2:
        expected = data.iloc[:, 1].dropna()

    if expected is not None and len(observed) != len(expected):
        raise ValueError("Observed and expected frequencies must have the same number of categories.")

    chi2, p = stats.chisquare(f_obs=observed, f_exp=expected)
    dof = len(observed) - 1
    alpha = 0.05
    critical_value = stats.chi2.ppf(1 - alpha, dof)

    interpretation = f"The Chi-square goodness of fit test was performed. "
    interpretation += f"The calculated Chi-square value is {chi2:.4f}. "
    interpretation += f"The critical value at alpha={alpha} with {dof} degrees of freedom is {critical_value:.4f}. "

    if chi2 > critical_value:
        interpretation += f"Since the calculated Chi-square value ({chi2:.4f}) is greater than the critical value ({critical_value:.4f}), we reject the null hypothesis. "
        interpretation += "The result is statistically significant, suggesting the observed frequencies do not follow the expected distribution."
    else:
        interpretation += f"Since the calculated Chi-square value ({chi2:.4f}) is not greater than the critical value ({critical_value:.4f}), we fail to reject the null hypothesis. "
        interpretation += "The result is not statistically significant, suggesting the observed frequencies follow the expected distribution."

    return {
        "summary": "Chi-square goodness of fit test performed.",
        "calculated_chi_square": f"{chi2:.4f}",
        "p_value": f"{p:.4f}",
        "degrees_of_freedom": dof,
        "alpha_level": alpha,
        "critical_value": f"{critical_value:.4f}",
        "interpretation": interpretation
    }

def perform_wilcoxon_test(data):
    if data.shape[1] != 2:
        raise ValueError("Wilcoxon signed-rank test requires exactly two columns of data for paired samples.")
    group1 = data.iloc[:, 0].dropna()
    group2 = data.iloc[:, 1].dropna()
    statistic, p_value = stats.wilcoxon(group1, group2)
    alpha = 0.05
    
    interpretation = f"The Wilcoxon signed-rank test was performed to compare two paired groups. "
    interpretation += f"The calculated W statistic is {statistic:.4f} and the p-value is {p_value:.4f}. "
    
    if p_value < alpha:
        interpretation += f"Since the p-value ({p_value:.4f}) is less than the significance level alpha ({alpha}), we reject the null hypothesis. "
        interpretation += "This suggests that there is a statistically significant difference between the paired samples."
    else:
        interpretation += f"Since the p-value ({p_value:.4f}) is not less than the significance level alpha ({alpha}), we fail to reject the null hypothesis. "
        interpretation += "This suggests that there is no statistically significant difference between the paired samples."

    return {
        "summary": "Wilcoxon signed-rank test performed.",
        "test_statistic": f"W = {statistic:.4f}",
        "p_value": f"p = {p_value:.4f}",
        "alpha_level": alpha,
        "interpretation": interpretation
    }

def perform_mcnemar_test(data):
    if data.shape != (2, 2):
        raise ValueError("McNemar's test requires a 2x2 contingency table.")
    result = mcnemar(data.values)
    statistic = result.statistic
    p_value = result.pvalue
    alpha = 0.05
    
    interpretation = f"McNemar's test was performed on a 2x2 contingency table to assess the difference between paired proportions. "
    interpretation += f"The calculated statistic is {statistic:.4f} and the p-value is {p_value:.4f}. "
    
    if p_value < alpha:
        interpretation += f"Since the p-value ({p_value:.4f}) is less than the significance level alpha ({alpha}), we reject the null hypothesis. "
        interpretation += "This suggests a statistically significant change in proportions."
    else:
        interpretation += f"Since the p-value ({p_value:.4f}) is not less than the significance level alpha ({alpha}), we fail to reject the null hypothesis. "
        interpretation += "This suggests no statistically significant change in proportions."

    return {
        "summary": "McNemar’s test performed.",
        "test_statistic": f"Statistic = {statistic:.4f}",
        "p_value": f"p = {p_value:.4f}",
        "alpha_level": alpha,
        "interpretation": interpretation
    }

def perform_friedman_test(data):
    if data.shape[1] < 3:
        raise ValueError("Friedman test requires at least three columns for repeated measures.")
    statistic, p_value = stats.friedmanchisquare(*[data[col] for col in data.columns])
    alpha = 0.05
    dof = data.shape[1] - 1
    critical_value = stats.chi2.ppf(1 - alpha, dof)
    
    interpretation = f"The Friedman test was performed to compare the distributions of {data.shape[1]} repeated measures. "
    interpretation += f"The calculated Q statistic is {statistic:.4f} and the p-value is {p_value:.4f}. "
    interpretation += f"The critical value at alpha={alpha} with {dof} degrees of freedom is {critical_value:.4f}. "
    
    if p_value < alpha:
        interpretation += f"Since the p-value ({p_value:.4f}) is less than the significance level alpha ({alpha}), we reject the null hypothesis. "
        interpretation += "This suggests that there is a statistically significant difference among the repeated measures."
    else:
        interpretation += f"Since the p-value ({p_value:.4f}) is not less than the significance level alpha ({alpha}), we fail to reject the null hypothesis. "
        interpretation += "This suggests that there is no statistically significant difference among the repeated measures."

    return {
        "summary": "Friedman test performed.",
        "test_statistic": f"Q = {statistic:.4f}",
        "p_value": f"p = {p_value:.4f}",
        "degrees_of_freedom": dof,
        "alpha_level": alpha,
        "critical_value": f"{critical_value:.4f}",
        "interpretation": interpretation
    }

ANALYSIS_DISPATCHER = {
    'mann_whitney_u': perform_mann_whitney_u_test,
    'kruskal_wallis': perform_kruskal_wallis_test,
    'chi_square_independence': perform_chi_square_independence_test,
    'chi_square_goodness_of_fit': perform_chi_square_goodness_of_fit_test,
    'wilcoxon_signed_rank': perform_wilcoxon_test,
    'mcnemar': perform_mcnemar_test,
    'friedman': perform_friedman_test,
}

@app.route('/nonp/analyze', methods=['POST'])
def statistical_test():
    logging.info("Received request for statistical analysis.")
    try:
        test_type = request.form.get('test_type')
        if not test_type:
            logging.error("No test type specified.")
            return jsonify({"error": "No test type specified"}), 400

        logging.info(f"Test type: {test_type}")

        header_option = 0  # Default to using the first row as header

        if 'file' in request.files and request.files['file'].filename != '':
            file = request.files['file']
            logging.info(f"Received file: {file.filename}")
            try:
                # Read the first line to check for a header
                file.seek(0)
                first_line = file.readline().decode('utf-8')
                file.seek(0)
                # Simple check: if any comma-separated value is not a number, assume it's a header
                has_header = any(not item.replace('.', '', 1).replace('-','',1).strip().isdigit() for item in first_line.split(','))
                if not has_header:
                    header_option = None # No header

                df = pd.read_csv(file, header=header_option)
            except Exception as e:
                logging.error(f"Error reading CSV file: {e}")
                return jsonify({"error": f"Error reading CSV file: {e}"}), 400
        elif 'data' in request.form and request.form['data']:
            csv_data = request.form['data']
            logging.info("Received data via text area.")
            try:
                first_line = csv_data.splitlines()[0]
                has_header = any(not item.replace('.', '', 1).replace('-','',1).strip().isdigit() for item in first_line.split(','))
                if not has_header:
                    header_option = None

                df = pd.read_csv(StringIO(csv_data), header=header_option)
            except Exception as e:
                logging.error(f"Error reading CSV data from text: {e}")
                return jsonify({"error": f"Error reading CSV data from text: {e}"}), 400
        else:
            logging.error("No data provided.")
            return jsonify({"error": "No data provided"}), 400

        logging.info(f"Data successfully loaded into DataFrame. Shape: {df.shape}")

        if test_type in ANALYSIS_DISPATCHER:
            analysis_function = ANALYSIS_DISPATCHER[test_type]
            logging.info(f"Dispatching to function: {analysis_function.__name__}")
            try:
                results = analysis_function(df)
                logging.info("Analysis successful.")
                return jsonify(results)
            except ValueError as ve:
                logging.error(f"Data validation error for {test_type}: {ve}")
                return jsonify({"error": f"Data format error for {test_type}: {ve}"}), 400
        else:
            logging.error(f"Unsupported test type: {test_type}")
            return jsonify({"error": f"Test type '{test_type}' not supported"}), 400

    except Exception as e:
        logging.error(f"An unexpected error occurred: {str(e)}")
        return jsonify({"error": f"An unexpected server error occurred: {str(e)}"}), 500

if __name__ == '__main__':
    debug_mode = os.environ.get("FLASK_ENV", "production") == "development"
    app.run(debug=debug_mode, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
