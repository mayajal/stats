
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

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": [
    "https://vita.chloropy.com",
    "https://vita-zur5dejluq-uc.a.run.app",
    "http://localhost:9002",
    "https://vita--statviz-j3txi.us-central1.hosted.app"
]}})

def assign_significance_letters(tukey_results, means):
    """Assigns significance letters based on Tukey HSD results."""
    import networkx as nx
    G = nx.Graph()
    for group in means.index:
        G.add_node(group)

    results_df = pd.DataFrame(tukey_results._results_table.data[1:], columns=tukey_results._results_table.data[0])

    for i, row in results_df.iterrows():
        if row['reject'] == False:
            G.add_edge(row['group1'], row['group2'])

    cliques = list(nx.find_cliques(G))
    sorted_cliques = sorted(cliques, key=lambda clique: sum(means[group] for group in clique), reverse=True)

    letters = list(string.ascii_lowercase)
    significance_letters = {}
    assigned_groups = set()

    for i, clique in enumerate(sorted_cliques):
        current_letter = letters[i]
        for group in sorted(clique, key=lambda g: means[g], reverse=True):
            if group not in assigned_groups:
                if group not in significance_letters:
                    significance_letters[group] = current_letter
                else:
                    significance_letters[group] += current_letter
        for group in clique:
            assigned_groups.add(group)

    all_groups = set(means.index)
    unassigned_groups = all_groups - set(significance_letters.keys())
    next_letter_idx = len(sorted_cliques)
    for group in sorted(list(unassigned_groups)):
        significance_letters[group] = letters[next_letter_idx]
        next_letter_idx += 1

    for group in significance_letters:
        significance_letters[group] = ''.join(sorted(significance_letters[group]))

    return significance_letters

@app.route("/", methods=["POST"])
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

        fixed_effects = [fe.strip() for fe in fixed_effects_str.split(',') if fe.strip()]
        categorical_effects = [ce.strip() for ce in categorical_effects_str.split(',') if ce.strip()]
        
        data = pd.DataFrame(json.loads(data_json))
        
        # Ensure columns are numeric where appropriate; leave categorical as category dtype
        for col in fixed_effects + [response_col]:
            if col == response_col or col not in categorical_effects:
                data[col] = pd.to_numeric(data[col], errors='coerce')
            else:
                try:
                    data[col] = data[col].astype('category')
                except Exception:
                    # fallback to string then category
                    data[col] = data[col].astype(str).astype('category')
        
        data.dropna(subset=fixed_effects + [response_col, group_col, tukey_factor], inplace=True)


        # Build formula with categorical indicators wrapped in C(...)
        formula_terms = [f"C({fe})" if fe in categorical_effects else fe for fe in fixed_effects]
        if not fixed_effects:
            formula = f"{response_col} ~ 1"
        else:
            formula = f"{response_col} ~ {' * '.join(fixed_effects)}"
        
        model = smf.mixedlm(formula, data, groups=data[group_col])
        result = model.fit()

        model_summary_html = result.summary().as_html()
        
        tukey_result = pairwise_tukeyhsd(endog=data[response_col], groups=data[tukey_factor], alpha=0.05)
        
        factor_groups = data.groupby(tukey_factor)[response_col]
        factor_means = factor_groups.mean()
        factor_sem = factor_groups.sem()
        
        significance_letters = assign_significance_letters(tukey_result, factor_means)

        mean_separation_df = factor_means.to_frame(name='Mean')
        mean_separation_df['SEM'] = factor_sem
        mean_separation_df = mean_separation_df.reset_index()
        mean_separation_df.rename(columns={tukey_factor: 'Treatment'}, inplace=True)
        mean_separation_df['Significance'] = mean_separation_df['Treatment'].map(significance_letters)
        mean_separation_df = mean_separation_df.sort_values(by='Mean', ascending=False).reset_index(drop=True)

        for col in mean_separation_df.select_dtypes(include=['float', 'number']).columns:
            if col not in ['Treatment', 'Significance']:
                mean_separation_df[col] = mean_separation_df[col].apply(lambda x: f"{x:.4f}")

        n_blocks = data[group_col].nunique()
        mse = result.scale
        # q_crit may not exist on some statsmodels versions; compute a fallback
        q_crit = getattr(tukey_result, 'q_crit', None)
        if q_crit is None:
            try:
                from scipy.stats import studentized_range
                num_groups = data[tukey_factor].nunique()
                df_resid = int(getattr(result, 'df_resid', max(len(data) - 1, 1)))
                # Tukey's HSD uses the studentized range critical value at 1 - alpha
                q_crit = float(studentized_range.ppf(1 - 0.05, num_groups, df_resid))
            except Exception:
                q_crit = np.nan
        cd_value = q_crit * np.sqrt(mse / n_blocks)

        # Plots
        plots = {}
        
        # Residuals vs Fitted
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

        # Q-Q plot
        fig_or_ax = sm.qqplot(result.resid, line='45', fit=True)
        plt.title('Q-Q Plot of Residuals')
        img_io = io.BytesIO()
        # Ensure we save a Figure regardless of return type
        try:
            fig = fig_or_ax.get_figure()
        except AttributeError:
            fig = plt.gcf()
        fig.savefig(img_io, format='png', bbox_inches='tight')
        plots['qq_plot'] = base64.b64encode(img_io.getvalue()).decode('utf-8')
        plt.close(fig)

        # Interaction plot
        if len(fixed_effects) > 1:
            plt.figure(figsize=(10, 6))
            # Use the first two fixed effects for the interaction plot
            sns.barplot(data=data, x=fixed_effects[0], y=response_col, hue=fixed_effects[1], dodge=True, capsize=0.1)
            plt.title(f'Interaction Plot: {response_col} by {fixed_effects[0]} and {fixed_effects[1]}')
            img_io = io.BytesIO()
            plt.savefig(img_io, format='png', bbox_inches='tight')
            plots['interaction_plot'] = base64.b64encode(img_io.getvalue()).decode('utf-8')
            plt.close()


        return jsonify({
            "model_summary_html": model_summary_html,
            "mean_separation_results": mean_separation_df.to_json(orient='records'),
            "cd_value": cd_value,
            "plots": plots
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=8080)
