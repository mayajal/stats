
# What common mistakes should the chatbot warn about when choosing statistical methods

When guiding users to select statistical methods, the chatbot should actively warn agricultural scientists about these common mistakes to prevent flawed analyses and conclusions:

### 1. Using the Wrong Test for Variable Type

- Applying *parametric tests* (e.g., t-test, ANOVA) to data that is not continuous or not normally distributed.
- Using tests meant for continuous data on categorical or ordinal variables.


### 2. Ignoring Data Distribution Assumptions

- Not checking for normality when required, leading to invalid use of parametric methods.
- Failing to use non-parametric tests (e.g., Mann-Whitney U, Kruskal-Wallis) for skewed or ordinal data.


### 3. Overlooking Study Design Structure

- Treating paired/repeated measures data as independent, or vice versa.
- Not accounting for nested or hierarchical designs, which require mixed-effects or nested ANOVA rather than simple tests.


### 4. Neglecting Sample Size and Group Balance

- Using methods that assume equal variances or balanced group sizes without checking these assumptions.
- Analyzing very small sample sizes with methods that require larger samples for reliable results.


### 5. Mismatching Hypothesis and Test

- Using a test in a way that doesn’t address the research hypothesis.
- Comparing multiple groups without adjusting for multiple testing (omitting post-hoc analysis after ANOVA).


### 6. Misinterpreting p-values

- Relying only on p-values and ignoring effect size or practical significance.
- Declaring results “significant” without considering confidence intervals or study context.


### 7. Overlooking Confounding Variables

- Failing to control for potential confounders (using simple comparisons instead of ANCOVA or regression).


### 8. Not Considering Advanced/Appropriate Techniques

- Ignoring the need for advanced methods in multivariate or repeated measures data.
- In time-series or trend analyses, using standard ANOVA instead of repeated measures ANOVA or time-series techniques.


### 9. Misapplying Tests to Non-Independence

- Applying tests that assume independent samples when data points are not independent (e.g., multiple observations from the same field or plot).


### 10. Inadequate Reporting and Transparency

- Not specifying which test was used, or not justifying its choice.
- Failing to report limitations, data distribution assessments, or rationale behind method selection.

**Chatbot Recommendations:**

- Always clarify variable types, measurement levels, and data structure before recommending a test.
- Prompt for data distribution checks.
- Remind users to match test assumptions to actual experimental design.
- Warn about over-reliance on p-values; recommend also reporting confidence intervals and effect sizes.
- Suggest consulting a statistician for complex or borderline cases.

By flagging these pitfalls, the chatbot will provide more robust, scientifically sound guidance and help prevent common analytical errors in agricultural research.


