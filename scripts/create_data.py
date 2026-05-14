import pandas as pd

data = [
    {"party_id": "SIIT", "record_id": "101", "amount": "5000", "status": "Clean"},
    {"party_id": "SIIT", "record_id": "102", "amount": "7500", "status": "Clean"},
    {"party_id": "Chula", "record_id": "201", "amount": "1200", "status": "Flagged"}
]
pd.DataFrame(data).to_csv("audit_data.csv", index=False)
print("✅ audit_data.csv created.")