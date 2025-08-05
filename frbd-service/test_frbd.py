import pandas as pd
import io
import os
import subprocess

# Create a dummy Excel file in memory
data = {
    'Block': ['A', 'A', 'A', 'B', 'B', 'B', 'C', 'C', 'C'],
    'Factor1': ['X', 'Y', 'Z', 'X', 'Y', 'Z', 'X', 'Y', 'Z'],
    'Factor2': ['M', 'M', 'N', 'N', 'O', 'O', 'M', 'N', 'O'],
    'Response': [10, 12, 15, 11, 14, 16, 13, 15, 18]
}
df = pd.DataFrame(data)

# Define a temporary file path for the Excel file
temp_excel_path = "/tmp/test.xlsx"

# Save the DataFrame to the temporary Excel file
with pd.ExcelWriter(temp_excel_path, engine='openpyxl') as writer:
    df.to_excel(writer, index=False)

# Define the endpoint and form data
url = 'http://localhost:8080/analyze'

# Construct the curl command
curl_command = [
    'curl',
    '-X', 'POST',
    url,
    '-F', f'file=@{temp_excel_path}',
    '-F', 'block_col=Block',
    '-F', 'factor_cols=Factor1,Factor2',
    '-F', 'response_col=Response'
]

# Execute the curl command
try:
    result = subprocess.run(curl_command, capture_output=True, text=True, check=True)
    print("Status Code:", result.returncode)
    print("Response:", result.stdout)
except subprocess.CalledProcessError as e:
    print(f"Curl command failed with error: {e}")
    print("Stderr:", e.stderr)
finally:
    # Clean up the temporary Excel file
    if os.path.exists(temp_excel_path):
        os.remove(temp_excel_path)