import motor.motor_asyncio
from bson import ObjectId
from typing import List, Optional

from .models import VipBase, VipCreate, VipUpdate # Assuming models.py is in the same directory

# MongoDB connection URL - assuming it's running on localhost for now, as per user's Docker Desktop setup
MONGO_DETAILS = "mongodb://localhost:27017"
DATABASE_NAME = "lbaas_db"
VIP_COLLECTION = "vips"

client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_DETAILS)
database = client[DATABASE_NAME]
vip_collection = database[VIP_COLLECTION]

# Helper function to convert MongoDB document to Pydantic model, handling ObjectId
def vip_helper(vip_doc) -> dict:
    vip_doc["id"] = str(vip_doc["_id"])
    # del vip_doc["_id"] # Optionally delete _id if not needed in the response model beyond id
    return vip_doc

async def create_vip_db(vip_data: VipCreate) -> dict:
    """Inserts a new VIP record into the database."""
    vip_dict = vip_data.model_dump()
    # In a real scenario, you might want to add created_at, updated_at timestamps here
    # vip_dict["created_at"] = datetime.utcnow()
    # vip_dict["updated_at"] = datetime.utcnow()
    result = await vip_collection.insert_one(vip_dict)
    new_vip = await vip_collection.find_one({"_id": result.inserted_id})
    return vip_helper(new_vip)

async def get_all_vips_db() -> List[dict]:
    """Retrieves all VIPs from the database."""
    vips = []
    async for vip in vip_collection.find():
        vips.append(vip_helper(vip))
    return vips

async def get_vip_by_id_db(vip_id: str) -> Optional[dict]:
    """Retrieves a specific VIP by its ID from the database."""
    try:
        # MongoDB expects ObjectId for _id queries
        object_id = ObjectId(vip_id)
    except Exception:
        return None # Invalid ObjectId format
    vip = await vip_collection.find_one({"_id": object_id})
    if vip:
        return vip_helper(vip)
    return None

async def update_vip_db(vip_id: str, vip_update_data: VipUpdate) -> Optional[dict]:
    """Updates an existing VIP in the database."""
    try:
        object_id = ObjectId(vip_id)
    except Exception:
        return None # Invalid ObjectId format

    # Pydantic V2: model_dump(exclude_unset=True)
    # Pydantic V1: vip_update_data.dict(exclude_unset=True)
    update_data = vip_update_data.model_dump(exclude_unset=True)

    if not update_data:
        # If there's nothing to update (e.g., empty request body)
        # return await get_vip_by_id_db(vip_id) # Or handle as an error/no-op
        existing_vip = await vip_collection.find_one({"_id": object_id})
        if existing_vip:
            return vip_helper(existing_vip)
        return None
        
    # Add updated_at timestamp
    # update_data["updated_at"] = datetime.utcnow()

    result = await vip_collection.update_one(
        {"_id": object_id},
        {"$set": update_data}
    )
    if result.modified_count == 1:
        updated_vip = await vip_collection.find_one({"_id": object_id})
        if updated_vip:
            return vip_helper(updated_vip)
    # If not modified (e.g., data was the same or VIP not found), check if it exists
    existing_vip = await vip_collection.find_one({"_id": object_id})
    if existing_vip:
        return vip_helper(existing_vip) # Return current state if no actual change but VIP exists
    return None

async def delete_vip_db(vip_id: str) -> bool:
    """Deletes a VIP from the database."""
    try:
        object_id = ObjectId(vip_id)
    except Exception:
        return False # Invalid ObjectId format
    result = await vip_collection.delete_one({"_id": object_id})
    return result.deleted_count == 1

