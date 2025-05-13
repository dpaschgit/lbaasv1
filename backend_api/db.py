import motor.motor_asyncio
from bson import ObjectId
from typing import List, Optional

# Assuming models.py is in the same directory
from models import VipBase, VipCreate, VipUpdate 

# MongoDB connection URL - Use host.docker.internal for Docker Desktop
MONGO_DETAILS = "mongodb://host.docker.internal:27017"
DATABASE_NAME = "lbaas_db"
VIP_COLLECTION_NAME = "vips" # Renamed to avoid conflict with function

# Global client and database (initialized once)
client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_DETAILS)
database = client[DATABASE_NAME]
vip_collection_global = database[VIP_COLLECTION_NAME] # Used by functions within this module

# --- Functions to be imported by main.py for dependency injection ---
async def get_database() -> motor.motor_asyncio.AsyncIOMotorClient:
    """Returns the MongoDB client instance."""
    # This will use the globally defined client that connects to host.docker.internal
    return client

def get_vips_collection(db_client: motor.motor_asyncio.AsyncIOMotorClient) -> motor.motor_asyncio.AsyncIOMotorCollection:
    """Returns the VIPs collection from the given database client."""
    db = db_client[DATABASE_NAME]
    return db[VIP_COLLECTION_NAME]

# --- Helper function for DB operations ---
def vip_helper(vip_doc) -> dict:
    vip_doc["id"] = str(vip_doc["_id"])
    # del vip_doc["_id"] # Optionally delete _id if not needed in the response model beyond id
    return vip_doc

# --- CRUD operations for VIPs (used internally or could be exposed if needed) ---
async def create_vip_db(vip_data: VipCreate) -> dict:
    """Inserts a new VIP record into the database."""
    vip_dict = vip_data.model_dump()
    # In a real scenario, you might want to add created_at, updated_at timestamps here
    # from datetime import datetime, timezone
    # vip_dict["created_at"] = datetime.now(timezone.utc)
    # vip_dict["updated_at"] = datetime.now(timezone.utc)
    result = await vip_collection_global.insert_one(vip_dict)
    new_vip = await vip_collection_global.find_one({"_id": result.inserted_id})
    return vip_helper(new_vip)

async def get_all_vips_db() -> List[dict]:
    """Retrieves all VIPs from the database."""
    vips = []
    async for vip in vip_collection_global.find():
        vips.append(vip_helper(vip))
    return vips

async def get_vip_by_id_db(vip_id: str) -> Optional[dict]:
    """Retrieves a specific VIP by its ID from the database."""
    try:
        object_id = ObjectId(vip_id)
    except Exception:
        return None # Invalid ObjectId format
    vip = await vip_collection_global.find_one({"_id": object_id})
    if vip:
        return vip_helper(vip)
    return None

async def update_vip_db(vip_id: str, vip_update_data: VipUpdate) -> Optional[dict]:
    """Updates an existing VIP in the database."""
    try:
        object_id = ObjectId(vip_id)
    except Exception:
        return None # Invalid ObjectId format

    update_data = vip_update_data.model_dump(exclude_unset=True)

    if not update_data:
        existing_vip = await vip_collection_global.find_one({"_id": object_id})
        if existing_vip:
            return vip_helper(existing_vip)
        return None
        
    # from datetime import datetime, timezone
    # update_data["updated_at"] = datetime.now(timezone.utc)

    result = await vip_collection_global.update_one(
        {"_id": object_id},
        {"$set": update_data}
    )
    if result.modified_count == 1:
        updated_vip = await vip_collection_global.find_one({"_id": object_id})
        if updated_vip:
            return vip_helper(updated_vip)
    existing_vip = await vip_collection_global.find_one({"_id": object_id})
    if existing_vip:
        return vip_helper(existing_vip)
    return None

async def delete_vip_db(vip_id: str) -> bool:
    """Deletes a VIP from the database."""
    try:
        object_id = ObjectId(vip_id)
    except Exception:
        return False # Invalid ObjectId format
    result = await vip_collection_global.delete_one({"_id": object_id})
    return result.deleted_count == 1

