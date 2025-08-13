import os
import io
import pandas as pd
import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS
import logging
from scipy import stats

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["http://localhost:9002","https://vita.chloropy.com","https://vita-zur5dejluq-uc.a.run.app", "http://localhost:9002", "https://vita--statviz-j3txi.us-central1.hosted.app"]}})

@app.route("/")
def health():
    return "OK", 200

@app.route('/analyze_transformations', methods=['POST'])
def analyze_transformations():
    if 'data' not in request.form:
        logging.error("No data part in form")
        return jsonify({"error": "No data part in form"}), 400

    data_str = request.form.get('data')
    if not data_str:
        logging.error("Data is empty")
        return jsonify({"error": "Data is empty"}), 400

    try:
        df = pd.read_json(io.StringIO(data_str))
        logging.info("Successfully processed incoming data for analysis.")
    except Exception as e:
        logging.error(f"Error processing data: {str(e)}")
        return jsonify({"error": f"Error processing data: {str(e)}"}), 400

    response_col = request.form.get('response_col')
    if not response_col:
        return jsonify({"error": "Missing required field: response_col"}), 400

    if response_col not in df.columns:
        return jsonify({"error": f"Column '{response_col}' not found in the uploaded file."}), 400

    # Ensure the response column is numeric
    df[response_col] = pd.to_numeric(df[response_col], errors='coerce')
    df.dropna(subset=[response_col], inplace=True)

    skewness_values = {}

    # 1. Untransformed
    skewness_values['untransformed'] = df[response_col].skew()

    # 2. Log Transformation
    try:
        log_transformed_data = df[response_col].apply(lambda x: np.log1p(x) if x >= 0 else np.log1p(-x))
        skewness_values['log'] = log_transformed_data.skew()
    except Exception as e:
        skewness_values['log'] = None
        logging.error(f"Log transformation failed: {e}")

    # 3. Square Root Transformation
    try:
        if (df[response_col] < 0).any():
            raise ValueError("Square root transformation cannot be applied to negative values.")
        sqrt_transformed_data = np.sqrt(df[response_col])
        skewness_values['sqrt'] = sqrt_transformed_data.skew()
    except Exception as e:
        skewness_values['sqrt'] = None
        logging.error(f"Square root transformation failed: {e}")

    # 4. Box-Cox Transformation
    try:
        if (df[response_col] <= 0).any():
            raise ValueError("Box-Cox transformation requires positive data.")
        boxcox_transformed_data, _ = stats.boxcox(df[response_col])
        skewness_values['boxcox'] = pd.Series(boxcox_transformed_data).skew()
    except Exception as e:
        skewness_values['boxcox'] = None
        logging.error(f"Box-Cox transformation failed: {e}")

    # Suggest transformation
    valid_skewness = {k: v for k, v in skewness_values.items() if v is not None}
    if not valid_skewness:
        suggestion = 'No transformation could be applied.'
    else:
        suggestion = min(valid_skewness, key=lambda k: abs(valid_skewness[k]))

    return jsonify({
        "skewness": skewness_values,
        "suggestion": suggestion
    })


@app.route('/transform', methods=['POST'])
def transform_data():
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

    response_col = request.form.get('response_col')
    transform_choice = request.form.get('transform_choice')

    if not all([response_col, transform_choice]):
        return jsonify({"error": "Missing one or more required fields: response_col, transform_choice"}), 400

    if response_col not in df.columns:
        return jsonify({"error": f"Column '{response_col}' not found in the uploaded file."}), 400

    df_transformed = df.copy()
    original_response_col = response_col
    new_response_col_name = original_response_col

    # Ensure the response column is numeric
    df_transformed[response_col] = pd.to_numeric(df_transformed[response_col], errors='coerce')


    if transform_choice == 'log':
        try:
            # Use log1p to handle 0 values, add constant for negative values
            df_transformed[response_col] = df_transformed[response_col].apply(lambda x: np.log1p(x) if x >= 0 else np.log1p(-x))
            new_response_col_name = f"Log_{original_response_col}"
            df_transformed.rename(columns={response_col: new_response_col_name}, inplace=True)
            logging.info(f"Applied Log transformation to '{original_response_col}'. New column is '{new_response_col_name}'.")
        except Exception as e:
            logging.error(f"Error during log transformation: {e}")
            return jsonify({"error": f"Error during log transformation: {e}"}), 500

    elif transform_choice == 'sqrt':
        try:
            if (df_transformed[response_col] < 0).any():
                return jsonify({"error": "Square root transformation cannot be applied to negative values."}), 400
            df_transformed[response_col] = np.sqrt(df_transformed[response_col])
            new_response_col_name = f"Sqrt_{original_response_col}"
            df_transformed.rename(columns={response_col: new_response_col_name}, inplace=True)
            logging.info(f"Applied Square Root transformation to '{original_response_col}'. New column is '{new_response_col_name}'.")
        except Exception as e:
            logging.error(f"Error during square root transformation: {e}")
            return jsonify({"error": f"Error during square root transformation: {e}"}), 500

    elif transform_choice == 'boxcox':
        try:
            if (df_transformed[response_col] <= 0).any():
                return jsonify({"error": "Box-Cox transformation requires positive data."}), 400
            df_transformed[response_col], _ = stats.boxcox(df_transformed[response_col])
            new_response_col_name = f"BoxCox_{original_response_col}"
            df_transformed.rename(columns={response_col: new_response_col_name}, inplace=True)
            logging.info(f"Applied Box-Cox transformation to '{original_response_col}'. New column is '{new_response_col_name}'.")
        except Exception as e:
            logging.error(f"Error during Box-Cox transformation: {e}")
            return jsonify({"error": f"Error during Box-Cox transformation: {e}"}), 500
    
    elif transform_choice == 'untransformed':
        logging.info("No transformation applied.")
        pass # No change to the dataframe

    else:
        return jsonify({"error": "Invalid transformation choice."}), 400

    return jsonify({
        "transformed_data": df_transformed.to_json(orient='records'),
        "original_response_col": original_response_col,
        "transformed_response_col": new_response_col_name
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(debug=True, host='0.0.0.0', port=port)
