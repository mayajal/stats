FROM rocker/r-ver:4.3.1

# Set R_LIBS_USER to a directory within the container for package installation
ENV R_LIBS_USER /usr/local/lib/R/site-library
RUN mkdir -p ${R_LIBS_USER}

# Install system dependencies for R packages and R development tools
RUN apt-get update -qq && apt-get install -y \
    r-base-dev \
    gfortran \
    libcurl4-gnutls-dev \
    libssl-dev \
    libxml2-dev \
    libsodium-dev \
    pandoc \
    pandoc-citeproc \
    libudunits2-dev \
    libgdal-dev \
    libgeos-dev \
    libproj-dev \
    libcairo2-dev \
    libxt-dev \
    libblas-dev \
    liblapack-dev \
    cmake \
    && rm -rf /var/lib/apt/lists/*

# Install R packages one by one for better error visibility
# Use Rscript for non-interactive execution and ensure verbose output
RUN Rscript -e "install.packages('plumber', repos='https://cloud.r-project.org/', Ncpus = parallel::detectCores())"
RUN Rscript -e "install.packages('lme4', repos='https://cloud.r-project.org/', Ncpus = parallel::detectCores())"
RUN Rscript -e "install.packages('agricolae', repos='https://cloud.r-project.org/', Ncpus = parallel::detectCores())"
RUN Rscript -e "install.packages('ggplot2', repos='https://cloud.r-project.org/', Ncpus = parallel::detectCores())"
RUN Rscript -e "install.packages('dplyr', repos='https://cloud.r-project.org/', Ncpus = parallel::detectCores())"
RUN Rscript -e "install.packages('jsonlite', repos='https://cloud.r-project.org/', Ncpus = parallel::detectCores())"
RUN Rscript -e "install.packages('base64enc', repos='https://cloud.r-project.org/', Ncpus = parallel::detectCores())"

# Copy the Plumber API script
COPY plumber.R /plumber.R

# Expose port 8000 for the API
EXPOSE 8000

# Run the Plumber API
ENTRYPOINT ["R", "-e", "pr <- plumber::pr('plumber.R'); pr$run(host='0.0.0.0', port=8000)"]
