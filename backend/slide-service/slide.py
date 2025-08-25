import base64
import io
import os
import pandas as pd
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
import logging
import json

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["https://vita.chloropy.com","https://vita-zur5dejluq-uc.a.run.app", "http://localhost:9002", "https://vita--statviz-j3txi.us-central1.hosted.app"]}})

# Health Check endpoint for Cloud Run
@app.route("/")
def health():
    return "OK", 200

def add_table_to_slide(slide, df, left, top, width, height):
    """Adds a pandas DataFrame as a table to a slide."""
    rows, cols = df.shape[0] + 1, df.shape[1]
    shape = slide.shapes.add_table(rows, cols, left, top, width, height)
    table = shape.table

    # Set column headers
    for col_index, col_name in enumerate(df.columns):
        cell = table.cell(0, col_index)
        cell.text = str(col_name)
        cell.text_frame.paragraphs[0].font.bold = True
        cell.text_frame.paragraphs[0].alignment = PP_ALIGN.CENTER

    # Add data rows
    for row_index, (idx, row_data) in enumerate(df.iterrows()):
        for col_index, cell_data in enumerate(row_data):
            cell_text = str(cell_data) if not pd.isna(cell_data) else ""
            table.cell(row_index + 1, col_index).text = cell_text

    # Adjust font size
    for row in table.rows:
        for cell in row.cells:
            for paragraph in cell.text_frame.paragraphs:
                paragraph.font.size = Pt(10)

@app.route('/slide/generate', methods=['POST'])
def generate_slide():
    """
    Generates a PowerPoint slide from JSON data from rbd-service or frbd-service.
    """
    if 'analysis_title' not in request.form or 'json_data' not in request.form:
        return jsonify({"error": "Missing 'analysis_title' or 'json_data' in the request form."} ), 400

    analysis_title = request.form.get('analysis_title')
    json_data_str = request.form.get('json_data')

    try:
        data = json.loads(json_data_str)
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON data provided."} ), 400

    try:
        logging.info("Starting slide generation.")
        prs = Presentation()
        prs.slide_width = Inches(13.33)
        prs.slide_height = Inches(7.5)
        blank_slide_layout = prs.slide_layouts[6]
        slide = prs.slides.add_slide(blank_slide_layout)

        # --- Left Panel ---
        left_panel_left = Inches(0.5)
        left_panel_top = Inches(0.5)
        left_panel_width = Inches(6.5)

        # Title
        title_shape = slide.shapes.add_textbox(left_panel_left, left_panel_top, left_panel_width, Inches(0.5))
        title_shape.text_frame.text = analysis_title
        title_shape.text_frame.paragraphs[0].font.size = Pt(24)
        title_shape.text_frame.paragraphs[0].font.bold = True

        logging.info("Processing normality test.")
        # Normality Test
        shapiro_stat = data.get('shapiro', {}).get('stat')
        shapiro_p = data.get('shapiro', {}).get('p')
        stat_text = f"{shapiro_stat:.4f}" if isinstance(shapiro_stat, (int, float)) else "N/A"
        p_text = f"{shapiro_p:.4f}" if isinstance(shapiro_p, (int, float)) else "N/A"
        normality_text = f"Normality Test (Shapiro-Wilk): Statistic={stat_text}, p-value={p_text}"
        
        # Add interpretation based on p-value
        if isinstance(shapiro_p, (int, float)):
            if shapiro_p > 0.05:
                interpretation_text = "Residuals appear to be normally distributed (p >= 0.05)."
            else:
                interpretation_text = "Residuals appear NOT to be normally distributed (p <= 0.05)."
            normality_text += f"\n{interpretation_text}"

        normality_shape = slide.shapes.add_textbox(left_panel_left, Inches(1.0), left_panel_width, Inches(0.7))
        normality_shape.text_frame.text = normality_text
        normality_shape.text_frame.paragraphs[0].font.size = Pt(12)

        logging.info("Processing ANOVA table.")
        # ANOVA Table
        anova_table_json = data.get('anova_table')
        if anova_table_json:
            # Add title for ANOVA table
            anova_title_shape = slide.shapes.add_textbox(left_panel_left, Inches(1.5), left_panel_width, Inches(0.2))
            anova_title_shape.text_frame.text = "ANOVA Table"
            p = anova_title_shape.text_frame.paragraphs[0]
            p.font.bold = True
            p.font.size = Pt(12)
            p.alignment = PP_ALIGN.LEFT

            try:
                # Try reading with 'columns' orient first
                anova_df = pd.read_json(io.StringIO(anova_table_json), orient='columns')
            except (ValueError, TypeError):
                # Fallback for older/different format
                anova_df = pd.read_json(anova_table_json)
            
            # Reset index to make 'Source of Error' a column
            anova_df.reset_index(inplace=True)
            anova_df.rename(columns={'index': 'Source of Error'}, inplace=True)

            add_table_to_slide(slide, anova_df, left_panel_left, Inches(1.7), left_panel_width, Inches(1.5))

        logging.info("Processing mean separation results.")
        # Mean Separation Results
        mean_sep_key = None
        mean_separation_results = data.get('mean_separation_results')
        if mean_separation_results and isinstance(mean_separation_results, dict) and mean_separation_results.keys():
            # Add title for Mean Separation table
            mean_sep_title_shape = slide.shapes.add_textbox(left_panel_left, Inches(3.3), left_panel_width, Inches(0.2))
            mean_sep_title_shape.text_frame.text = "Mean Separation Table"
            p = mean_sep_title_shape.text_frame.paragraphs[0]
            p.font.bold = True
            p.font.size = Pt(12)
            p.alignment = PP_ALIGN.LEFT

            mean_sep_key = list(mean_separation_results.keys())[0]
            mean_sep_df = pd.read_json(mean_separation_results[mean_sep_key], orient='records')
            add_table_to_slide(slide, mean_sep_df, left_panel_left, Inches(3.5), left_panel_width, Inches(2.5))

        logging.info("Processing CV and CD values.")
        # CV and CD values
        cv_value = data.get('overall_cv')
        cd_value = data.get('cd_value')
        cv_text = f"{cv_value:.2f}%" if isinstance(cv_value, (int, float)) else "N/A"
        cd_text = f"{cd_value:.4f}" if isinstance(cd_value, (int, float)) else "N/A"
        footnote_text = f"CV: {cv_text}, CD: {cd_text}"
        footnote_shape = slide.shapes.add_textbox(left_panel_left, Inches(6.2), left_panel_width, Inches(0.5))
        footnote_shape.text_frame.text = footnote_text
        footnote_shape.text_frame.paragraphs[0].font.size = Pt(10)


        logging.info("Processing plots.")
        # --- Right Panel ---
        right_panel_left = Inches(7.5)
        right_panel_top = Inches(0.5)
        right_panel_width = Inches(5.5)

        plots = data.get('plots', {})
        if plots:
            # Box Plot
            box_plot_b64 = plots.get('mean_box_plot')
            if not box_plot_b64 and mean_sep_key:
                box_plot_b64 = plots.get(f'mean_box_plot_{mean_sep_key}')
            
            if box_plot_b64:
                img_data = base64.b64decode(box_plot_b64)
                img_stream = io.BytesIO(img_data)
                slide.shapes.add_picture(img_stream, right_panel_left, right_panel_top, width=right_panel_width, height=Inches(3))

            # Bar Chart
            bar_chart_b64 = plots.get('mean_bar_plot')
            if not bar_chart_b64 and mean_sep_key:
                bar_chart_b64 = plots.get(f'mean_bar_plot_{mean_sep_key}')

            if bar_chart_b64:
                img_data = base64.b64decode(bar_chart_b64)
                img_stream = io.BytesIO(img_data)
                slide.shapes.add_picture(img_stream, right_panel_left, Inches(4.0), width=right_panel_width, height=Inches(3))


        logging.info("Saving presentation.")
        # Save presentation to a memory buffer
        ppt_buffer = io.BytesIO()
        prs.save(ppt_buffer)
        ppt_buffer.seek(0)

        return send_file(
            ppt_buffer,
            as_attachment=True,
            download_name=f'{analysis_title.replace(" ", "_")}.pptx',
            mimetype='application/vnd.openxmlformats-officedocument.presentationml.presentation'
        )
    except Exception as e:
        logging.error(f"Error generating slide: {e}")
        return jsonify({"error": f"An error occurred while generating the slide: {e}"} ), 500

if __name__ == "__main__":
    debug_mode = os.environ.get("FLASK_ENV", "production") == "development"
    app.run(debug=debug_mode, host="0.0.0.0", port=int(os.environ.get("PORT", 9006)))
