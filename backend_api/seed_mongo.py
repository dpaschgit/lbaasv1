import asyncio
import motor.motor_asyncio
from datetime import datetime, timezone
from uuid import uuid4

# Assuming models.py and db.py are in the same directory or accessible in PYTHONPATH
# For a standalone script, you might need to adjust imports or copy model definitions
# For simplicity, let's redefine necessary Pydantic models here if running standalone
# Or, ensure this script is run in an environment where backend_api modules are available

# If running as part of the backend_api package, you could use:
# from backend_api.models import VipDB, PoolMember, Monitor, Persistence # etc.
# from backend_api.db import get_vips_collection, get_database

# For standalone execution, let's define simplified structures or assume they are available
# This script is intended to be run from within the backend_api directory or a similar context

# --- Configuration ---
MONGO_DETAILS = "mongodb://localhost:27017" # User's local MongoDB
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
    # We will create VIPs owned by user1 and user2

    seed_vips = [
        {
            "_id": str(uuid4()),
            "vip_fqdn": "app1.prod.ladc.davelab.net",
            "vip_ip": "10.10.10.101",
            "port": 443,
            "protocol": "HTTPS",
            "is_l4": False,
            "environment": "Prod",
            "datacenter": "LADC",
            "app_id": "app1",
            "owner": "user1",
            "primary_contact_email": "user1@example.com",
            "secondary_contact_email": ["team_alpha@example.com"],
            "team_distribution_email": "app1_support@example.com",
            "monitor": {
                "type": "HTTPS", "port": 8443, "send": "GET /health HTTP/1.1\\r\\nHost: app1.prod.ladc.davelab.net\\r\\n\\r\\n", "receive": "200 OK",
                "interval": 10, "timeout": 5, "successful_checks": 2, "failed_checks": 3
            },
            "persistence": {"type": "COOKIE", "ttl": 1800, "cookie_name": "APPSESSIONID"},
            "lb_method": "LEAST_CONNECTIONS",
            "ssl_cert_name": "app1.prod.ladc.davelab.net_cert",
            "pool_members": [
                {"ip": "10.10.10.11", "port": 8080, "monitor": {"use_alternate_port": True, "alternate_port": 9080}},
                {"ip": "10.10.10.12", "port": 8080}
            ],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "status": "Active",
            "remarks": "Seed VIP for App1 in Prod LADC, owned by user1"
        },
        {
            "_id": str(uuid4()),
            "vip_fqdn": "app2.dev.nydc.davelab.net",
            "vip_ip": "192.168.100.50",
            "port": 80,
            "protocol": "HTTP",
            "is_l4": False,
            "environment": "DEV",
            "datacenter": "NYDC",
            "app_id": "app2",
            "owner": "user2",
            "primary_contact_email": "user2@example.com",
            "secondary_contact_email": [],
            "team_distribution_email": "app2_support@example.com",
            "monitor": {"type": "TCP", "port": 8081, "interval": 5, "timeout": 2, "successful_checks": 1, "failed_checks": 2},
            "persistence": {"type": "SOURCE_IP", "ttl": 600},
            "lb_method": "ROUND_ROBIN",
            "pool_members": [
                {"ip": "192.168.100.21", "port": 8081}
            ],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "status": "Active",
            "remarks": "Seed VIP for App2 in DEV NYDC, owned by user2"
        },
        {
            "_id": str(uuid4()),
            "vip_fqdn": "db1.prod.ladc.davelab.net",
            "vip_ip": "10.10.10.200",
            "port": 3306,
            "protocol": "TCP",
            "is_l4": True,
            "environment": "Prod",
            "datacenter": "LADC",
            "app_id": "db1",
            "owner": "admin", # Admin can own VIPs too
            "primary_contact_email": "admin@example.com",
            "secondary_contact_email": [],
            "team_distribution_email": "dba_team@example.com",
            "monitor": {"type": "TCP", "port": 3306, "interval": 15, "timeout": 5, "successful_checks": 1, "failed_checks": 1},
            "lb_method": "LEAST_CONNECTIONS",
            "pool_members": [
                {"ip": "10.10.10.11", "port": 3306}, # Re-using a server for different service
                {"ip": "10.10.10.12", "port": 3306}
            ],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "status": "Active",
            "remarks": "Seed L4 VIP for DB1 in Prod LADC, owned by admin"
        }
    ]

    if seed_vips:
        result = await vips_collection.insert_many(seed_vips)
        print(f"Seeded {len(result.inserted_ids)} VIPs into MongoDB.")
    else:
        print("No VIPs to seed.")

    client.close()

if __name__ == "__main__":
    # Ensure that the script is run with asyncio context if using top-level await
    # For older Python versions or different setups, you might need:
    # loop = asyncio.get_event_loop()
    # loop.run_until_complete(seed_data())
    asyncio.run(seed_data())

