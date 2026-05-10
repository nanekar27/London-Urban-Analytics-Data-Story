import pandas as pd
print("Pandas is working!")
import glob
import os

# Configuration
# 1. Name of the folder containing your 12+ CSV files
SOURCE_FOLDER = "raw_data/police_data"

# 2. Pattern to match your specific files (ignores other random files)
# This looks for files ending in "-metropolitan-street.csv"
FILE_PATTERN = "*-metropolitan-street.csv"

# 3. Name of the final merged file we will create
OUTPUT_FILE = "raw_data/london_crime_full_merged.csv"

def merge_police_data():
    # Construct the full path to search (e.g., "police_data/*-metropolitan-street.csv")
    search_path = os.path.join(SOURCE_FOLDER, FILE_PATTERN)
    
    print(f" Searching for files in: {search_path}")
    
    # Find all matching files and sort them so Jan comes before Feb
    all_files = sorted(glob.glob(search_path))
    
    # Check: Did we find any files?
    if not all_files:
        print(" ERROR: No files found!")
        print(f"   Make sure your CSVs are in the '{SOURCE_FOLDER}' folder.")
        return

    print(f" Found {len(all_files)} files. Starting merge...")

    # List to hold all the dataframes before merging
    data_list = []

    # Loop through each file
    for filename in all_files:
        try:
            print(f"   Reading: {os.path.basename(filename)}...")
            
            # Read the CSV
            df = pd.read_csv(filename)
            
            # OPTIONAL: To save memory, keep only the columns we actually need for the dashboard
            # If you want ALL columns, delete the next line.
            # We need: Month (Time), Latitude/Longitude (Map), LSOA name (Borough), Crime type (Category)
            cols_to_keep = ['Month', 'Longitude', 'Latitude', 'LSOA name', 'Crime type']
            
            # Check if columns exist before filtering to avoid errors
            if set(cols_to_keep).issubset(df.columns):
                df = df[cols_to_keep]
            
            data_list.append(df)
            
        except Exception as e:
            print(f"  Warning: Could not read {filename}. Error: {e}")

    # Merge everything together
    if data_list:
        print("⏳ Concatenating files... (This may take a moment)")
        full_dataset = pd.concat(data_list, ignore_index=True)

        # CLEANING: Drop rows where location is missing (Vital for Maps)
        initial_count = len(full_dataset)
        full_dataset = full_dataset.dropna(subset=['Latitude', 'Longitude'])
        final_count = len(full_dataset)
        dropped_rows = initial_count - final_count

        print(f"   🧹 Cleaned data: Removed {dropped_rows} rows with missing coordinates.")

        # SAVE to a new CSV
        full_dataset.to_csv(OUTPUT_FILE, index=False)
        
        print("-" * 40)
        print(f" SUCCESS! Merged file created: {OUTPUT_FILE}")
        print(f" Total Rows Processed: {final_count}")
        print("-" * 40)
    else:
        print(" No data was merged.")

# Run the function
if __name__ == "__main__":
    merge_police_data()
