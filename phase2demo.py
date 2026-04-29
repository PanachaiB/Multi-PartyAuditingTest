import os
import sys
import time
import hashlib
import findspark

# 1. ตั้งค่า Path
python_path = r"C:\Users\HP\AppData\Local\Programs\Python\Python311\python.exe"

os.environ["PYSPARK_PYTHON"] = python_path
os.environ["PYSPARK_DRIVER_PYTHON"] = python_path
os.environ["JAVA_HOME"] = r"C:\Program Files\Java\jdk-17" 
os.environ["SPARK_HOME"] = r"C:\spark"

findspark.init()


from pyspark.sql import SparkSession

# --- 2. ตั้งค่า Spark Session ---
spark = SparkSession.builder \
    .master("local[*]") \
    .appName("DELIA_Full_Phase2_Demo") \
    .config("spark.driver.memory", "4g") \
    .config("spark.driver.host", "localhost") \
    .config("spark.pyspark.python", python_path) \
    .config("spark.pyspark.driver.python", python_path) \
    .getOrCreate()

# จำลอง Group Secret Key (gsk_k)
GROUP_SECRET_KEY = "GSK_SERVER_KEY_2026"
# กุญแจเข้ารหัส (ส่งเป็น bytes)
RAW_AES_KEY = os.urandom(16)

# --- 3. Step 4 Logic: Parallel Leaf Generation (Worker Side) ---
def process_step4_leaf(row):
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    import hashlib
    import os

    node_id = str(row['node_id'])
    content = row['content'].encode()
    adj_list = str(row['adj_list'])

    # A. Encryption
    aesgcm = AESGCM(RAW_AES_KEY)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, content, None)
    
    # B. HVT Generation: H(NodeID || H(C) || H(Adj))
    h_c = hashlib.sha256(ciphertext).hexdigest()
    h_adj = hashlib.sha256(adj_list.encode()).hexdigest()
    hvt = hashlib.sha256(f"{node_id}{h_c}{h_adj}".encode()).hexdigest()
    
    # C. Step 4 Equation: l_i = H(NodeID_i || HVT_i)
    leaf_i = hashlib.sha256(f"{node_id}{hvt}".encode()).hexdigest()
    
    return leaf_i

# --- 4. ฟังก์ชันสร้าง Merkle Root ---
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

# --- 5. Main Benchmark Loop ---
# ปรับจำนวน Node 
test_sizes = [1000, 5000, 10000, 20000] 
# กำหนดขนาด Micro-batch (n_k)
BATCH_SIZE = 512 

final_report = []
print("--- ENVIRONMENT CHECK ---")
print(f"System Executable: {sys.executable}")
print(f"Python Version: {sys.version}")
print(f"Spark Driver: {os.environ.get('PYSPARK_DRIVER_PYTHON')}")
print("--------------------------")
print("🚀 Starting DELIA Phase 2 Full Scale Benchmark...")
for n in test_sizes:
    print(f"⌛ Testing {n} nodes (Batch Size: {BATCH_SIZE})...")
    
    # เตรียมข้อมูล
    data = [{"node_id": i, "content": f"Data_{i}", "adj_list": [i+1]} for i in range(n)]
    
    start_time = time.time()
    
    # [Step 4] Parallel Processing via Spark
    raw_rdd = spark.sparkContext.parallelize(data)
    all_leaves = raw_rdd.map(process_step4_leaf).collect()
    
    # [Step 5] Batch-level aggregation & Signature amortization
    local_roots = []
    num_batches = (n + BATCH_SIZE - 1) // BATCH_SIZE
    
    for k in range(num_batches):
        # ดึงโหนดใน Batch B_k
        start_idx = k * BATCH_SIZE
        end_idx = min(start_idx + BATCH_SIZE, n)
        batch_k_leaves = all_leaves[start_idx : end_idx]
        
        # สมการ Step 5: r_k = MerkleRoot({l_i})
        r_k = build_merkle_root(batch_k_leaves)
        
        # สมการ Step 5: Sig_k = Sign(gsk_k, r_k)
        sig_k = hashlib.sha256(f"{r_k}{GROUP_SECRET_KEY}".encode()).hexdigest()
        
        local_roots.append(r_k)
        
    # สร้าง Global Root สุดท้ายเพื่อส่งขึ้น Blockchain (O(1))
    final_root = build_merkle_root(local_roots)
    
    end_time = time.time()
    duration = end_time - start_time
    
    # เก็บข้อมูลลง Report
    final_report.append({
        "Nodes": n,
        "Batches": num_batches,
        "Time": round(duration, 4),
        "GlobalRoot": f"{final_root[:10]}...{final_root[-10:]}"
    })

# --- 6. แสดงตารางสรุปผล ---
print("\n" + "═"*95)
print(f"{'Nodes':<10} | {'Batches':<10} | {'Time (Sec)':<15} | {'Final SMT Global Root (O(1))':<30}")
print("─"*95)
for res in final_report:
    print(f"{res['Nodes']:<10} | {res['Batches']:<10} | {res['Time']:<15} | {res['GlobalRoot']:<30}")
print("═"*95)
print(f"Summary: Total Nodes scaled to {test_sizes[-1]}, while Blockchain data remained constant.")

spark.stop()