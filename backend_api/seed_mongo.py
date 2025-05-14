import asyncio
import motor.motor_asyncio
from datetime import datetime, timezone
from bson import ObjectId # Use bson.ObjectId for creating _id values

# --- Configuration ---
MONGO_DETAILS = "mongodb://host.docker.internal:27017" # User's local MongoDB
DB_NAME = "lbaas_db"
VIPS_COLLECTION_NAME = "vips"

# --- Sample Data ---
async def seed_data():
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_DETAILS)
    db = client[DB_NAME]
    vips_collection = db[VIPS_COLLECTION_NAME]

    # Clear existing data (optional, for clean seeding)
    await vips_collection.delete_many({})
    print("Cleared existing VIPs from MongoDB.")

    # Seed users are defined in auth.py (admin, auditor, user1, user2)
    # We will create VIPs owned by user1, user2, and admin.

    # Reference server IPs (can align with mock_servicenow CIs if needed for future linking)
    # For now, just representative IPs.
    user1_prod_server1_ip = "10.10.10.11"
    user1_prod_server2_ip = "10.10.10.12"
    user1_uat_server1_ip = "10.10.20.11"
    user1_dev_server1_ip = "192.168.100.11"

    user2_prod_server1_ip = "10.10.10.21"
    user2_prod_server2_ip = "10.10.10.22"
    user2_uat_server1_ip = "10.10.20.21"
    user2_dev_server1_ip = "192.168.100.21"
    
    admin_generic_server1 = "10.10.30.1"
    admin_generic_server2 = "10.10.30.2"

    seed_vips = [
        # --- VIPs for user1 ---
        {
            # "_id": ObjectId(), # Let MongoDB generate _id
            "vip_fqdn": "app1.prod.ladc.davelab.net",
            "vip_ip": "10.1.1.101", # Example IP from a potential IPAM pool
            "port": 443,
            "protocol": "HTTPS",
            "environment": "Prod",
            "datacenter": "LADC",
            "app_id": "APP001",
            "owner": "user1",
            "primary_contact_email": "user1@example.com",
            "secondary_contact_email": "team-alpha@example.com",
            "team_distribution_email": "app1-support@example.com",
            "monitor": {
                "type": "HTTPS", "port": 8443, "send_string": "GET /health HTTP/1.1\\r\\nHost: app1.prod.ladc.davelab.net\\r\\n\\r\\n", "receive_string": "200 OK"
            },
            "persistence": {"type": "COOKIE", "timeout": 1800},
            "lb_method": "LEAST_CONNECTIONS",
            "ssl_cert_name": "app1.prod.ladc.davelab.net.pem",
            "pool": [
                {"ip": user1_prod_server1_ip, "port": 8080},
                {"ip": user1_prod_server2_ip, "port": 8080}
            ],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "status": "Active",
            "remarks": "Seed VIP for App1 in Prod LADC, owned by user1"
        },
        {
            "vip_fqdn": "app1.uat.nydc.davelab.net",
            "vip_ip": "10.2.1.101",
            "port": 80,
            "protocol": "HTTP",
            "environment": "UAT",
            "datacenter": "NYDC",
            "app_id": "APP001",
            "owner": "user1",
            "primary_contact_email": "user1@example.com",
            "team_distribution_email": "app1-support@example.com",
            "monitor": {"type": "HTTP", "port": 8080, "send_string": "GET /status", "receive_string": "OK"},
            "pool": [
                {"ip": user1_uat_server1_ip, "port": 8080}
            ],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "status": "Active",
            "remarks": "Seed VIP for App1 in UAT NYDC, owned by user1"
        },
        # --- VIPs for user2 ---
        {
            "vip_fqdn": "app2.dev.ladc.davelab.net",
            "vip_ip": "192.168.1.50",
            "port": 8080,
            "protocol": "TCP",
            "environment": "DEV",
            "datacenter": "LADC",
            "app_id": "APP002",
            "owner": "user2",
            "primary_contact_email": "user2@example.com",
            "team_distribution_email": "app2-support@example.com",
            "monitor": {"type": "TCP", "port": 9000},
            "persistence": {"type": "SOURCE_IP", "timeout": 600},
            "pool": [
                {"ip": user2_dev_server1_ip, "port": 9000}
            ],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "status": "Active",
            "remarks": "Seed VIP for App2 in DEV LADC, owned by user2"
        },
        {
            "vip_fqdn": "app3.prod.nydc.davelab.net",
            "vip_ip": "10.2.2.202",
            "port": 443,
            "protocol": "HTTPS",
            "environment": "Prod",
            "datacenter": "NYDC",
            "app_id": "APP003",
            "owner": "user2",
            "primary_contact_email": "user2@example.com",
            "team_distribution_email": "app3-support@example.com",
            "monitor": {"type": "HTTPS", "port": 8443, "send_string": "GET /healthz", "receive_string": "healthy"},
            "ssl_cert_name": "app3.prod.nydc.davelab.net.pem",
            "pool": [
                {"ip": user2_prod_server1_ip, "port": 8000},
                {"ip": user2_prod_server2_ip, "port": 8000}
            ],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "status": "Building",
            "remarks": "Seed VIP for App3 in Prod NYDC, owned by user2, status Building"
        },
        # --- VIPs for admin ---
        {
            "vip_fqdn": "shared-service.prod.ladc.davelab.net",
            "vip_ip": "10.1.3.33",
            "port": 5000,
            "protocol": "TCP",
            "environment": "Prod",
            "datacenter": "LADC",
            "app_id": "SHARED01",
            "owner": "admin",
            "primary_contact_email": "admin@example.com",
            "team_distribution_email": "infra-ops@example.com",
            "monitor": {"type": "TCP", "port": 5000},
            "lb_method": "ROUND_ROBIN",
            "pool": [
                {"ip": admin_generic_server1, "port": 5000},
                {"ip": admin_generic_server2, "port": 5000}
            ],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "status": "Active",
            "remarks": "Seed L4 VIP for Shared Service in Prod LADC, owned by admin"
        }
    ]

    if seed_vips:
        # Ensure _id is not part of the dict if we want MongoDB to generate it
        # However, our VipDB model expects an _id (aliased from id) when reading.
        # For seeding, we can let MongoDB generate it by not providing _id.
        # The models.py VipDB has `id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")`
        # which means if _id is not provided, it will try to default. 
        # Best to let MongoDB handle it on insert if that's the design.
        # The current main.py create_vip strips id/_id, so we should do the same for consistency if using that path.
        # For direct insertion like this script, it's fine to not include _id.
        
        # The current main.py create_vip endpoint adds _id after insertion from insert_result.inserted_id
        # and the VipDB model expects it. So, for seeding to match, we should probably add it or ensure the model handles its absence on creation.
        # For now, let MongoDB generate it. The API will read it back with the generated _id.

        result = await vips_collection.insert_many(seed_vips)
        print(f"Seeded {len(result.inserted_ids)} VIPs into MongoDB.")
    else:
        print("No VIPs to seed.")

    client.close()

if __name__ == "__main__":
    asyncio.run(seed_data())

