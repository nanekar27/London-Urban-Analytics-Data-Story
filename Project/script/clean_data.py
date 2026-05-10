import csv
import re
import os
import sys
import json
from collections import defaultdict

# get the folder where this script lives
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# navigate up to find the project and root directories
PROJECT_DIR = os.path.join(SCRIPT_DIR, "..")
ROOT_DIR    = os.path.join(SCRIPT_DIR, "..", "..")
RAW_DIR     = os.path.join(ROOT_DIR, "raw_data")
OUT_DIR     = os.path.join(PROJECT_DIR, "data")

# paths to the three raw data files we need
CRIME_FILE   = os.path.join(RAW_DIR, "london_crime_full_merged.csv")
HOUSING_FILE = os.path.join(RAW_DIR, "pp-2025.csv")
SCHOOLS_FILE = os.path.join(RAW_DIR, "edubasealldata20260203.csv")

# full list of all 33 London boroughs - used to filter out non-London rows
LONDON_BOROUGHS = [
    "Barking and Dagenham", "Barnet", "Bexley", "Brent", "Bromley",
    "Camden", "City of London", "Croydon", "Ealing", "Enfield",
    "Greenwich", "Hackney", "Hammersmith and Fulham", "Haringey",
    "Harrow", "Havering", "Hillingdon", "Hounslow", "Islington",
    "Kensington and Chelsea", "Kingston upon Thames", "Lambeth",
    "Lewisham", "Merton", "Newham", "Redbridge",
    "Richmond upon Thames", "Southwark", "Sutton", "Tower Hamlets",
    "Waltham Forest", "Wandsworth", "Westminster"
]

# normalise borough names to lowercase and strip "city of" so matching is easier
def norm(s):
    return s.lower().replace("city of ", "").strip()

# build a lookup dict so we can go from messy raw name -> clean canonical name
_lookup = {norm(b): b for b in LONDON_BOROUGHS}
# these two edge cases kept breaking things so i added them manually
_lookup["city of westminster"] = "Westminster"
_lookup["westminster"] = "Westminster"

def to_canon(raw_name):
    # returns None if the name isn't a London borough, which we use to skip rows
    return _lookup.get(norm(raw_name), None)

# the housing CSV uses single letter codes, so map them to readable strings
PROP_TYPES = {
    "D": "Detached",
    "S": "Semi-Detached",
    "T": "Terraced",
    "F": "Flat",
    "O": "Other"
}
DURATION_TYPES = {
    "F": "Freehold",
    "L": "Leasehold",
    "U": "Unknown"
}

def check_files():
    # just making sure all three raw files exist before we do anything
    print("Checking raw data files...")
    print(f"Location: {os.path.abspath(RAW_DIR)}\n")
    
    all_ok = True
    for label, path in [
        ("Crime data",   CRIME_FILE),
        ("Housing data",  HOUSING_FILE),
        ("Schools data",  SCHOOLS_FILE),
    ]:
        if os.path.exists(path):
            mb = os.path.getsize(path) / (1024 * 1024)
            print(f"{label}: {os.path.basename(path)} ({mb:.0f} MB)")
        else:
            print(f"{label}: NOT FOUND")
            print(f"Expected: {os.path.abspath(path)}")
            all_ok = False

    # no point continuing if a file is missing
    if not all_ok:
        print("\nError: Required raw files are missing.")
        sys.exit(1)

    print(f"\nOutput directory: {os.path.abspath(OUT_DIR)}\n")

def clean_crime():
    print("Cleaning crime data...")

    # bmt = borough + month + type counts, b_totals = overall borough totals
    bmt = defaultdict(int)
    b_totals = defaultdict(int)

    total_read = 0
    total_kept = 0

    with open(CRIME_FILE, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            total_read += 1

            # the LSOA name looks like "Barnet 001A" so we strip the trailing code
            lsoa = row.get("LSOA name", "")
            raw_borough = re.sub(r"\s+\d+[A-Z]*$", "", lsoa)

            # skip anything that isn't a recognised London borough
            borough = to_canon(raw_borough)
            if not borough:
                continue

            month = row.get("Month", "")
            ctype = row.get("Crime type", "")

            # count this crime against the borough/month/type combination
            bmt[(borough, month, ctype)] += 1
            b_totals[borough] += 1
            total_kept += 1

    # write the detailed breakdown - one row per borough/month/crime type
    out1 = os.path.join(OUT_DIR, "crime_by_borough_month_type.csv")
    with open(out1, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Borough", "Month", "Crime_Type", "Count"])
        for (b, m, t), c in sorted(bmt.items()):
            w.writerow([b, m, t, c])

    # also write a simpler total-per-borough file for quick lookups
    out2 = os.path.join(OUT_DIR, "crime_by_borough.csv")
    with open(out2, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Borough", "Total_Crimes"])
        for b, c in sorted(b_totals.items()):
            w.writerow([b, c])

    print(f"Crime data processed: {total_kept:,} London records\n")

def clean_housing():
    print("Cleaning housing data...")

    transactions = []
    # h_agg stores lists of prices so we can compute averages and medians later
    h_agg = defaultdict(list)
    total_read = 0
    total_kept = 0

    with open(HOUSING_FILE, encoding="utf-8") as f:
        reader = csv.reader(f)
        for row in reader:
            total_read += 1
            # skip any malformed rows that are missing columns
            if len(row) < 16:
                continue

            # column 13 is the county - we only want Greater London rows
            if row[13].strip() != "GREATER LONDON":
                continue

            # column 12 is the district name, title-case it before matching
            district = row[12].strip().title()
            borough = to_canon(district)
            if not borough:
                continue

            # skip rows with missing or zero prices - they're probably bad data
            price = int(row[1]) if row[1].isdigit() else 0
            if price <= 0:
                continue

            transactions.append({
                "Borough": borough,
                "Price": price,
                "Date": row[2][:7],   # keep only YYYY-MM, not the full timestamp
                "Property_Type": PROP_TYPES.get(row[4], "Other"),
                "New_Build": "New" if row[5] == "Y" else "Existing",
                "Duration": DURATION_TYPES.get(row[6], "Unknown")
            })
            h_agg[(borough, PROP_TYPES.get(row[4], "Other"))].append(price)
            total_kept += 1

    # write every individual transaction - this file will be large
    with open(os.path.join(OUT_DIR, "housing_transactions.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=[
            "Borough", "Price", "Date", "Property_Type", "New_Build", "Duration"
        ])
        w.writeheader()
        w.writerows(transactions)

    # write a summary with average and median price per borough/property type
    with open(os.path.join(OUT_DIR, "housing_summary.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Borough", "Property_Type", "Average_Price", "Median_Price", "Transaction_Count"])
        for (b, pt), prices in sorted(h_agg.items()):
            avg = round(sum(prices) / len(prices))
            # simple median - sort and grab the middle element
            med = sorted(prices)[len(prices) // 2]
            w.writerow([b, pt, avg, med, len(prices)])

    print(f"Housing data processed: {total_kept:,} London transactions\n")

def clean_schools():
    print("Cleaning schools data...")

    records = []
    # aggregate stats per borough and education phase
    s_agg = defaultdict(lambda: {"count": 0, "capacity": 0, "pupils": 0, "fsm_sum": 0, "fsm_n": 0})
    total_kept = 0

    # this file uses latin-1 encoding, utf-8 throws errors on some rows
    with open(SCHOOLS_FILE, encoding="latin-1") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # only want schools that are in London and currently open
            if row.get("GOR (name)", "").strip() != "London":
                continue
            if row.get("EstablishmentStatus (name)", "").strip() != "Open":
                continue

            borough = to_canon(row.get("LA (name)", "").strip())
            if not borough:
                continue

            phase = row.get("PhaseOfEducation (name)", "").strip() or "Other"
            # some schools have blank capacity/pupil fields so default to 0
            capacity = int(row.get("SchoolCapacity", "0")) if row.get("SchoolCapacity", "").isdigit() else 0
            pupils = int(row.get("NumberOfPupils", "0")) if row.get("NumberOfPupils", "").isdigit() else 0
            # FSM = free school meals, used as a deprivation indicator
            fsm = float(row.get("PercentageFSM", "0")) if row.get("PercentageFSM", "").replace(".", "", 1).isdigit() else 0

            records.append({
                "Borough": borough,
                "School_Name": row.get("EstablishmentName", "").strip(),
                "Phase": phase,
                "Type_Group": row.get("EstablishmentTypeGroup (name)", "").strip(),
                "Capacity": capacity,
                "Pupils": pupils,
                "FSM_Percent": fsm,
                "Gender": row.get("Gender (name)", "").strip() or "Unknown",
                "Religious_Character": row.get("ReligiousCharacter (name)", "").strip() or "None"
            })

            # accumulate totals for the summary file
            key = (borough, phase)
            s_agg[key]["count"] += 1
            s_agg[key]["capacity"] += capacity
            s_agg[key]["pupils"] += pupils
            # only include schools that actually reported an FSM figure
            if fsm > 0:
                s_agg[key]["fsm_sum"] += fsm
                s_agg[key]["fsm_n"] += 1

            total_kept += 1

    # detailed file with one row per school
    with open(os.path.join(OUT_DIR, "schools_detail.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=[
            "Borough", "School_Name", "Phase", "Type_Group",
            "Capacity", "Pupils", "FSM_Percent", "Gender", "Religious_Character"
        ])
        w.writeheader()
        w.writerows(records)

    # summary file aggregated by borough and phase
    with open(os.path.join(OUT_DIR, "schools_summary.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Borough", "Phase", "Total_Schools", "Total_Capacity", "Total_Pupils", "Avg_FSM_Percent"])
        for (b, p), v in sorted(s_agg.items()):
            # guard against division by zero if no school reported FSM
            avg = round(v["fsm_sum"] / v["fsm_n"], 1) if v["fsm_n"] else 0
            w.writerow([b, p, v["count"], v["capacity"], v["pupils"], avg])

    print(f"Schools data processed: {total_kept:,} records\n")

#final summary
def print_summary():
    print("Processing complete.")
    print(f"Output directory: {os.path.abspath(OUT_DIR)}\n")

    # loop through every csv we produced and print a quick row count and file size
    for fname in sorted(os.listdir(OUT_DIR)):
        if fname.endswith(".csv"):
            path = os.path.join(OUT_DIR, fname)
            with open(path) as f:
                rows = sum(1 for _ in f) - 1  # subtract 1 to exclude the header
            size = os.path.getsize(path) / 1024
            print(f"{fname}: {rows:,} rows ({size:.1f} KB)")

if __name__ == "__main__":
    #create op folder
    os.makedirs(OUT_DIR, exist_ok=True)
#run all steps
    check_files()
    clean_crime()
    clean_housing()
    clean_schools()
    print_summary()