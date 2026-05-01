import os
import sys
import time
import hashlib
import findspark
import json

python_path = r"C:\Users\HP\AppData\Local\Programs\Python\Python311\python.exe"

os.environ["PYSPARK_PYTHON"] = python_path
os.environ["PYSPARK_DRIVER_PYTHON"] = python_path
os.environ["JAVA_HOME"] = r"C:\Program Files\Java\jdk-17" 
os.environ["SPARK_HOME"] = r"C:\spark"

findspark.init()


from pyspark.sql import SparkSession

def load_multi_params():
    file_path = "pkg_params_multi.json"
    if not os.path.exists(file_path):
        print(f"Error: {file_path} not found. Run Phase 1 first!")
        sys.exit(1)
    with open(file_path, "r") as f:
        return json.load(f)

MULTI_CONFIG = load_multi_params()

def process_step4_leaf(row):
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    import hashlib
    import os

    # A. Identify the party owner for this row
    p_id = row['party_id']
    party_params = MULTI_CONFIG[p_id]
    
    # B. Retrieve unique party context
    aes_key = bytes.fromhex(party_params['aeadKey'])
    epoch = str(party_params['epoch'])
    aesgcm = AESGCM(aes_key)

    node_id = str(row['node_id'])
    content = row['content'].encode()
    adj_list = str(row['adj_list'])

    # C. Authenticated Encryption with Associated Data (Step 4)
    # We bind the encryption to the PartyID and Epoch
    aad = f"{p_id}{epoch}{node_id}".encode()
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, content, aad)
    
    # D. Graph-Aware HVT with Contextual Binding
    h_c = hashlib.sha256(ciphertext).hexdigest()
    h_adj = hashlib.sha256(adj_list.encode()).hexdigest()
    # HVT = H(PartyID || Epoch || NodeID || H(C) || H(Adj))
    hvt = hashlib.sha256(f"{p_id}{epoch}{node_id}{h_c}{h_adj}".encode()).hexdigest()
    
    leaf_i = hashlib.sha256(f"{node_id}{hvt}".encode()).hexdigest()
    
    # Return tuple so we can group by party later
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

spark = SparkSession.builder \
    .master("local[*]") \
    .appName("Multi-Party Phase 2") \
    .getOrCreate()

BATCH_SIZE = 512 
final_report = []

print("⌛ Generating multi-party synthetic graph data...")
data_alpha = [{"party_id": "SIIT", "node_id": i, "content": f"A_Data_{i}", "adj_list": [i+1]} for i in range(700000)]
data_beta = [{"party_id": "Chula", "node_id": i, "content": f"B_Data_{i}", "adj_list": [i+1]} for i in range(300000)]
full_data = data_alpha + data_beta

start_time = time.time()
raw_rdd = spark.sparkContext.parallelize(full_data)

all_results = raw_rdd.map(process_step4_leaf).collect()

party_groups = {}
for p_id, leaf in all_results:
    if p_id not in party_groups: party_groups[p_id] = []
    party_groups[p_id].append(leaf)

final_report = []
for p_id, leaves in party_groups.items():
    n = len(leaves)
    num_batches = (n + BATCH_SIZE - 1) // BATCH_SIZE
    
    local_roots = []
    for k in range(num_batches):
        batch = leaves[k*BATCH_SIZE : (k+1)*BATCH_SIZE]
        local_roots.append(build_merkle_root(batch))
    
    global_root = build_merkle_root(local_roots)
    
    final_report.append({
        "Party": p_id,
        "Nodes": n,
        "Batches": num_batches,
        "GlobalRoot": global_root
    })

duration = time.time() - start_time

print("\n" + "═" * 145)
# Added columns for AEAD Key and GMSK
print(f"{'Party ID':<15} | {'Nodes':<10} | {'Batches':<10} | {'AEAD Key (Hex)':<15} | {'GMSK (Hex)':<15} | {'Final SMT Global Root (O(1))'}")
print("─" * 145)

for res in final_report:
    p_id = res['Party']
    
    # Retrieve the specific keys used for this party from our config
    aead_used = MULTI_CONFIG[p_id]['aeadKey']
    gmsk_used = MULTI_CONFIG[p_id]['gmsk']
    
    # We truncate the keys for display so the table stays readable
    display_aead = f"{aead_used[:10]}..."
    display_gmsk = f"{gmsk_used[:10]}..."
    
    print(f"{p_id:<15} | {res['Nodes']:<10} | {res['Batches']:<10} | {display_aead:<15} | {display_gmsk:<15} | {res['GlobalRoot']}")

print("═" * 145)
print(f"Total Processing Time: {round(duration, 4)} seconds")