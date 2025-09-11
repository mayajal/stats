
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

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": [
    "https://vita.chloropy.com",
    "https://vita-zur5dejluq-uc.a.run.app",
    "http://localhost:9002",
    "https://vita--statviz-j3txi.us-central1.hosted.app"
]}})

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
        data_json = request.form.get("data")
        response_col = request.form.get("response_col")
        group_col = request.form.get("group_col")
        fixed_effects_str = request.form.get("fixed_effects")
        tukey_factor = request.form.get("tukey_factor")
        categorical_effects_str = request.form.get("categorical_effects", "")

        if not all([data_json, response_col, group_col, fixed_effects_str, tukey_factor]):
            return jsonify({"error": "Missing required form fields"}), 400

        # Narrow optional types for type checker
        assert isinstance(data_json, str)
        assert isinstance(response_col, str)
        assert isinstance(group_col, str)
        assert isinstance(fixed_effects_str, str)
        assert isinstance(tukey_factor, str)
        if categorical_effects_str is None:
            categorical_effects_str = ""

        fixed_effects = [fe.strip() for fe in fixed_effects_str.split(',') if fe.strip()]
        categorical_effects = [ce.strip() for ce in categorical_effects_str.split(',') if ce.strip()]
        
        data = pd.DataFrame(json.loads(data_json))
        
        # Dtype handling:
        # - Force response numeric
        # - For fixed effects (excluding response), prefer categorical unless the column is truly numeric (>=90% numeric after coercion)
        # - Ensure grouping and tukey factor are kept as strings/categories
        data[response_col] = pd.to_numeric(data[response_col], errors='coerce')
        for fe in fixed_effects:
            if fe == response_col:
                continue
            if fe not in data.columns:
                continue
            # Try numeric coercion and decide
            coerced = cast(pd.Series, pd.to_numeric(data[fe], errors='coerce'))
            numeric_ratio = float(coerced.notna().mean())
            if numeric_ratio >= 0.9:
                data[fe] = coerced
            else:
                try:
                    data[fe] = data[fe].astype('category')
                except Exception:
                    data[fe] = data[fe].astype(str).astype('category')
        # Ensure grouping and tukey factor are categorical
        for cat_col in [group_col, tukey_factor]:
            if cat_col in data.columns:
                try:
                    data[cat_col] = data[cat_col].astype('category')
                except Exception:
                    data[cat_col] = data[cat_col].astype(str).astype('category')
 
        # Tukey/grouping columns: keep as-is but drop rows with missing critical fields
        data.dropna(subset=fixed_effects + [response_col, group_col, tukey_factor], inplace=True)

        # Validate sufficient data after cleaning
        if len(data) < 3:
            return jsonify({
                "error": "Not enough valid rows after cleaning; need at least 3 rows.",
                "debug": {
                    "rows_after_cleaning": int(len(data))
                }
            }), 400
        if data[group_col].nunique() < 1:
            return jsonify({
                "error": f"Grouping column '{group_col}' has no valid levels after cleaning.",
                "debug": {
                    "unique_groups": 0
                }
            }), 400
        if data[tukey_factor].nunique() < 2:
            # Still proceed with model, but Tukey/means will be skipped and reported
            pass

        # Build formula with categorical indicators wrapped in C(...)
        # Wrap categorical dtype columns in C(...)
        formula_terms = [f"C({fe})" if (fe in data.columns and str(data[fe].dtype) == 'category') else fe for fe in fixed_effects]
        # Add all two-way interaction terms among fixed effects
        interaction_terms: List[str] = []
        if len(formula_terms) >= 2:
            for i in range(len(formula_terms)):
                for j in range(i + 1, len(formula_terms)):
                    interaction_terms.append(f"{formula_terms[i]}:{formula_terms[j]}")

        if not fixed_effects:
            formula = f"{response_col} ~ 1"
        else:
            rhs_terms = formula_terms + interaction_terms
            formula = f"{response_col} ~ {' + '.join(rhs_terms)}"
        
        model = smf.mixedlm(formula, data, groups=data[group_col])
        result = model.fit()

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
            mse = result.scale
            n_blocks = data[group_col].nunique()
            q_crit = getattr(tukey, 'q_crit', None)
            if q_crit is None:
                try:
                    from scipy.stats import studentized_range
                    num_groups = data[tukey_factor].nunique()
                    df_resid = int(getattr(result, 'df_resid', max(len(data) - 1, 1)))
                    q_crit = float(studentized_range.ppf(1 - 0.05, num_groups, df_resid))
                except Exception:
                    q_crit = np.nan
            cd_value = float(q_crit * np.sqrt(mse / n_blocks)) if (q_crit is not None and n_blocks > 0) else None

            # Mean separation table
            factor_groups = data.groupby(tukey_factor)[response_col]
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
            }).sort_values(by='Treatment', ascending=True)
            if len(plot_data) > 0:
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
                fig, ax = plt.subplots()
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

        return jsonify({
            "model_summary_html": model_summary_html,
            "tukey_results": tukey_results,
            "tukey_explanation": tukey_explanation,
            "plots": plots,
            "mean_separation_results": mean_separation_results,
            "cd_value": cd_value if cd_value is not None else None,
            "shapiro": {"stat": float(shapiro_stat) if not np.isnan(shapiro_stat) else None, "p": float(shapiro_p) if not np.isnan(shapiro_p) else None},
            "overall_cv": overall_cv
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=8080)
