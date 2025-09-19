import googlemaps
import os
import pandas as pd
import geopandas as gpd
import matplotlib.pyplot as plt
import folium

from pysal.explore import esda
from splot.esda import lisa_cluster
from pysal.lib import weights

import pymc as pm
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
import io
import base64
import json
import arviz as az
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": [
    "http://localhost:3000",
    "https://vita.chloropy.com",
    "https://vita-zur5dejluq-uc.a.run.app",
    "http://localhost:9002",
    "https://vita--statviz-j3txi.us-central1.hosted.app"
]}})

@app.route('/spatial', methods=['POST'])
def spatial_analysis():
    """
    This function performs spatial analysis on the given data.
    The data is expected to be a JSON object with a key "data".
    The value of "data" should be an array of objects, where each object has the following keys:
    - "LOCATION": A string representing the location (e.g., "New York, NY").
    - "Value": A numerical value representing the yield.
    - "latitude" (optional): A numerical value representing the latitude.
    - "longitude" (optional): A numerical value representing the longitude.
    
    If "latitude" and "longitude" are not provided, the backend will attempt to geocode the "LOCATION".

    Example:
    {
      "data": [
        {
          "LOCATION": "New York, NY",
          "Value": 100
        },
        {
          "LOCATION": "Los Angeles, CA",
          "Value": 150,
          "latitude": 34.0522,
          "longitude": -118.2437
        }
      ]
    }
    """
    MAX_GP_ROWS = 100  # Limit for GP model to prevent timeouts
    try:
        data = request.get_json()
        df_raw = pd.DataFrame(data['data'])
        api_key = os.environ.get('GEOCODING_API_KEY')
        if not api_key:
            return jsonify({"error": "'GEOCODING_API_KEY' not set in .env file."}), 500

        df = df_raw.rename(columns={'Value': 'YIELD'})
        df['YIELD'] = pd.to_numeric(df['YIELD'], errors='coerce')

        # Ensure latitude and longitude columns exist
        if 'latitude' not in df.columns:
            df['latitude'] = np.nan
        if 'longitude' not in df.columns:
            df['longitude'] = np.nan

        # Convert existing lat/lon to numeric, coercing errors
        df['latitude'] = pd.to_numeric(df['latitude'], errors='coerce')
        df['longitude'] = pd.to_numeric(df['longitude'], errors='coerce')

        # Identify rows that need geocoding
        missing_coords_mask = df['latitude'].isnull() | df['longitude'].isnull()
        locations_to_geocode = df.loc[missing_coords_mask, 'LOCATION']

        if not locations_to_geocode.empty:
            gmaps = googlemaps.Client(key=api_key)

            def get_coords(place):
                try:
                    geocode_result = gmaps.geocode(place)
                    if geocode_result:
                        location = geocode_result[0]['geometry']['location']
                        return pd.Series({'latitude': location['lat'], 'longitude': location['lng']})
                    else:
                        return pd.Series({'latitude': None, 'longitude': None})
                except Exception as e:
                    return pd.Series({'latitude': None, 'longitude': None})

            # Get new coordinates
            new_coords = locations_to_geocode.apply(get_coords)

            # Update the dataframe with the new coordinates
            df.loc[missing_coords_mask, ['latitude', 'longitude']] = new_coords.values

        # Drop rows that still have missing coordinates after geocoding
        df.dropna(subset=['latitude', 'longitude', 'YIELD'], inplace=True)

        if df.empty:
            return jsonify({"error": "No locations with valid coordinates and yield data found."}), 400

        if len(df) < 2:
            return jsonify({"error": "At least 2 locations with valid coordinates are required for spatial analysis."}), 400

        gdf = gpd.GeoDataFrame(
            df,
            geometry=gpd.points_from_xy(df.longitude, df.latitude),
            crs='EPSG:4326'
        )

        response_data = {
            "plots": {},
            "moran_i": None,
            "lisa_results": None,
            "interactive_map": None
        }

        if len(gdf) >= 2:
            w = weights.KNN.from_dataframe(gdf, k=min(5, len(gdf)-1))
            w.transform = 'R'
            y = gdf['YIELD'].values

            if np.isfinite(np.nanstd(y)) and np.nanstd(y) > 0:
                moran = esda.Moran(y, w)
                response_data["moran_i"] = {"I": moran.I, "p_value": moran.p_norm}

                lisa = esda.Moran_Local(y, w)
                gdf['LISA_cluster'] = lisa.q
                gdf['LISA_p'] = lisa.p_sim
                
                response_data["lisa_results"] = gdf[['LOCATION', 'LISA_cluster', 'LISA_p', 'latitude', 'longitude']].to_dict(orient='records')

                fig, ax = plt.subplots(figsize=(8,8))
                lisa_cluster(lisa, gdf, p=0.05, ax=ax)
                plt.title("LISA Cluster Map (Significance p<0.05)")
                plt.tight_layout()
                buf = io.BytesIO()
                plt.savefig(buf, format='png')
                buf.seek(0)
                response_data["plots"]["lisa_cluster_map"] = base64.b64encode(buf.read()).decode('utf-8')
                plt.close(fig)

                # Bayesian Spatial Gaussian Process
                # Limit data for GP model if too large
                gdf_gp = gdf.copy()
                if len(gdf_gp) > MAX_GP_ROWS:
                    gdf_gp = gdf_gp.sample(n=MAX_GP_ROWS, random_state=42) # Use random_state for reproducibility
                
                coords_array = np.array(list(zip(gdf_gp.longitude, gdf_gp.latitude)))
                y_gp = gdf_gp['YIELD'].values # Use y_gp from the limited gdf_gp
                if len(np.unique(coords_array, axis=0)) >= 2 and len(y_gp) > 1:
                    pass # Placeholder for Bayesian GP, now removed

        # Interactive Map
        if len(gdf) > 0:
            center = [gdf.latitude.mean(), gdf.longitude.mean()]
            spatial_map = folium.Map(location=center, zoom_start=6, tiles="CartoDB positron")

            lisa_colors = {
                1: 'red',    # High-High
                2: 'orange', # High-Low
                3: 'purple', # Low-High
                4: 'blue',   # Low-Low
                0: 'gray'    # Not significant
            }
            lisa_labels = {
                1: 'High-High',
                2: 'High-Low',
                3: 'Low-High',
                4: 'Low-Low',
                0: 'Not Significant'
            }

            for _, row in gdf.iterrows():
                popup_info = f"<b>{row['LOCATION']}</b><br>Yield: {row['YIELD']:.2f}"
                
                marker_color = "blue" # Default color
                if 'LISA_cluster' in row and pd.notna(row['LISA_cluster']):
                    cluster_val = int(row['LISA_cluster'])
                    marker_color = lisa_colors.get(cluster_val, 'gray')
                    popup_info += f"<br>LISA Cluster: {lisa_labels.get(cluster_val, 'N/A')} (p={row['LISA_p']:.3f})"
                
                folium.CircleMarker(
                    location=[row['latitude'], row['longitude']],
                    radius=8,
                    color=marker_color,
                    fill=True,
                    fill_color=marker_color,
                    fill_opacity=0.7,
                    popup=folium.Popup(popup_info, max_width=250)
                ).add_to(spatial_map)

            # Add custom legend for LISA clusters
            legend_html = '''
                 <div style="position: fixed; 
                 bottom: 50px; left: 50px; width: 150px; height: 150px; 
                 border:2px solid grey; z-index:9999; font-size:14px;
                 background-color:white; opacity:0.9;">
                   &nbsp; <b>LISA Clusters</b> <br>
                   &nbsp; <i style="background:red; opacity:0.7; border-radius: 50%; display: inline-block; width: 10px; height: 10px;"></i>&nbsp; High-High <br>
                   &nbsp; <i style="background:orange; opacity:0.7; border-radius: 50%; display: inline-block; width: 10px; height: 10px;"></i>&nbsp; High-Low <br>
                   &nbsp; <i style="background:purple; opacity:0.7; border-radius: 50%; display: inline-block; width: 10px; height: 10px;"></i>&nbsp; Low-High <br>
                   &nbsp; <i style="background:blue; opacity:0.7; border-radius: 50%; display: inline-block; width: 10px; height: 10px;"></i>&nbsp; Low-Low <br>
                   &nbsp; <i style="background:gray; opacity:0.7; border-radius: 50%; display: inline-block; width: 10px; height: 10px;"></i>&nbsp; Not Significant
                 </div>
                 '''
            spatial_map.get_root().html.add_child(folium.Element(legend_html))

            response_data["interactive_map"] = spatial_map._repr_html_()

        return jsonify(response_data)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=8080)