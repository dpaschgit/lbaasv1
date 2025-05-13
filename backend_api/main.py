from fastapi import FastAPI, HTTPException, Depends, status, Body
from typing import List, Dict, Optional, Any
# from uuid import uuid4 # Not used for MongoDB _id
import motor.motor_asyncio
from datetime import datetime, timezone

from models import VipBase, VipCreate, VipDB, VipUpdate, PoolMember, Monitor, Persistence, PyObjectId
from auth import get_current_active_user, User, auth_router
from integrations import (
    call_tcpwave_ipam_mock,
    call_servicenow_cmdb_mock,
    call_servicenow_incident_validation_mock,
    call_translator_module
)
from db import get_database, get_vips_collection

# --- App Initialization ---
app = FastAPI(
    title="Load Balancer Self-Service API",
    description="Manages Load Balancer VIP configurations, integrates with IPAM, CMDB, and Translators.",
    version="0.1.0"
)

app.include_router(auth_router)

# --- Helper Functions for Entitlements ---
async def check_ownership_or_admin(vip_id: str, current_user: User, db_client: motor.motor_asyncio.AsyncIOMotorClient) -> VipDB:
    vips_collection = get_vips_collection(db_client)
    try:
        obj_id = PyObjectId(vip_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid VIP ID format: {vip_id}")
        
    vip = await vips_collection.find_one({"_id": obj_id })
    if not vip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VIP not found")
    
    vip_db = VipDB(**vip)
    if current_user.role == "admin":
        return vip_db
    secondary_contacts = vip_db.secondary_contact_email or [] 
    if vip_db.owner == current_user.username or current_user.username in secondary_contacts:
        return vip_db
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this VIP")

async def validate_incident_for_modification(incident_id: Optional[str], operation: str):
    if not incident_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"ServiceNow Incident ID is required for {operation} operation.")
    validation_result = await call_servicenow_incident_validation_mock(incident_id)
    if validation_result.get("error") or not validation_result.get("valid"):
        error_detail = validation_result.get("detail", "Incident validation failed or incident not approved.")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_detail)
    print(f"Incident {incident_id} validated successfully for {operation}.")

# --- API Endpoints ---
@app.get("/health", tags=["Health"], summary="Health check for the LBaaS API")
async def health_check():
    return {"status": "healthy", "service": "LBaaS API"}

@app.post("/api/v1/vips", response_model=VipDB, status_code=status.HTTP_201_CREATED, tags=["VIPs"], summary="Create a new VIP")
async def create_vip(
    vip_data: VipCreate,
    current_user: User = Depends(get_current_active_user),
    db_client: motor.motor_asyncio.AsyncIOMotorClient = Depends(get_database)
):
    if current_user.role == "auditor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Auditors cannot create VIPs.")

    vips_collection = get_vips_collection(db_client)
    
    vip_to_insert_data = vip_data.model_dump()
    # Ensure any 'id' or '_id' from input payload is removed to let MongoDB generate it
    vip_to_insert_data.pop("id", None)
    vip_to_insert_data.pop("_id", None)
    
    vip_to_insert_data["owner"] = current_user.username
    vip_to_insert_data["created_at"] = datetime.now(timezone.utc)
    vip_to_insert_data["updated_at"] = datetime.now(timezone.utc)

    insert_result = await vips_collection.insert_one(vip_to_insert_data)
    
    created_vip_doc = await vips_collection.find_one({"_id": insert_result.inserted_id})
    if not created_vip_doc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create and retrieve VIP after insertion.")

    return VipDB(**created_vip_doc)

@app.get("/api/v1/vips", response_model=List[VipDB], tags=["VIPs"], summary="List all VIPs")
async def list_vips(
    current_user: User = Depends(get_current_active_user),
    db_client: motor.motor_asyncio.AsyncIOMotorClient = Depends(get_database),
    environment: Optional[str] = None,
    owner: Optional[str] = None
):
    vips_collection = get_vips_collection(db_client)
    query: Dict[str, Any] = {}
    if environment:
        query["environment"] = environment
    
    if current_user.role == "user":
        query["owner"] = current_user.username if not owner else owner 
    elif owner: 
        query["owner"] = owner
        
    cursor = vips_collection.find(query)
    vips_list = await cursor.to_list(length=1000) 
    return [VipDB(**vip) for vip in vips_list]

@app.get("/api/v1/vips/{vip_id}", response_model=VipDB, tags=["VIPs"], summary="Get a specific VIP by ID")
async def get_vip(
    vip_id: str,
    current_user: User = Depends(get_current_active_user),
    db_client: motor.motor_asyncio.AsyncIOMotorClient = Depends(get_database)
):
    if current_user.role == "auditor":
        vips_collection = get_vips_collection(db_client)
        try:
            obj_id = PyObjectId(vip_id)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid VIP ID format: {vip_id}")
        vip = await vips_collection.find_one({"_id": obj_id})
        if not vip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VIP not found")
        return VipDB(**vip)
    
    return await check_ownership_or_admin(vip_id, current_user, db_client)

@app.put("/api/v1/vips/{vip_id}", response_model=VipDB, tags=["VIPs"], summary="Update an existing VIP")
async def update_vip(
    vip_id: str, 
    vip_update_data: VipUpdate, 
    current_user: User = Depends(get_current_active_user),
    db_client: motor.motor_asyncio.AsyncIOMotorClient = Depends(get_database),
    servicenow_incident_id: Optional[str] = Body(None, description="ServiceNow Incident ID for change validation")
):
    if current_user.role == "auditor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Auditors cannot update VIPs.")

    await validate_incident_for_modification(servicenow_incident_id, "update")
    
    await check_ownership_or_admin(vip_id, current_user, db_client) 
    vips_collection = get_vips_collection(db_client)
    try:
        obj_id = PyObjectId(vip_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid VIP ID format: {vip_id}")

    update_data = vip_update_data.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc)

    updated_vip_doc = await vips_collection.find_one_and_update(
        {"_id": obj_id},
        {"$set": update_data},
        return_document=motor.motor_asyncio.ReturnDocument.AFTER
    )

    if not updated_vip_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VIP not found after update attempt")
    
    return VipDB(**updated_vip_doc)

@app.delete("/api/v1/vips/{vip_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["VIPs"], summary="Delete a VIP")
async def delete_vip(
    vip_id: str, 
    current_user: User = Depends(get_current_active_user),
    db_client: motor.motor_asyncio.AsyncIOMotorClient = Depends(get_database),
    servicenow_incident_id: Optional[str] = Body(None, description="ServiceNow Incident ID for change validation")
):
    if current_user.role == "auditor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Auditors cannot delete VIPs.")

    await validate_incident_for_modification(servicenow_incident_id, "delete")

    await check_ownership_or_admin(vip_id, current_user, db_client) 
    vips_collection = get_vips_collection(db_client)
    try:
        obj_id = PyObjectId(vip_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid VIP ID format: {vip_id}")
    
    delete_result = await vips_collection.delete_one({"_id": obj_id})
    if delete_result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VIP not found or already deleted")

    return 

@app.on_event("startup")
async def startup_db_client():
    app.mongodb_client = await get_database() 
    app.mongodb = app.mongodb_client["lbaas_db"] 
    print("Attempting to connect to MongoDB at host.docker.internal...")
    try:
        await app.mongodb_client.admin.command(	'ping'	)
        print("Successfully connected to MongoDB!")
    except Exception as e:
        print(f"MongoDB connection failed: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    if hasattr(app, 'mongodb_client') and app.mongodb_client:
        app.mongodb_client.close()
        print("Disconnected from MongoDB.")

