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
import logging
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["https://vita.chloropy.com","https://vita-zur5dejluq-uc.a.run.app", "http://localhost:9002", "https://vita--statviz-j3txi.us-central1.hosted.app"]}})

@app.route("/")
def health():
    return "OK", 200

@app.route('/rbd/analyze', methods=['POST'])
def analyze():
    def assign_significance_letters(tukey_df, means):
        means = means.sort_values(ascending=False)
        treatments = list(means.index)
        letters = {treatment: '' for treatment in treatments}
        current_letter = 'a'
        n_treatments = len(treatments)
        is_significant_matrix = pd.DataFrame(True, index=treatments, columns=treatments)
        for index, row in tukey_df.iterrows():
            g1 = row['group1']
            g2 = row['group2']
            rejected = row['reject']
            is_significant_matrix.loc[g1, g2] = rejected
            is_significant_matrix.loc[g2, g1] = rejected

        for i, treatment in enumerate(treatments):
            if not letters[treatment]:
                letters[treatment] = current_letter
            for j in range(i + 1, n_treatments):
                other_treatment = treatments[j]
                if not is_significant_matrix.loc[treatment, other_treatment]:
                    letters[other_treatment] += current_letter
            current_letter = chr(ord(current_letter) + 1)

        for treatment in letters:
            letters[treatment] = ''.join(sorted(set(letters[treatment])))
        return letters

    if 'data' not in request.form:
        logging.error("No data part in form")
        return jsonify({"error": "No data part in form"}), 400

    data_str = request.form.get('data')
    if not data_str:
        logging.error("Data is empty")
        return jsonify({"error": "Data is empty"}), 400

    try:
        df = pd.read_json(io.StringIO(data_str))
        logging.info("Successfully processed incoming data.")
    except Exception as e:
        logging.error(f"Error processing data: {str(e)}")
        return jsonify({"error": f"Error processing data: {str(e)}"}), 400

    block_col = request.form.get('block_col')
    factor_col = request.form.get('factor_col')
    response_col = request.form.get('response_col')

    if not all([block_col, factor_col, response_col]):
        return jsonify({"error": "Missing one or more required fields: block_col, factor_col, response_col"}), 400

    selected_cols = [block_col, factor_col, response_col]
    for col in selected_cols:
        if col not in df.columns:
            return jsonify({"error": f"Column '{col}' not found in the uploaded file."}), 400

    df_processed = df[selected_cols].copy()

    if not pd.api.types.is_numeric_dtype(df_processed[response_col]):
        return jsonify({"error": f"Response column '{response_col}' must be numeric"}), 400

    try:
        formula = f'Q("{response_col}") ~ C(Q("{block_col}")) + C(Q("{factor_col}"))'
        model = ols(formula, data=df_processed).fit()
        anova_table = sm.stats.anova_lm(model, typ=2)
        anova_table = anova_table.round(4)

        groups = [df_processed[response_col][df_processed[factor_col] == level] for level in df_processed[factor_col].unique()]
        f_stat, p_val = stats.f_oneway(*groups)
        f_oneway_results = {
            factor_col: {"f_stat": f_stat, "p_val": p_val}
        }
        f_oneway_df = pd.DataFrame(f_oneway_results).T
        f_oneway_df.rename(columns={'f_stat': 'F-statistic', 'p_val': 'P-Value'}, inplace=True)
        f_oneway_df['Significance'] = f_oneway_df['P-Value'].apply(lambda p: 'Significant' if p < 0.05 else 'Not significant')
        f_oneway_df.index.name = 'Factor'
        f_oneway_df = f_oneway_df.reset_index()
        numeric_cols = ['F-statistic', 'P-Value']
        f_oneway_df[numeric_cols] = f_oneway_df[numeric_cols].round(4)

    except Exception as e:
        return jsonify({"error": f"Error fitting ANOVA model: {str(e)}"}), 400

    tukey_results = {}
    mean_separation_results = {}
    cd_value = None
    tukey_explanation = '''<br>
<p><b>Explanation of the Post-hoc Table:</b></p>
<ul>
    <li><b>group1, group2:</b> The two groups being compared.</li>
    <li><b>meandiff:</b> The difference in the means between group1 and group2 (mean of group2 - mean of group1).</li>
    <li><b>lower, upper:</b> The lower and upper bounds of the confidence interval for the mean difference. If this interval does not contain 0, it suggests a significant difference.</li>
    <li><b>reject:</b> A boolean value (True/False) indicating whether the null hypothesis of no difference between the two group means is rejected at the chosen alpha level.</li>
    <li><b>p-adj:</b> The adjusted p-value for the comparison. This value is adjusted to account for multiple comparisons, reducing the chance of a Type I error (false positive).</li>
</ul>
<p><b>Interpretation:</b></p>
<p>A 'True' in the 'reject' column for a comparison indicates a statistically significant difference between the means of the two groups at the alpha = 0.05 level.</p>
<hr>
<p><b>--- Understanding Discrepancies Between ANOVA and Post-hoc Results ---</b></p>
<p>It is possible to have a significant result in the overall ANOVA for a factor,
but find no significant pairwise differences in post-hoc tests like Tukey HSD.
Here's why:</p>
<ul>
    <li>ANOVA tests the null hypothesis that <em>all</em> group means are equal. A significant p-value (e.g., < 0.05) means we reject this overall hypothesis, concluding that <em>at least one</em> group mean is different from the others.</li>
    <li>Post-hoc tests, like Tukey HSD, perform pairwise comparisons between specific group means. They are more conservative than the overall ANOVA because they adjust the significance level (p-value) to account for multiple comparisons, which reduces the chance of false positives (Type I errors).</li>
</ul>
<p>So, a significant ANOVA result indicates a difference exists somewhere among the group means, but the post-hoc test might not find specific pairs that are significantly different after the adjustment for multiple comparisons, especially if the overall effect is modest or the differences are spread across several groups rather than concentrated in one or two large pairwise differences.</p>
'''

    try:
        if df_processed[factor_col].nunique() < 2:
            tukey_results[factor_col] = f"Factor '{factor_col}' has less than 2 levels, Tukey HSD not applicable"
        else:
            tukey = pairwise_tukeyhsd(
                endog=df_processed[response_col],
                groups=df_processed[factor_col],
                alpha=0.05
            )

            tukey_df = pd.DataFrame(data=tukey._results_table.data[1:], columns=tukey._results_table.data[0])
            numeric_cols = ['meandiff', 'p-adj', 'lower', 'upper']
            for col in numeric_cols:
                tukey_df[col] = pd.to_numeric(tukey_df[col], errors='coerce')
            tukey_df[numeric_cols] = tukey_df[numeric_cols].round(4)

            tukey_results[factor_col] = tukey_df.to_json(orient='records')

            # Calculate Critical Difference (CD)
            mse = model.mse_resid
            n_blocks = df_processed[block_col].nunique()
            q_crit = tukey.q_crit
            cd_value = q_crit * np.sqrt(mse / n_blocks)


            factor_groups = df_processed.groupby(factor_col)[response_col]
            factor_means = factor_groups.mean()
            factor_sem = factor_groups.sem()
            significance_letters = assign_significance_letters(tukey_df, factor_means)

            mean_separation_df = factor_means.to_frame(name='Mean')
            mean_separation_df['SEM'] = factor_sem
            mean_separation_df = mean_separation_df.reset_index()
            mean_separation_df.rename(columns={factor_col: 'Treatment'}, inplace=True)
            mean_separation_df['Significance'] = mean_separation_df['Treatment'].map(significance_letters)
            mean_separation_df = mean_separation_df.sort_values(by='Mean', ascending=False).reset_index(drop=True)

            numeric_cols_to_format = mean_separation_df.select_dtypes(include=['float', 'number']).columns.tolist()
            if 'Significance' in numeric_cols_to_format:
                numeric_cols_to_format.remove('Significance')
            if 'Treatment' in numeric_cols_to_format:
                numeric_cols_to_format.remove('Treatment')

            for col in numeric_cols_to_format:
                mean_separation_df[col] = mean_separation_df[col].apply(lambda x: f"{x:.4f}")

            mean_separation_results[factor_col] = mean_separation_df.to_json(orient='records')

    except Exception as e:
        tukey_results[factor_col] = f"Error performing Tukey HSD for '{factor_col}': {e}"

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
        logging.info("Generated Q-Q plot.")

        # Bar plot of means with SEM (Sorted by factor name in ascending order)
        fig, ax = plt.subplots()
        # Sort mean_separation_df by 'Treatment' (factor name) in ascending order for plotting
        plot_data = mean_separation_df.sort_values(by='Treatment', ascending=True).reset_index(drop=True)
        ax.bar(plot_data['Treatment'], plot_data['Mean'].astype(float), yerr=plot_data['SEM'].astype(float), capsize=5)
        ax.set_xlabel(factor_col)
        ax.set_ylabel(f"Mean of {response_col}")
        ax.set_title("Mean of each Factor Level with Standard Error")
        plt.xticks(rotation=0, ha='right')
        plt.tight_layout()
        img_io = io.BytesIO()
        plt.savefig(img_io, format='png', bbox_inches='tight')
        plots['mean_bar_plot'] = base64.b64encode(img_io.getvalue()).decode('utf-8')
        plt.close(fig)
        logging.info("Generated Bar plot.")

        # Box plot of means (NO SORTING)
        fig, ax = plt.subplots()
        # Do not specify the 'order' argument
        sns.boxplot(x=factor_col, y=response_col, data=df_processed, ax=ax)
        ax.set_xlabel(factor_col)
        ax.set_ylabel(response_col)
        ax.set_title("Box Plot of each Factor Level")
        plt.xticks(rotation=0, ha='right')
        plt.tight_layout()
        img_io = io.BytesIO()
        plt.savefig(img_io, format='png', bbox_inches='tight')
        plots['mean_box_plot'] = base64.b64encode(img_io.getvalue()).decode('utf-8')
        plt.close(fig)
        logging.info("Generated Box plot.")
       

    except Exception as e:
        logging.error(f"Error generating plots: {str(e)}")
        return jsonify({"error": f"Error generating plots: {str(e)}"}), 500

    overall_mean = df_processed[response_col].mean()
    overall_std = df_processed[response_col].std()
    if overall_mean != 0: # Avoid division by zero
        overall_cv = (overall_std / overall_mean) * 100
    else:
        overall_cv = 0

    return jsonify({
        "anova_table": anova_table.to_json(),
        "tukey_results": tukey_results,
        "shapiro": {"stat": shapiro_stat, "p": shapiro_p},
        "plots": plots,
        "mean_separation_results": mean_separation_results,
        "f_oneway_results": f_oneway_df.to_json(orient='records'),
        "tukey_explanation": tukey_explanation,
        "overall_cv": overall_cv,
        "cd_value": cd_value if cd_value is not None else None
    })