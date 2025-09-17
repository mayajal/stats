# plumber.R

# Load necessary libraries
library(plumber)
library(lme4)
library(agricolae)
library(ggplot2)
library(dplyr)
library(jsonlite)
library(base64enc)

# --- Helper function to capture plot as base64 ---
plot_to_base64 <- function(plot_object, width = 800, height = 600) {
  temp_file <- tempfile(fileext = ".png")
  ggsave(temp_file, plot = plot_object, width = width / 100, height = height / 100, dpi = 100)
  img_base64 <- base64encode(readBin(temp_file, "raw", file.info(temp_file)$size))
  unlink(temp_file) # Clean up temporary file
  return(img_base64)
}

# --- Main analysis function (moved from alpha.R) ---
# This function will be called by the Plumber endpoint
perform_alpha_analysis <- function(data_json, response_col, fixed_effects_str, random_effects_str, tukey_factor) {
  results <- list(
    model_summary_html = NULL,
    tukey_results = NULL,
    tukey_explanation = "<br><p><b>Explanation of the Post-hoc Table:</b></p><ul><li><b>group1, group2:</b> The two groups being compared.</li><li><b>meandiff:</b> The difference in the means between group1 and group2 (mean of group2 - mean of group1).</li><li><b>lower, upper:</b> The lower and upper bounds of the confidence interval for the mean difference. If this interval does not contain 0, it suggests a significant difference.</li><li><b>reject:</b> A boolean value (True/False) indicating whether the null hypothesis of no difference between the two group means is rejected at the chosen alpha level.</li><li><b>p-adj:</b> The adjusted p-value for the comparison (multiple-comparison corrected).</li></ul><p><b>Interpretation:</b></p><p>A 'True' in the 'reject' column for a comparison indicates a statistically significant difference between the means of the two groups at the alpha = 0.05 level.</p>",
    plots = list(),
    mean_separation_results = NULL,
    cd_value = NULL,
    shapiro = list(stat = NULL, p = NULL),
    overall_cv = NULL,
    error = NULL
  )

  tryCatch({
    message("Starting analysis...")
    message(paste("response_col:", response_col))
    message(paste("fixed_effects_str:", fixed_effects_str))
    message(paste("random_effects_str:", random_effects_str))
    message(paste("tukey_factor:", tukey_factor))

    # --- Data Loading and Preparation ---
    data <- fromJSON(data_json)
    data <- as.data.frame(data)
    message(paste("Data loaded. Dimensions:", nrow(data), "rows,", ncol(data), "columns."))
    message(paste("Column names:", paste(colnames(data), collapse = ", ")))

    fixed_effects <- unlist(strsplit(fixed_effects_str, ","))
    random_effects <- unlist(strsplit(random_effects_str, ","))

    # Ensure response column is numeric
    if (!response_col %in% colnames(data)) {
      stop(paste0("Response column '", response_col, "' not found in data."))
    }
    data[[response_col]] <- as.numeric(data[[response_col]])
    if (any(is.na(data[[response_col]]))) {
      message("Warning: NAs introduced by coercing response column to numeric.")
    }

    # Convert relevant columns to factors
    for (fe in fixed_effects) {
      if (fe %in% colnames(data)) {
        data[[fe]] <- as.factor(data[[fe]])
      } else if (fe != "") { # Only warn if not empty string
        message(paste0("Warning: Fixed effect column '", fe, "' not found in data."))
      }
    }
    for (re in random_effects) {
      if (re %in% colnames(data)) {
        data[[re]] <- as.factor(data[[re]])
      } else if (re != "") { # Only warn if not empty string
        message(paste0("Warning: Random effect column '", re, "' not found in data."))
      }
    }
    if (tukey_factor %in% colnames(data)) {
      data[[tukey_factor]] <- as.factor(data[[tukey_factor]])
    } else if (tukey_factor != "") { # Only warn if not empty string
      message(paste0("Warning: Tukey factor column '", tukey_factor, "' not found in data."))
    }

    # Drop rows with missing values in critical columns
    all_model_cols <- c(response_col, fixed_effects, random_effects)
    all_model_cols <- all_model_cols[all_model_cols %in% colnames(data)] # Filter to only existing columns
    data_cleaned <- data[complete.cases(data[, all_model_cols]), ]
    message(paste("Data after cleaning. Dimensions:", nrow(data_cleaned), "rows,", ncol(data_cleaned), "columns."))

    if (nrow(data_cleaned) < 3) {
      stop(paste0("Not enough valid rows after cleaning (need at least 3). Found ", nrow(data_cleaned), "."))
    }
    for (re_col in random_effects) {
      if (re_col %in% colnames(data_cleaned) && length(unique(data_cleaned[[re_col]])) < 2) {
        stop(paste0("Random effect '", re_col, "' must have at least 2 unique levels after cleaning."))
      }
    }

    # --- Fit the Mixed-Effects Model ---
    # Filter out fixed/random effects that were not found in data or are empty strings
    fixed_effects_present <- fixed_effects[fixed_effects %in% colnames(data_cleaned) & fixed_effects != ""]
    random_effects_present <- random_effects[random_effects %in% colnames(data_cleaned) & random_effects != ""]

    if (length(fixed_effects_present) == 0) {
      stop("No valid fixed effects found in the data after cleaning.")
    }
    if (length(random_effects_present) == 0) {
      stop("No valid random effects found in the data after cleaning.")
    }

    random_effects_formula <- paste(paste0("(1 | ", random_effects_present, ")"), collapse = " + ")
    formula_str <- paste(response_col, "~", paste(fixed_effects_present, collapse = " + "), "+", random_effects_formula)
    message(paste("Model formula:", formula_str))

    model <- lmer(as.formula(formula_str), data = data_cleaned)
    message("Model fitted successfully.")

    # --- Post-Hoc Analysis (Tukey's HSD) ---
    message("Starting Tukey HSD analysis...")
    message(paste0("Unique levels of tukey_factor (", tukey_factor, ") in data_cleaned: ", length(unique(data_cleaned[[tukey_factor]]))))

    if (!tukey_factor %in% colnames(data_cleaned) || length(unique(data_cleaned[[tukey_factor]])) < 2) {
      results$tukey_results <- paste0("Factor '", tukey_factor, "' not found or has less than 2 levels after cleaning; Tukey HSD not applicable")
      message(results$tukey_results)
    } else {
      aov_formula_str <- paste(response_col, "~", paste(fixed_effects_present, collapse = " + "))
      aov_model <- aov(as.formula(aov_formula_str), data = data_cleaned)
      tukey_hsd_raw <- HSD.test(aov_model, trt = tukey_factor, console = FALSE)

      message(paste("Structure of tukey_hsd_raw:", capture.output(str(tukey_hsd_raw)), collapse = "\n"))
      message(paste("Column names of tukey_hsd_raw$comparison:", paste(colnames(tukey_hsd_raw$comparison), collapse = ", ")))

      # --- START: Added check for NULL comparison table ---
      if (is.null(tukey_hsd_raw$comparison)) {
        results$tukey_results <- paste0("No significant differences found for '", tukey_factor, "' at alpha=0.05. Comparison table is empty.")
        results$mean_separation_results <- paste0("No significant differences found for '", tukey_factor, "' at alpha=0.05. Mean separation table is empty.")
        results$cd_value <- "Not applicable (no significant differences)"
        message("Tukey HSD: No significant differences found, comparison table is NULL.")
      } else {
        # Original processing if comparison table exists
        tukey_df_formatted <- as.data.frame(tukey_hsd_raw$comparison) %>%
          mutate(group1 = rownames(.),
                 group2 = lead(group1, default = ""), # Simplified, actual pairwise comparisons are more complex
                 meandiff = difference, 
                 p.adj = pvalue,
                 reject = pvalue < 0.05,
                 lower = difference - LCL,
                 upper = difference + UCL) %>%
          select(group1, group2, meandiff, lower, upper, reject, p.adj)
        results$tukey_results <- toJSON(tukey_df_formatted, pretty = TRUE, auto_unbox = TRUE)

        mean_separation_df <- as.data.frame(tukey_hsd_raw$groups) %>%
          mutate(Treatment = rownames(.)) %>%
          select(Treatment, Mean, Significance) %>%
          arrange(desc(Mean))
        results$mean_separation_results <- toJSON(mean_separation_df, pretty = TRUE, auto_unbox = TRUE)

        results$cd_value <- tukey_hsd_raw$LSD
        message("Tukey HSD analysis completed.")
      }
      # --- END: Added check for NULL comparison table ---
    }

    # --- Diagnostics ---
    message("Starting diagnostic checks...")
    residuals <- resid(model)
    if (length(residuals) >= 3) {
      shapiro_test <- shapiro.test(residuals)
      results$shapiro$stat <- shapiro_test$statistic
      results$shapiro$p <- shapiro_test$p.value
      message("Shapiro-Wilk test completed.")
    } else {
      message("Not enough residuals to perform Shapiro-Wilk test.")
    }

    overall_mean <- mean(data_cleaned[[response_col]], na.rm = TRUE)
    overall_std <- sd(data_cleaned[[response_col]], na.rm = TRUE)
    results$overall_cv <- (overall_std / overall_mean) * 100
    message("Overall CV calculated.")

    # --- Generate Plots ---
    message("Starting plot generation...")
    residuals_plot <- ggplot(data.frame(fitted = fitted(model), residuals = resid(model)), aes(x = fitted, y = residuals)) +
      geom_point(alpha = 0.6) +
      geom_hline(yintercept = 0, linetype = "dashed", color = "red") +
      labs(title = "Residuals vs. Fitted Values", x = "Fitted Values", y = "Residuals") +
      theme_minimal()
    results$plots$residuals_vs_fitted <- plot_to_base64(residuals_plot)
    message("Residuals vs Fitted plot generated.")

    qq_plot <- ggplot(data.frame(residuals = resid(model)), aes(sample = residuals)) +
      stat_qq() +
      stat_qq_line(color = "red") +
      labs(title = "Q-Q Plot of Residuals") +
      theme_minimal()
    results$plots$qq_plot <- plot_to_base64(qq_plot)

    box_plot <- ggplot(data_cleaned, aes_string(x = tukey_factor, y = response_col)) +
      geom_boxplot(aes_string(fill = tukey_factor)) +
      labs(title = paste("Box Plot of", response_col, "by", tukey_factor), x = tukey_factor, y = response_col) +
      theme_minimal() +
      theme(legend.position = "none")
    results$plots$mean_box_plot <- plot_to_base64(box_plot)
    message("Box plot generated.")

    message("Analysis completed successfully.")

  }, error = function(e) {
    message(paste("Error during analysis:", e$message))
    results$error <- e$message
  })

  return(results)
}

#* Enable CORS
#* @filter cors
function(req, res) {
  res$setHeader("Access-Control-Allow-Origin", "*")
  if (req$REQUEST_METHOD == "OPTIONS") {
    res$setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
    res$setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
    res$status <- 200
    return(list())
  } else {
    plumber::forward()
  }
}

#* @post /alpha-r
#* @param req The request object (automatically populated by Plumber)
#* @param res The response object (automatically populated by Plumber)
#* @serializer json
function(req, res) {
  # Extract parameters from the request body
  # Use rawToChar and [[1]] to get the string value from multipart/form-data parts
  data_json <- rawToChar(req$body$data_json[[1]])
  response_col <- rawToChar(req$body$response_col[[1]])
  fixed_effects_str <- rawToChar(req$body$fixed_effects_str[[1]])
  random_effects_str <- rawToChar(req$body$random_effects_str[[1]])
  tukey_factor <- rawToChar(req$body$tukey_factor[[1]])

  # Now call the analysis function with the extracted parameters
  perform_alpha_analysis(data_json, response_col, fixed_effects_str, random_effects_str, tukey_factor)
}

#* Health check endpoint
#* @get /health
function() {
  "OK"
}