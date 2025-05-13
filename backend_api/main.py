from fastapi import FastAPI, HTTPException, Depends, status, Body
from typing import List, Dict, Optional, Any
from uuid import uuid4
import motor.motor_asyncio

from models import VipBase, VipCreate, VipDB, VipUpdate, PoolMember, Monitor, Persistence # Ensure models are correctly imported
from auth import get_current_active_user, User, auth_router # Import auth components
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

# Include the authentication router
app.include_router(auth_router)

# --- Helper Functions for Entitlements (to be expanded) ---
async def check_ownership_or_admin(vip_id: str, current_user: User, db_client: motor.motor_asyncio.AsyncIOMotorClient) -> VipDB:
    vips_collection = get_vips_collection(db_client)
    vip = await vips_collection.find_one({"_id": vip_id})
    if not vip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VIP not found")
    
    vip_db = VipDB(**vip)
    if current_user.role == "admin":
        return vip_db
    if vip_db.owner == current_user.username or current_user.username in vip_db.contacts_secondary_email:
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

# --- VIP Management Endpoints ---
@app.post("/api/v1/vips", response_model=VipDB, status_code=status.HTTP_201_CREATED, tags=["VIPs"], summary="Create a new VIP")
async def create_vip(
    vip_data: VipCreate,
    current_user: User = Depends(get_current_active_user),
    db_client: motor.motor_asyncio.AsyncIOMotorClient = Depends(get_database)
):
    if current_user.role == "auditor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Auditors cannot create VIPs.")

    vips_collection = get_vips_collection(db_client)
    vip_id = str(uuid4())
    
    # TODO: IPAM integration - request and reserve IP from TCPwave mock
    # For now, using the provided IP, but in a real flow, TCPwave would assign it.
    # ipam_request_payload = {"subnet_id": vip_data.subnet_id_for_ipam} # Assuming subnet_id is passed or derived
    # ip_info = await call_tcpwave_ipam_mock(action="request_ip", payload=ipam_request_payload)
    # if ip_info.get("error"):
    #     raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"IPAM error: {ip_info.get(	"detail	")}")
    # vip_ip_from_ipam = ip_info.get("ip_address")
    # vip_data.vip_ip = vip_ip_from_ipam # Override with IPAM assigned IP

    # TODO: Filter pool members based on current_user ownership from ServiceNow mock
    # owned_servers = await call_servicenow_cmdb_mock(
    #     action="query_cis", 
    #     table_name="cmdb_ci_server_hardware", 
    #     query=f"owner={current_user.username}^environment={vip_data.environment}"
    # )
    # if owned_servers.get("error"):
    #     raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Could not verify server ownership.")
    # allowed_server_ips = [s["details"]["ip_address"] for s in owned_servers if not s.get("error")]
    # for member in vip_data.pool_members:
    #     if member.ip not in allowed_server_ips:
    #         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Server {member.ip} is not owned by you or not in the selected environment.")

    vip_to_save = VipDB(
        **vip_data.model_dump(), 
        _id=vip_id, 
        owner=current_user.username, # Set owner to current user
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    await vips_collection.insert_one(vip_to_save.model_dump(by_alias=True))

    # TODO: CMDB integration - Create CI in ServiceNow mock
    # sn_ci_payload = vip_to_save.model_dump()
    # sn_ci_payload.pop("_id") # Don	 send internal DB ID
    # sn_ci_payload["vip_name"] = vip_to_save.vip_fqdn # Example mapping
    # await call_servicenow_cmdb_mock(action="create_ci", table_name="cmdb_ci_lb_virtual_server", payload=sn_ci_payload)

    # TODO: Call translator module based on placement logic (environment, datacenter)
    # placement_key = f"{vip_data.environment}-{vip_data.datacenter}" # Example
    # translator_vendor = PLACEMENT_LOGIC.get(placement_key, "nginx") # Default to nginx if no rule
    # await call_translator_module(vendor=translator_vendor, vip_data=vip_to_save, operation="deploy")

    return vip_to_save

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
        # Regular users only see their own VIPs unless an admin is querying by owner
        query["owner"] = current_user.username if not owner else owner 
    elif owner: # Admin or Auditor can query by specific owner
        query["owner"] = owner
        
    cursor = vips_collection.find(query)
    vips = await cursor.to_list(length=1000) # Adjust length as needed
    return [VipDB(**vip) for vip in vips]

@app.get("/api/v1/vips/{vip_id}", response_model=VipDB, tags=["VIPs"], summary="Get a specific VIP by ID")
async def get_vip(
    vip_id: str,
    current_user: User = Depends(get_current_active_user),
    db_client: motor.motor_asyncio.AsyncIOMotorClient = Depends(get_database)
):
    # Auditor can view any. Admin/Owner check is handled by check_ownership_or_admin
    if current_user.role == "auditor":
        vips_collection = get_vips_collection(db_client)
        vip = await vips_collection.find_one({"_id": vip_id})
        if not vip:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VIP not found")
        return VipDB(**vip)
    
    # For admin/user, check_ownership_or_admin handles permissions
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
    
    vip_to_update = await check_ownership_or_admin(vip_id, current_user, db_client)
    vips_collection = get_vips_collection(db_client)

    # TODO: Filter pool members based on current_user ownership from ServiceNow mock (similar to create)

    update_data = vip_update_data.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc)

    updated_vip_doc = await vips_collection.find_one_and_update(
        {"_id": vip_id},
        {"$set": update_data},
        return_document=motor.motor_asyncio.ReturnDocument.AFTER
    )

    if not updated_vip_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VIP not found after update attempt")
    
    updated_vip = VipDB(**updated_vip_doc)

    # TODO: Update CMDB CI in ServiceNow mock
    # TODO: Call translator module for update

    return updated_vip

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

    vip_to_delete = await check_ownership_or_admin(vip_id, current_user, db_client)
    vips_collection = get_vips_collection(db_client)
    
    delete_result = await vips_collection.delete_one({"_id": vip_id})
    if delete_result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VIP not found or already deleted")

    # TODO: Update/Delete CMDB CI in ServiceNow mock
    # TODO: Call translator module for delete/disable

    return # No content response

# --- Placeholder for Placement Logic (to be defined based on user input) ---
# PLACEMENT_LOGIC = {
#     "Prod-LADC": "avi",
#     "Prod-NYDC": "f5",
#     "Dev-LADC": "nginx",
#     "UAT-NYDC": "nginx"
# }

# --- Application Lifecycle Hooks (for DB connection) ---
@app.on_event("startup")
async def startup_db_client():
    app.mongodb_client = motor.motor_asyncio.AsyncIOMotorClient("mongodb://localhost:27017") # Use user's local Docker mongo
    app.mongodb = app.mongodb_client["lbaas_db"]
    print("Connected to MongoDB!")

@app.on_event("shutdown")
async def shutdown_db_client():
    app.mongodb_client.close()
    print("Disconnected from MongoDB.")

# To run this (ensure MongoDB is running, e.g., via the docker-compose-mongo.yml provided earlier):
# cd backend_api
# pip install -r requirements.txt
# uvicorn main:app --reload --port 8000

