import os
import io
import pandas as pd
import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS
import logging
from scipy import stats

import warnings

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
warnings.filterwarnings('ignore')

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["http://localhost:3000", "http://localhost:9002","https://vita.chloropy.com","https://vita-zur5dejluq-uc.a.run.app", "http://localhost:9002", "https://vita--statviz-j3txi.us-central1.hosted.app"]}})

class NormalityTester:
    """
    A comprehensive tool for testing normality and recommending data transformations.
    Designed for researchers who need to check ANOVA assumptions.
    """
    
    def __init__(self, response_col_name="data"):
        self.results = {}
        self.original_data = None
        self.transformations = {}
        self.response_col_name = response_col_name

    def test_normality(self, data, alpha=0.05):
        """
        Perform multiple normality tests on the data.
        """
        data = np.array(data)
        data = data[~np.isnan(data)]
        
        if len(data) < 3:
            return {"error": "Insufficient data points (minimum 3 required)"}
        
        results = {}
        
        # Shapiro-Wilk Test
        if len(data) <= 5000:
            shapiro_stat, shapiro_p = stats.shapiro(data)
            results['shapiro_wilk'] = {
                'name': 'Shapiro-Wilk Test',
                'statistic': shapiro_stat, 'p_value': shapiro_p, 'is_normal': shapiro_p > alpha,
                'interpretation': f"Data is {'normal' if shapiro_p > alpha else 'not normal'} (p={shapiro_p:.4f})"
            }
        
        # D'Agostino and Pearson's Test
        if len(data) >= 8:
            dagostino_stat, dagostino_p = stats.normaltest(data)
            results['dagostino_pearson'] = {
                'name': "D'Agostino and Pearson's Test",
                'statistic': dagostino_stat, 'p_value': dagostino_p, 'is_normal': dagostino_p > alpha,
                'interpretation': f"Data is {'normal' if dagostino_p > alpha else 'not normal'} (p={dagostino_p:.4f})"
            }
        
        # Kolmogorov-Smirnov Test
        ks_stat, ks_p = stats.kstest(data, 'norm', args=(np.mean(data), np.std(data)))
        results['kolmogorov_smirnov'] = {
            'name': 'Kolmogorov-Smirnov Test',
            'statistic': ks_stat, 'p_value': ks_p, 'is_normal': ks_p > alpha,
            'interpretation': f"Data is {'normal' if ks_p > alpha else 'not normal'} (p={ks_p:.4f})"
        }
        
        skewness = stats.skew(data)
        kurtosis = stats.kurtosis(data)
        
        results['descriptive_stats'] = {
            'skewness': skewness, 'kurtosis': kurtosis,
            'skewness_interpretation': self._interpret_skewness(skewness),
            'kurtosis_interpretation': self._interpret_kurtosis(kurtosis)
        }
        
        normal_tests = [test['is_normal'] for test in results.values() if isinstance(test, dict) and 'is_normal' in test]
        results['overall_assessment'] = {
            'likely_normal': sum(normal_tests) >= len(normal_tests) / 2,
            'recommendation': 'No transformation needed' if sum(normal_tests) >= len(normal_tests) / 2 else 'Consider data transformation'
        }
        
        return results

    def _interpret_skewness(self, skewness):
        if abs(skewness) < 0.5: return "Approximately symmetric"
        elif abs(skewness) < 1: return "Moderately skewed"
        else: return "Highly skewed"
    
    def _interpret_kurtosis(self, kurtosis):
        if abs(kurtosis) < 0.5: return "Medium-tailed (mesokurtic)"
        elif kurtosis > 0.5: return "Heavy-tailed (leptokurtic)"
        else: return "Light-tailed (platykurtic)"

    def apply_transformations(self, data):
        data = np.array(data)
        data = data[~np.isnan(data)]
        self.original_data = data.copy()
        
        transformations = {}
        
        # Log transformation
        log_data = np.log(data) if np.all(data > 0) else np.log(data - np.min(data) + 1)
        transformations['log'] = {'data': log_data, 'normality_tests': self.test_normality(log_data), 'applicable': True}

        # Square root transformation
        sqrt_data = np.sqrt(data) if np.all(data >= 0) else np.sqrt(data - np.min(data))
        transformations['square_root'] = {'data': sqrt_data, 'normality_tests': self.test_normality(sqrt_data), 'applicable': True}

        # Arcsine transformation
        if np.all((data >= 0) & (data <= 1)):
            arcsine_data = np.arcsin(np.sqrt(data))
            transformations['arcsine'] = {'data': arcsine_data, 'normality_tests': self.test_normality(arcsine_data), 'applicable': True}

        # Box-Cox transformation
        if np.all(data > 0):
            boxcox_data, lambda_param = stats.boxcox(data)
            transformations['box_cox'] = {'data': boxcox_data, 'lambda': lambda_param, 'normality_tests': self.test_normality(boxcox_data), 'applicable': True}

        # Yeo-Johnson transformation
        yeojohnson_data, lambda_param = stats.yeojohnson(data)
        transformations['yeo_johnson'] = {'data': yeojohnson_data, 'lambda': lambda_param, 'normality_tests': self.test_normality(yeojohnson_data), 'applicable': True}
        
        self.transformations = transformations
        return transformations

    def recommend_best_transformation(self, data):
        original_results = self.test_normality(data)
        
        if original_results.get('overall_assessment', {}).get('likely_normal', False):
            return {
                'recommendation': 'No transformation needed',
                'reason': 'Data already appears to be normally distributed',
                'original_normality': original_results,
                'suggested_transformation': None
            }
        
        transformations = self.apply_transformations(data)
        
        scores = {}
        for name, transform in transformations.items():
            if transform.get('applicable', False):
                normality_tests = transform['normality_tests']
                normal_count = 0
                total_tests = 0
                for test_name, test_result in normality_tests.items():
                    if isinstance(test_result, dict) and 'is_normal' in test_result:
                        total_tests += 1
                        if test_result['is_normal']:
                            normal_count += 1
                score = normal_count / total_tests if total_tests > 0 else 0
                if 'descriptive_stats' in normality_tests:
                    skewness = abs(normality_tests['descriptive_stats']['skewness'])
                    kurtosis = abs(normality_tests['descriptive_stats']['kurtosis'])
                    score += (1 - min(skewness, 2) / 2) * 0.1
                    score += (1 - min(kurtosis, 2) / 2) * 0.1
                scores[name] = score
            
        if scores:
            best_transformation_name = max(scores, key=scores.get)
            best_score = scores[best_transformation_name]
            
            return {
                'recommendation': best_transformation_name,
                'score': best_score,
                'reason': f'Achieved highest normality score of {best_score:.3f}',
                'original_normality': original_results,
                'transformation_details': transformations,
                'all_scores': scores,
                'suggested_transformation': transformations[best_transformation_name]
            }
        else:
            return {
                'recommendation': 'No suitable transformation found',
                'reason': 'None of the transformations were applicable to this data',
                'original_normality': original_results,
                'suggested_transformation': None
            }

def _convert_numpy_types_to_python_types(obj):
    if isinstance(obj, dict):
        return {k: _convert_numpy_types_to_python_types(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_convert_numpy_types_to_python_types(elem) for elem in obj]
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, (np.bool_, np.integer, np.floating)):
        return obj.item()
    else:
        return obj

@app.route("/")
def health():
    return "OK", 200

@app.route('/analyze_transformations', methods=['POST'])
def analyze_transformations():
    data = request.get_json()
    if not data:
        logging.error("No data provided")
        return jsonify({"error": "No data provided"}), 400

    try:
        df = pd.DataFrame(data['data'])
        logging.info("Successfully processed incoming data for analysis.")
    except Exception as e:
        logging.error(f"Error processing data: {str(e)}")
        return jsonify({"error": f"Error processing data: {str(e)}"}), 400

    response_col = data.get('response_col')
    if not response_col:
        return jsonify({"error": "Missing required field: response_col"}), 400

    if response_col not in df.columns:
        return jsonify({"error": f"Column '{response_col}' not found in the uploaded file."}), 400

    df[response_col] = pd.to_numeric(df[response_col], errors='coerce')
    df.dropna(subset=[response_col], inplace=True)

    tester = NormalityTester(response_col_name=response_col)
    recommendation = tester.recommend_best_transformation(df[response_col].values)
    
    recommendation = _convert_numpy_types_to_python_types(recommendation)

    return jsonify(recommendation)


@app.route('/transform', methods=['POST'])
def transform_data():
    data = request.get_json()
    if not data:
        logging.error("No data provided")
        return jsonify({"error": "No data provided"}), 400

    try:
        df = pd.DataFrame(data['data'])
        logging.info("Successfully processed incoming data.")
    except Exception as e:
        logging.error(f"Error processing data: {str(e)}")
        return jsonify({"error": f"Error processing data: {str(e)}"}), 400

    response_col = data.get('response_col')
    transform_choice = data.get('transform_choice')

    if not all([response_col, transform_choice]):
        return jsonify({"error": "Missing one or more required fields: response_col, transform_choice"}), 400

    if response_col not in df.columns:
        return jsonify({"error": f"Column '{response_col}' not found in the uploaded file."}), 400

    df_transformed = df.copy()
    original_response_col = response_col
    new_response_col_name = original_response_col

    df_transformed[response_col] = pd.to_numeric(df_transformed[response_col], errors='coerce')

    if transform_choice == 'log':
        try:
            df_transformed[response_col] = df_transformed[response_col].apply(lambda x: np.log1p(x) if x >= 0 else np.log1p(-x))
            new_response_col_name = f"Log_{original_response_col}"
            df_transformed.rename(columns={response_col: new_response_col_name}, inplace=True)
        except Exception as e:
            return jsonify({"error": f"Error during log transformation: {e}"}), 500

    elif transform_choice == 'sqrt':
        try:
            if (df_transformed[response_col] < 0).any():
                return jsonify({"error": "Square root transformation cannot be applied to negative values."}), 400
            df_transformed[response_col] = np.sqrt(df_transformed[response_col])
            new_response_col_name = f"Sqrt_{original_response_col}"
            df_transformed.rename(columns={response_col: new_response_col_name}, inplace=True)
        except Exception as e:
            return jsonify({"error": f"Error during square root transformation: {e}"}), 500

    elif transform_choice == 'boxcox':
        try:
            if (df_transformed[response_col] <= 0).any():
                return jsonify({"error": "Box-Cox transformation requires positive data."}), 400
            df_transformed[response_col], _ = stats.boxcox(df_transformed[response_col])
            new_response_col_name = f"BoxCox_{original_response_col}"
            df_transformed.rename(columns={response_col: new_response_col_name}, inplace=True)
        except Exception as e:
            return jsonify({"error": f"Error during Box-Cox transformation: {e}"}), 500

    elif transform_choice == 'yeojohnson':
        try:
            df_transformed[response_col], _ = stats.yeojohnson(df_transformed[response_col])
            new_response_col_name = f"YeoJohnson_{original_response_col}"
            df_transformed.rename(columns={response_col: new_response_col_name}, inplace=True)
        except Exception as e:
            return jsonify({"error": f"Error during Yeo-Johnson transformation: {e}"}), 500
    
    elif transform_choice == 'arcsine':
        try:
            # Arcsine transformation is typically for proportion data (values between 0 and 1)
            if not ((df_transformed[response_col] >= 0) & (df_transformed[response_col] <= 1)).all():
                return jsonify({"error": "Arcsine transformation requires data to be in the range [0, 1]."}), 400
            df_transformed[response_col] = np.arcsin(np.sqrt(df_transformed[response_col]))
            new_response_col_name = f"Arcsine_{original_response_col}"
            df_transformed.rename(columns={response_col: new_response_col_name}, inplace=True)
        except Exception as e:
            return jsonify({"error": f"Error during arcsine transformation: {e}"}), 500
    
    elif transform_choice == 'untransformed':
        pass

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