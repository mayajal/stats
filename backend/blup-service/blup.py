import pandas as pd
import statsmodels.api as sm
import statsmodels.formula.api as smf
import numpy as np
import seaborn as sns
import matplotlib.pyplot as plt
from statsmodels.stats.outliers_influence import OLSInfluence
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

@app.get("/")
def health_root():
    return "OK", 200

@app.get("/blup")
def health_blup():
    return "OK", 200

def alpha_lattice_met_analysis(df, dependent_var, genotype_var, rep_var, block_var, env_var, year_var):
    """
    Analyzes alpha lattice multi-environment multi-year trial data.

    Args:
        df (pd.DataFrame): The input dataframe.
        dependent_var (str): The name of the dependent variable column.
        genotype_var (str): The name of the genotype column.
        rep_var (str): The name of the replication column.
        block_var (str): The name of the block column.
        env_var (str): The name of the environment column.
        year_var (str): The name of the year column.

    Returns:
        dict: A dictionary containing the analysis results.
    """

    mdf = None
    model_type = ''
    results_message = ""

    # Try fitting the most complex model first (random slopes)
    try:
        fixed_formula = f"{dependent_var} ~ 1 + {year_var} + {env_var} + ({rep_var}/{block_var})"
        random_formula = f"~ 1 + {env_var}"
        md = smf.mixedlm(fixed_formula, df, groups=df[genotype_var], re_formula=random_formula)
        mdf = md.fit()
        model_type = 'random_slope'
        results_message = "Successfully fitted a random slope model (Genotype + GxE random)."
    except Exception:
        pass

    # If that failed, try a simple random intercept model
    if mdf is None:
        try:
            simple_fixed_formula = f"{dependent_var} ~ 1 + {year_var} + {env_var} + ({rep_var}/{block_var}) + {genotype_var}:{env_var}"
            md = smf.mixedlm(simple_fixed_formula, df, groups=df[genotype_var])
            mdf = md.fit()
            model_type = 'random_intercept'
            results_message = "Warning: The complex model failed to converge. A simpler model (random intercept for Genotype) was fitted instead. GxE is treated as a fixed effect."
        except Exception as e:
            raise Exception(f"Model fitting failed for all attempted models. The data may not support the complexity. Error: {e}")

    # Now, process results based on model_type
    
    # 2. BLUP Estimation
    if model_type == 'random_slope':
        blups = {k: v['Group'] for k, v in mdf.random_effects.items()}
        random_effects_blup = pd.DataFrame.from_dict(blups, orient='index', columns=['BLUP'])
    else: # random_intercept
        random_effects_blup = pd.DataFrame.from_dict(mdf.random_effects, orient='index', columns=['BLUP'])
    random_effects_blup.index.name = genotype_var

    # 3. BLUEs for Fixed Effects
    fixed_effects_blue = mdf.fe_params

    # 4. Heritability
    try:
        var_comp = mdf.vcomp
        vg = var_comp.get('Group', 0)
        ve = mdf.scale

        if model_type == 'random_slope':
            vge = var_comp.get(env_var, 0)
        else:
            vge = 0
        
        num_env = df[env_var].nunique()
        num_rep = df[rep_var].nunique()
        
        denominator = vg + (vge / num_env) + (ve / (num_rep * num_env))
        h2 = vg / denominator if denominator > 0 else 0
        
        var_comp_display = {k: v for k, v in var_comp.items()}
        var_comp_display['Residual'] = ve

    except Exception:
        var_comp_display = {"error": "Could not parse variance components."}
        h2 = "N/A"

    # 5. Diagnostics and Plots
    plots = {}
    # Residuals vs. Fitted
    plt.figure(figsize=(10, 6))
    sns.residplot(x=mdf.fittedvalues, y=mdf.resid, lowess=True, line_kws={'color': 'red', 'lw': 1})
    plt.title('Residuals vs. Fitted')
    plt.xlabel('Fitted values')
    plt.ylabel('Residuals')
    img_io = io.BytesIO()
    plt.savefig(img_io, format='png', bbox_inches='tight')
    plots['residuals_vs_fitted'] = base64.b64encode(img_io.getvalue()).decode('utf-8')
    plt.close()

    # Q-Q plot of residuals
    plt.figure(figsize=(10, 6))
    sm.qqplot(mdf.resid, line='s')
    plt.title('Q-Q Plot of Residuals')
    img_io = io.BytesIO()
    plt.savefig(img_io, format='png', bbox_inches='tight')
    plots['qq_plot_residuals'] = base64.b64encode(img_io.getvalue()).decode('utf-8')
    plt.close()

    # Influence plot
    try:
        influence = OLSInfluence(mdf)
        fig, ax = plt.subplots(figsize=(12, 8))
        fig = influence.plot_influence(ax=ax)
        img_io = io.BytesIO()
        plt.savefig(img_io, format='png', bbox_inches='tight')
        plots['influence_plot'] = base64.b64encode(img_io.getvalue()).decode('utf-8')
        plt.close()
    except Exception as e:
        plots['influence_plot'] = f"Could not generate influence plot: {e}"


    summary_html = mdf.summary().as_html()
    summary_html = summary_html.replace('>Group<', f'>{genotype_var}<')
    summary_html = summary_html.replace('>Group Var<', f'>{genotype_var} Var<')
    summary_html = summary_html.replace('>Group x ', f'>{genotype_var} x ')

    results = {
        "model_summary": summary_html,
        "blup_genotypes": random_effects_blup.to_html(),
        "blue_fixed_effects": fixed_effects_blue.to_frame().to_html(),
        "broad_sense_heritability": h2,
        "variance_components": var_comp_display,
        "plots": plots,
        "message": results_message
    }
    
    return results

@app.route("/", methods=["POST"])
@app.route("/blup", methods=["POST"])
def analyze():
    try:
        data_json = request.form.get("data")
        dependent_var = request.form.get("dependent_var")
        genotype_var = request.form.get("genotype_var")
        rep_var = request.form.get("rep_var")
        block_var = request.form.get("block_var")
        env_var = request.form.get("env_var")
        year_var = request.form.get("year_var")

        if not all([data_json, dependent_var, genotype_var, rep_var, block_var, env_var, year_var]):
            return jsonify({"error": "Missing required form fields"}), 400
        
        assert isinstance(data_json, str)

        df = pd.DataFrame(json.loads(data_json))

        # Ensure correct data types
        df[dependent_var] = pd.to_numeric(df[dependent_var], errors='coerce')
        
        categorical_vars = [genotype_var, rep_var, block_var, env_var, year_var]
        for var in categorical_vars:
            if var in df.columns:
                df[var] = df[var].astype('category')

        # Drop rows with missing values in critical columns
        critical_columns = [dependent_var, genotype_var, rep_var, block_var, env_var, year_var]
        df.dropna(subset=critical_columns, inplace=True)

        if df.empty:
            return jsonify({"error": "Not enough data after cleaning missing values."}), 400

        results = alpha_lattice_met_analysis(df, dependent_var, genotype_var, rep_var, block_var, env_var, year_var)

        return jsonify(results)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port=8080)