import os
import sys
import time
import hashlib
import findspark
import json
import pandas as pd

# --- ENVIRONMENT SETUP ---
python_path = r"C:\Users\HP\AppData\Local\Programs\Python\Python311\python.exe"
os.environ["PYSPARK_PYTHON"] = python_path
os.environ["PYSPARK_DRIVER_PYTHON"] = python_path
os.environ["JAVA_HOME"] = r"C:\Program Files\Java\jdk-17" 
os.environ["SPARK_HOME"] = r"C:\spark"

findspark.init()
from pyspark.sql import SparkSession
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

def load_multi_params():
    file_path = "phase1_output.json"
    if not os.path.exists(file_path):
        print(f"Error: {file_path} not found. Run Phase 1 first!")
        sys.exit(1)
    with open(file_path, "r") as f:
        return json.load(f)

MULTI_CONFIG = load_multi_params()

def process_hybrid_leaf(row):
    import hashlib
    import os
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    # Ensure row is treated as a dictionary
    # If using Spark RDD parallelize on a list of dicts, 'row' is a dict
    p_id = row.get('party_id')
    node_id = str(row.get('node_id'))
    is_real = row.get('is_real', False) # Default to False if not present
    
    party_params = MULTI_CONFIG[p_id]
    
    # Initialize AEAD
    aes_key = bytes.fromhex(party_params['aeadKey'])
    epoch = str(party_params['epoch'])
    aesgcm = AESGCM(aes_key)

    # Prepare Content (Real or Dummy)
    content = str(row.get('content', '')).encode()
    adj_list = str(row.get('adj_list', '[]'))

    # Rest of the encryption and hashing logic remains the same...
    aad = f"{p_id}{epoch}{node_id}".encode()
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, content, aad)
    
    # Physical Storage Simulation (Save to 'Cloud')
    if is_real or int(node_id) < 5:
        shard_path = f"cloud_storage/{p_id}"
        if not os.path.exists(shard_path):
            os.makedirs(shard_path, exist_ok=True)
        with open(f"{shard_path}/{node_id}.bin", "wb") as f:
            f.write(nonce + ciphertext)

    h_c = hashlib.sha256(ciphertext).hexdigest()
    h_adj = hashlib.sha256(adj_list.encode()).hexdigest()
    hvt = hashlib.sha256(f"{p_id}{epoch}{node_id}{h_c}{h_adj}".encode()).hexdigest()
    leaf_i = hashlib.sha256(f"{node_id}{hvt}".encode()).hexdigest()
    
    return (p_id, leaf_i)

def build_merkle_root(nodes):
    if not nodes: return None
    if len(nodes) == 1: return nodes[0]
    new_level = []
    nodes.sort()
    for i in range(0, len(nodes), 2):
        left = nodes[i]
        right = nodes[i+1] if i+1 < len(nodes) else nodes[i]
        combined = hashlib.sha256((left + right).encode()).hexdigest()
        new_level.append(combined)
    return build_merkle_root(new_level)

# Initialize Spark
spark = SparkSession.builder.master("local[*]").appName("Phase2-Hybrid").getOrCreate()

# --- STEP 1: LOAD REAL DATA ---
if not os.path.exists("audit_data.csv"):
    print("Generating sample audit_data.csv...")
    sample = [
        {"party_id": "SIIT", "node_id": "999001", "content": "Transaction_AAA", "adj_list": "[0]"},
        {"party_id": "SIIT", "node_id": "999002", "content": "Transaction_BBB", "adj_list": "[0]"},
        {"party_id": "Chula", "node_id": "888001", "content": "Record_CCC", "adj_list": "[1]"}
    ]
    pd.DataFrame(sample).to_csv("audit_data.csv", index=False)

real_df = pd.read_csv("audit_data.csv")
real_data = real_df.to_dict('records')
for r in real_data: r['is_real'] = True

# --- STEP 2: GENERATE PADDING (TO HIT 700K/300K) ---
print("⌛ Preparing Hybrid Dataset (Real + Synthetic Padding)...")
siit_target = 700000
chula_target = 300000

# Pad SIIT
siit_real = [r for r in real_data if r['party_id'] == "SIIT"]
siit_padding = [{"party_id": "SIIT", "node_id": i, "content": f"Dummy_{i}", "adj_list": "[]", "is_real": False} 
                for i in range(siit_target - len(siit_real))]

# Pad Chula
chula_real = [r for r in real_data if r['party_id'] == "Chula"]
chula_padding = [{"party_id": "Chula", "node_id": i, "content": f"Dummy_{i}", "adj_list": "[]", "is_real": False} 
                 for i in range(chula_target - len(chula_real))]

full_dataset = siit_real + siit_padding + chula_real + chula_padding

# --- STEP 3: SPARK PROCESSING ---
spark_start = time.time()
raw_rdd = spark.sparkContext.parallelize(full_dataset)
all_results = raw_rdd.map(process_hybrid_leaf).collect()
spark_duration = time.time() - spark_start

# --- STEP 4: MERKLE TREE CONSTRUCTION ---
party_groups = {}
for p_id, leaf in all_results:
    if p_id not in party_groups: party_groups[p_id] = []
    party_groups[p_id].append(leaf)

BATCH_SIZE = 512
export_data = {}

print("\n" + "═"*120)
print(f"{'Party ID':<15} | {'Nodes':<10} | {'Time (Sec)':<10} | {'Global Root (Blockchain Anchor)':<40}")
print("─" * 120)

for p_id, leaves in party_groups.items():
    party_start = time.time()
    n = len(leaves)
    
    # Build Tree in Batches
    num_batches = (n + BATCH_SIZE - 1) // BATCH_SIZE
    local_roots = []
    for k in range(num_batches):
        batch = leaves[k*BATCH_SIZE : (k+1)*BATCH_SIZE]
        local_roots.append(build_merkle_root(batch))
    
    global_root = f"0x{build_merkle_root(local_roots)}"
    
    total_time = ((n / len(full_dataset)) * spark_duration) + (time.time() - party_start)
    
    print(f"{p_id:<15} | {n:<10} | {round(total_time, 4):<10} | {global_root}")
    
    export_data[p_id] = {
        "partyId": p_id,
        "globalRoot": global_root,
        "nodeCount": n,
        "timestamp": time.time()
    }

with open("phase2_output.json", "w") as f:
    json.dump(export_data, f, indent=4)

print("═"*120)
print(f"✅ Hybrid Phase 2 Complete. Shards saved to /cloud_storage/ and root to phase2_output.json")