// You can replace the content of this string with your full knowledge base, perhaps read from a Markdown file.
export const knowledgeBase = `
# Statistical Methods Guide

## ANOVA (Analysis of Variance)
- **What it is:** ANOVA is used to compare the means of two or more groups to see if there is a statistically significant difference between them.
- **When to use it:** Use ANOVA when you have one continuous dependent variable (the outcome you're measuring) and one categorical independent variable (the groups you are comparing).
- **Example:** You want to know if the average test scores (dependent variable) are different among three different teaching methods (independent variable: Method A, Method B, Method C).

## ANCOVA (Analysis of Covariance)
- **What it is:** ANCOVA is an extension of ANOVA. It compares the means of groups while also controlling for the effect of other continuous variables, called covariates.
- **When to use it:** Use ANCOVA when you have a third variable (the covariate) that you suspect might be influencing the dependent variable, and you want to remove its effect to get a clearer picture of the difference between your groups.
- **Example:** You want to compare the effectiveness of two diet plans (independent variable) on weight loss (dependent variable), but you know that participants' starting weight (covariate) will also affect the outcome. ANCOVA lets you statistically "remove" the effect of starting weight.

## Linear Regression
- **What it is:** Linear Regression is used to model the relationship between a continuous dependent variable and one or more independent variables (which can be continuous or categorical).
- **When to use it:** Use it when you want to predict the value of one variable based on the value of others.
- **Example:** You want to predict a person's salary (dependent variable) based on their years of experience (independent variable).
`;
