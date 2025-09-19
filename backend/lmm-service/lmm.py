
import pandas as pd
import statsmodels.api as sm
import statsmodels.formula.api as smf
from statsmodels.stats.multicomp import pairwise_tukeyhsd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
import string
from flask import Flask, jsonify, request
from flask_cors import CORS
import io
import base64
import json
from scipy import stats
from typing import Dict, List, Optional, Tuple, cast
from matplotlib.figure import Figure
import logging

import re

# Natural sort key for strings containing numbers
def natural_sort_key(s):
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": [
    "http://localhost:3000",
    "https://vita.chloropy.com",
    "https://vita-zur5dejluq-uc.a.run.app",
    "http://localhost:9002",
    "https://vita--statviz-j3txi.us-central1.hosted.app"
]}})

# Configure logging
logging.basicConfig(level=logging.INFO)

@app.get("/")
def health_root():
    return "OK", 200

@app.get("/lmm")
def health_lmm():
    return "OK", 200

def assign_significance_letters(tukey_df, means):
    """Assign significance letters using an RBD-like approach (no networkx)."""
    means = means.sort_values(ascending=False)
    treatments: List[str] = [str(t) for t in list(means.index)]
    letters = {treatment: '' for treatment in treatments}
    current_letter = 'a'
    n_treatments = len(treatments)

    # Build matrix of significance (True means significant difference)
    is_significant_matrix = pd.DataFrame(True, index=pd.Index(treatments), columns=pd.Index(treatments))
    for _, row in tukey_df.iterrows():
        g1 = row['group1']
        g2 = row['group2']
        rejected = row['reject']
        if g1 in is_significant_matrix.index and g2 in is_significant_matrix.columns:
            is_significant_matrix.loc[g1, g2] = rejected
            is_significant_matrix.loc[g2, g1] = rejected

    # Assign letters greedily top-down by mean
    for i, treatment in enumerate(treatments):
        if not letters[treatment]:
            letters[treatment] = current_letter
        for j in range(i + 1, n_treatments):
            other = treatments[j]
            if not is_significant_matrix.loc[treatment, other]:
                letters[other] += current_letter
        current_letter = chr(ord(current_letter) + 1)

    # Deduplicate and sort letters within each treatment
    for treatment in letters:
        letters[treatment] = ''.join(sorted(set(letters[treatment])))

    return letters

@app.route("/", methods=["POST"])
@app.route("/lmm", methods=["POST"])
def analyze():
    try:
        app.logger.info("Analysis request received")
        data_json = request.form.get("data")
        response_col = request.form.get("response_col")
        fixed_effects_str = request.form.get("fixed_effects")
        random_effects_str = request.form.get("random_effects")
        tukey_factor = request.form.get("tukey_factor")

        app.logger.info(f"Received data: {bool(data_json)}")
        app.logger.info(f"Received response_col: {response_col}")
        app.logger.info(f"Received fixed_effects: {fixed_effects_str}")
        app.logger.info(f"Received random_effects: {random_effects_str}")
        app.logger.info(f"Received tukey_factor: {tukey_factor}")

        if not all([data_json, response_col, fixed_effects_str, random_effects_str, tukey_factor]):
            app.logger.error("Missing required form fields")
            return jsonify({"error": "Missing required form fields: 'data', 'response_col', 'fixed_effects', 'random_effects', and 'tukey_factor' are required."}), 400

        # Narrow optional types for type checker
        assert isinstance(data_json, str)
        assert isinstance(response_col, str)
        assert isinstance(fixed_effects_str, str)
        assert isinstance(random_effects_str, str)
        assert isinstance(tukey_factor, str)

        fixed_effects = [fe.strip() for fe in fixed_effects_str.split(',') if fe.strip()]
        random_effects = [re.strip() for re in random_effects_str.split(',') if re.strip()]

        if not fixed_effects:
            return jsonify({"error": "At least one fixed effect must be specified."}), 400
        if not random_effects:
            return jsonify({"error": "At least one random effect must be specified."}), 400

        data = pd.DataFrame(json.loads(data_json))

        # Dtype handling
        data[response_col] = pd.to_numeric(data[response_col], errors='coerce')
        all_factors = fixed_effects + random_effects + [tukey_factor]
        for col in all_factors:
            if col == response_col:
                continue
            if col not in data.columns:
                # Gracefully skip columns that don't exist in the dataframe
                continue
            
            # Coerce to numeric to check if it's a quantitative variable
            coerced = cast(pd.Series, pd.to_numeric(data[col], errors='coerce'))
            # If >90% of values are numeric, treat as a numeric variable
            if coerced.notna().mean() >= 0.9:
                data[col] = coerced
            else:
                # Otherwise, treat as a categorical factor
                data[col] = data[col].astype('category')

        # Drop rows with missing values in any of the critical columns
        all_model_cols = [response_col] + fixed_effects + random_effects
        cols_to_check = [col for col in all_model_cols if col in data.columns]
        data.dropna(subset=cols_to_check, inplace=True)

        # Validate sufficient data after cleaning
        if len(data) < 3:
            return jsonify({"error": f"Not enough valid rows after cleaning (need at least 3). Found {len(data)}."}), 400
        for re_col in random_effects:
            if re_col in data.columns and data[re_col].nunique() < 2:
                return jsonify({"error": f"Random effect '{re_col}' must have at least 2 unique levels."}), 400

        # Build formula
        # Fixed effects part: Wrap categorical variables in C()
        formula_terms = []
        for fe in fixed_effects:
            if fe in data.columns:
                if str(data[fe].dtype) == 'category':
                    formula_terms.append(f"C({fe})")
                else:
                    formula_terms.append(fe)
        
        if not formula_terms:
             return jsonify({"error": "No valid fixed effects found in the data."}), 400

        # Construct RHS for fixed effects including interactions
        if len(formula_terms) > 1:
            rhs_terms = " * ".join(formula_terms) # Use '*' for interactions
        else:
            rhs_terms = formula_terms[0] # Only one fixed effect, no interaction

        formula = f"{response_col} ~ {rhs_terms}"

        # Random effects part (as variance components)
        # The first random effect in the list is used as the primary grouping factor.
        # Subsequent random effects are added as variance components.
        primary_group = random_effects[0]
        
        # Initialize vc_formula with other random effects, excluding the primary_group
        vc_formula = {re: "~ 1" for re in random_effects[1:] if re in data.columns}

        # Ensure the primary_group is in the data columns
        if primary_group not in data.columns:
            return jsonify({"error": f"Primary random effect '{primary_group}' not found in data."}), 400

        model = smf.mixedlm(formula, data, groups=data[primary_group], vc_formula=vc_formula)
        
        # Robust fitting with multiple optimizers
        methods = ['bfgs', 'lbfgs', 'cg', 'ncg']
        result = None
        last_exception = None

        for method in methods:
            try:
                app.logger.info(f"Attempting to fit model with optimizer: {method}")
                result = model.fit(method=method)
                app.logger.info(f"Successfully fitted model with optimizer: {method}")
                break  # Success, exit the loop
            except (np.linalg.LinAlgError, Exception) as e:
                app.logger.warning(f"Optimizer {method} failed with error: {e}")
                last_exception = e

        if result is None:
            app.logger.error("All optimizers failed.")
            error_message = (
                "The model could not be fitted, likely due to a singular matrix. "
                "This often means the model is too complex for the data or that some variables are perfectly correlated. "
                "Try simplifying the model by removing optional random effects (e.g., 'Block' or 'Season') and run the analysis again."
            )
            if last_exception:
                error_message += f" (Last error: {str(last_exception)})"
            return jsonify({"error": error_message}), 400

        try:
            # Model summary as HTML for flexible frontend rendering
            model_summary_html = result.summary().as_html()
            
            # Tukey HSD on the requested factor
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
    <li><b>p-adj:</b> The adjusted p-value for the comparison (multiple-comparison corrected).</li>
</ul>
<p><b>Interpretation:</b></p>
<p>A 'True' in the 'reject' column for a comparison indicates a statistically significant difference between the means of the two groups at the alpha = 0.05 level.</p>
'''
            
            # Initialize as empty Series (not Optional) for type checker
            factor_means: pd.Series = pd.Series(dtype=float)
            factor_sem: pd.Series = pd.Series(dtype=float)

            if data[tukey_factor].nunique() < 2:
                tukey_results[tukey_factor] = f"Factor '{tukey_factor}' has less than 2 levels after cleaning; Tukey HSD not applicable"
            else:
                tukey = pairwise_tukeyhsd(
                    endog=data[response_col],
                    groups=data[tukey_factor],
                    alpha=0.05
                )
                tukey_df = pd.DataFrame(data=tukey._results_table.data[1:], columns=tukey._results_table.data[0])
                numeric_cols = ['meandiff', 'p-adj', 'lower', 'upper']
                for col in numeric_cols:
                    tukey_df[col] = pd.to_numeric(tukey_df[col], errors='coerce')
                tukey_df[numeric_cols] = tukey_df[numeric_cols].round(4)
                tukey_results[tukey_factor] = tukey_df.to_json(orient='records')

                # Critical Difference (CD)
                # Adapted for general LMM: uses the number of levels of the first random effect
                # as a proxy for the number of replications ('r').
                mse = result.scale
                n_replications = data[random_effects[0]].nunique() if random_effects else 1
                q_crit = getattr(tukey, 'q_crit', None)
                if q_crit is None:
                    try:
                        from scipy.stats import studentized_range
                        num_groups = data[tukey_factor].nunique()
                        df_resid = int(getattr(result, 'df_resid', max(len(data) - 1, 1)))
                        q_crit = float(studentized_range.ppf(1 - 0.05, num_groups, df_resid))
                    except Exception:
                        q_crit = np.nan
                cd_value = float(q_crit * np.sqrt(mse / n_replications)) if (q_crit is not None and n_replications > 0) else None

                # Mean separation table
                factor_groups = data.groupby(tukey_factor, observed=True)[response_col]
                factor_means = cast(pd.Series, factor_groups.mean())
                factor_sem = cast(pd.Series, factor_groups.sem())
                significance_letters = assign_significance_letters(tukey_df, factor_means)

                mean_separation_df = factor_means.to_frame(name='Mean')
                mean_separation_df['SEM'] = factor_sem
                mean_separation_df = mean_separation_df.reset_index()
                mean_separation_df.rename(columns={tukey_factor: 'Treatment'}, inplace=True)
                mean_separation_df['Significance'] = mean_separation_df['Treatment'].map(lambda t: significance_letters.get(t, ''))
                mean_separation_df = mean_separation_df.sort_values(by='Mean', ascending=False).reset_index(drop=True)

                numeric_cols_to_format = mean_separation_df.select_dtypes(include=['float', 'number']).columns.tolist()
                for col in numeric_cols_to_format:
                    if col not in ['Treatment', 'Significance']:
                        mean_separation_df[col] = mean_separation_df[col].apply(lambda x: f"{x:.4f}")

                mean_separation_results[tukey_factor] = mean_separation_df.to_json(orient='records')

            # Diagnostics: normality of residuals
            shapiro_stat, shapiro_p = stats.shapiro(result.resid) if len(result.resid) >= 3 else (np.nan, np.nan)

            # Plots
            plots = {}
            # Residuals vs Fitted
            if len(result.fittedvalues) > 0 and len(result.resid) > 0:
                plt.figure(figsize=(8, 5))
                sns.scatterplot(x=result.fittedvalues, y=result.resid)
                plt.axhline(0, ls='--', color='red')
                plt.xlabel('Fitted values')
                plt.ylabel('Residuals')
                plt.title('Residuals vs Fitted Values')
                img_io = io.BytesIO()
                plt.savefig(img_io, format='png', bbox_inches='tight')
                plots['residuals_vs_fitted'] = base64.b64encode(img_io.getvalue()).decode('utf-8')
                plt.close()

            # Q-Q plot (explicit Figure/Axes to satisfy type checker)
            if len(result.resid) >= 3:
                fig, ax = plt.subplots()
                sm.graphics.qqplot(result.resid, line='45', fit=True, ax=ax)
                ax.set_title('Q-Q Plot of Residuals')
                img_io = io.BytesIO()
                fig.savefig(img_io, format='png', bbox_inches='tight')
                plots['qq_plot'] = base64.b64encode(img_io.getvalue()).decode('utf-8')
                plt.close(fig)

            # Mean plots (bar with SEM and box by treatment)
            if data[tukey_factor].nunique() >= 1 and not factor_means.empty and not factor_sem.empty:
                # Bar plot
                fig, ax = plt.subplots()
                plot_data = pd.DataFrame({
                    'Treatment': [str(t) for t in factor_means.index],
                    'Mean': factor_means.values,
                    'SEM': factor_sem.values
                })
                # Apply natural sort
                plot_data['Treatment_sorted'] = plot_data['Treatment'].apply(natural_sort_key)
                plot_data = plot_data.sort_values(by='Treatment_sorted', ascending=True).drop(columns='Treatment_sorted')

                if len(plot_data) > 0:
                    fig, ax = plt.subplots(figsize=(12, 6)) # Double the width
                    colors = sns.color_palette('tab10', n_colors=len(plot_data['Treatment']))
                    ax.bar(plot_data['Treatment'], plot_data['Mean'].astype(float), yerr=plot_data['SEM'].astype(float), capsize=5, color=colors)
                    ax.set_xlabel(tukey_factor or "")
                    ax.set_ylabel(f"Mean of {response_col or ''}")
                    ax.set_title(f"Mean {response_col} with Std Error of Mean")
                    plt.xticks(rotation=0, ha='right')
                    plt.tight_layout()
                    img_io = io.BytesIO()
                    plt.savefig(img_io, format='png', bbox_inches='tight')
                    plots['mean_bar_plot'] = base64.b64encode(img_io.getvalue()).decode('utf-8')
                    plt.close(fig)
                else:
                    plt.close(fig)

                # Box plot
                if len(data) > 0:
                    # Ensure categories are naturally sorted for plotting
                    data[tukey_factor] = pd.Categorical(data[tukey_factor], categories=sorted(data[tukey_factor].unique(), key=natural_sort_key), ordered=True)

                    fig, ax = plt.subplots(figsize=(12, 6)) # Double the width
                    unique_levels = data[tukey_factor].unique()
                    if len(unique_levels) > 0:
                        palette = sns.color_palette('tab10', n_colors=len(unique_levels))
                        palette_dict = dict(zip(unique_levels, palette))
                    else:
                        palette_dict = None
                    sns.boxplot(x=tukey_factor, y=response_col, data=data, ax=ax, palette=palette_dict)
                    ax.set_xlabel(tukey_factor or "")
                    ax.set_ylabel(response_col or "")
                    ax.set_title(f"Box Plot of {response_col}")
                    plt.xticks(rotation=0, ha='right')
                    plt.tight_layout()
                    img_io = io.BytesIO()
                    plt.savefig(img_io, format='png', bbox_inches='tight')
                    plots['mean_box_plot'] = base64.b64encode(img_io.getvalue()).decode('utf-8')
                    plt.close(fig)

            # Overall CV
            overall_mean = data[response_col].mean()
            overall_std = data[response_col].std()
            overall_cv = float((overall_std / overall_mean) * 100) if overall_mean != 0 else 0.0

            # Extract random effects (BLUPs)
            random_effects_results = json.dumps([])
            if hasattr(result, 'random_effects') and result.random_effects:
                # The result.random_effects is a dict of series.
                # Let's format it for JSON.
                try:
                    re_dict = {k: v['group'] for k, v in result.random_effects.items()}
                    random_effects_df = pd.DataFrame.from_dict(re_dict, orient='index', columns=['RandomEffect_Value'])
                    random_effects_df.index.name = primary_group
                    random_effects_df = random_effects_df.reset_index()
                    # Round the numeric values
                    random_effects_df['RandomEffect_Value'] = random_effects_df['RandomEffect_Value'].round(4)
                    random_effects_results = random_effects_df.to_json(orient='records')
                except KeyError:
                    # Fallback for different structures if 'group' is not the key
                    random_effects_results = json.dumps([{'error': 'Could not parse random effects'}])

            # Extract variance components
            variance_components = {}
            found_vcs = set()
            try:
                # 1. Get variances for random effects from model parameters
                for p_name, p_value in result.params.items():
                    if ' Var' in p_name:
                        if p_name == 'Group Var':
                            clean_name = primary_group
                        else:
                            clean_name = p_name.replace(' Var', '').strip()
                        variance_components[clean_name] = float(p_value)
                        found_vcs.add(clean_name)

                # 2. If the primary group's variance was not in params (estimated as 0), add it.
                if primary_group not in found_vcs and primary_group in random_effects:
                    variance_components[primary_group] = 0.0

                # 3. Add the residual variance
                if hasattr(result, 'scale'):
                    variance_components['Residual'] = float(result.scale)

            except Exception as e:
                app.logger.warning(f"Could not extract variance components: {e}")
                variance_components = {"error": "Could not extract variance components."}


            return jsonify({
                "model_summary_html": model_summary_html,
                "tukey_results": tukey_results,
                "tukey_explanation": tukey_explanation,
                "plots": plots,
                "mean_separation_results": mean_separation_results,
                "cd_value": cd_value if cd_value is not None else None,
                "shapiro": {"stat": float(shapiro_stat) if not np.isnan(shapiro_stat) else None, "p": float(shapiro_p) if not np.isnan(shapiro_p) else None},
                "overall_cv": overall_cv,
                "random_effects_results": random_effects_results,
                "variance_components": variance_components
            })

        except ValueError as e:
            if "Shape of passed values" in str(e) or "Length of values" in str(e):
                app.logger.error(f"Caught a known statsmodels issue: {e}")
                error_message = (
                    "The analysis failed due to an internal error in the statistical library. "
                    "This can happen with models that have only one random effect (e.g., 'Replication') and no other variance components. "
                    "If your experimental design includes other random factors like 'Block' or 'Season', please include them in the 'random_effects' list and try again."
                )
                return jsonify({"error": error_message}), 400
            else:
                # Re-raise other ValueErrors
                raise e

    except Exception as e:
        app.logger.error(f"An error occurred: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=8080)
