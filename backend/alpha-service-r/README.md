# Alpha Lattice Design Analysis (R Version)

This directory contains an R script (`alpha.R`) that performs an alpha lattice design analysis, mirroring the functionality of the Python `alpha.py` script.

## Files:
- `alpha.R`: The R script for performing the analysis.
- `alpha_data.csv`: A sample dataset for demonstration.
- `README.md`: This file.

## How to Run the R Script:

1.  **Install R:** If you don't have R installed, download it from [CRAN](https://cran.r-project.org/).

2.  **Install Required R Packages:** Open an R console and install the necessary packages by running the following commands:
    ```R
    install.packages("lme4")
    install.packages("agricolae")
    install.packages("ggplot2")
    install.packages("dplyr")
    ```

3.  **Navigate to the Directory:** Open your terminal or command prompt and navigate to this directory:
    ```bash
    cd /Users/gajendrababubaktavachalam/WebApps/statviz/stats/backend/alpha-service-r
    ```

4.  **Run the Script:** Execute the R script using the R interpreter:
    ```bash
    Rscript alpha.R
    ```

## Output:

The script will print the model summary, Tukey HSD test results, and diagnostic checks (Shapiro-Wilk test, CV) to the console. It will also create a `plots` directory containing the following image files:
- `residuals_vs_fitted.png`: Residuals vs. Fitted Values plot.
- `qq_plot.png`: Q-Q Plot of Residuals.
- `mean_box_plot.png`: Box Plot of Response by Treatment.

## Customization:

You can modify the `alpha.R` script to change the `response_col`, `fixed_effect`, `random_effects`, and `tukey_factor` variables to analyze different columns in your `alpha_data.csv` or a different dataset (ensure the dataset is in the same format and located in the same directory, or update the `read.csv` path).
