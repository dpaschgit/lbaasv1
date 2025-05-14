# main.py for ServiceNow Mock Service

from fastapi import FastAPI, HTTPException, status, Query
from pydantic import BaseModel, Field, EmailStr
from typing import Dict, Optional, List, Any
import uuid # For generating mock sys_ids
from datetime import datetime, timezone

app = FastAPI(
    title="Mock ServiceNow Service",
    description="Simulates ServiceNow CMDB and Incident validation functionalities for development and testing.",
    version="0.2.0" # Version updated
)

# --- In-memory storage for mock data ---
mock_cmdb_cis: Dict[str, Dict[str, Dict[str, Any]]] = {} # {ci_table_name: {sys_id: ci_data}}
mock_server_hardware_table = "cmdb_ci_server_hardware"
mock_lb_virtual_server_table = "cmdb_ci_lb_virtual_server" # For VIPs
mock_incident_table = "incident"

# Initialize tables
mock_cmdb_cis[mock_server_hardware_table] = {}
mock_cmdb_cis[mock_lb_virtual_server_table] = {}
mock_cmdb_cis[mock_incident_table] = {}

# --- Mock Incident States ---
class IncidentState:
    NEW = "New"
    IN_PROGRESS = "In Progress"
    ON_HOLD = "On Hold"
    RESOLVED = "Resolved"
    CLOSED = "Closed"
    CANCELED = "Canceled"
    AWAITING_CHANGE_APPROVAL = "Awaiting Change Approval" # Custom state for our flow
    CHANGE_APPROVED = "Change Approved" # Key state for VIP operations
    CHANGE_REJECTED = "Change Rejected"

# Seed some server data for entitlement checks
def seed_initial_data():
    servers_to_seed = [
        {"name": "server1-user1-prod", "ip_address": "10.10.10.11", "owner": "user1", "owner_distro": "user1_team@example.com", "manager": "managerA", "environment": "Prod", "datacenter": "LADC", "sys_updated_on": datetime.now(timezone.utc).isoformat()},
        {"name": "server2-user1-prod", "ip_address": "10.10.10.12", "owner": "user1", "owner_distro": "user1_team@example.com", "manager": "managerA", "environment": "Prod", "datacenter": "LADC", "sys_updated_on": datetime.now(timezone.utc).isoformat()},
        {"name": "server5-user2-prod", "ip_address": "10.10.10.21", "owner": "user2", "owner_distro": "user2_team@example.com", "manager": "managerB", "environment": "Prod", "datacenter": "LADC", "sys_updated_on": datetime.now(timezone.utc).isoformat()},
    ]
    for server_data in servers_to_seed:
        sys_id = str(uuid.uuid4())
        mock_cmdb_cis[mock_server_hardware_table][sys_id] = {"sys_id": sys_id, **server_data}

    # Seed some incidents
    incidents_to_seed = [
        {"number": "INC0010001", "short_description": "Router down in LADC", "state": IncidentState.IN_PROGRESS, "sys_updated_on": datetime.now(timezone.utc).isoformat()},
        {"number": "INC0012345", "short_description": "VIP Creation Request - myapp-prod", "state": IncidentState.CHANGE_APPROVED, "assigned_to": "network_team", "sys_updated_on": datetime.now(timezone.utc).isoformat()},
        {"number": "INC0000001", "short_description": "VIP Creation - test-create-vip", "state": IncidentState.CHANGE_APPROVED, "assigned_to": "network_team", "sys_updated_on": datetime.now(timezone.utc).isoformat()},
        {"number": "CHG0000002", "short_description": "VIP Update - test-create-vip port change", "state": IncidentState.CHANGE_APPROVED, "assigned_to": "network_team", "sys_updated_on": datetime.now(timezone.utc).isoformat()},
        {"number": "INC0066666", "short_description": "Urgent: Database server unresponsive", "state": IncidentState.IN_PROGRESS, "sys_updated_on": datetime.now(timezone.utc).isoformat()},
        {"number": "INC0077777", "short_description": "VIP Modification - security policy update", "state": IncidentState.CHANGE_REJECTED, "rejection_reason": "Proposed change conflicts with security policy XYZ.", "sys_updated_on": datetime.now(timezone.utc).isoformat()},
        {"number": "INC0088888", "short_description": "New Load Balancer for Project Phoenix", "state": IncidentState.AWAITING_CHANGE_APPROVAL, "sys_updated_on": datetime.now(timezone.utc).isoformat()}
    ]
    for incident_data in incidents_to_seed:
        sys_id = str(uuid.uuid4()) # Incidents also have sys_ids
        mock_cmdb_cis[mock_incident_table][incident_data["number"]] = {"sys_id": sys_id, **incident_data} # Key by number for easy lookup

seed_initial_data() # Seed data on startup

# --- Pydantic Models ---
class GenericCIBase(BaseModel):
    name: Optional[str] = None
    ip_address: Optional[str] = None
    environment: Optional[str] = None
    # sys_updated_on: Optional[datetime] = None # Handled internally

class CICreatePayload(BaseModel):
    data: Dict[str, Any]

class CIUpdatePayload(BaseModel):
    data: Dict[str, Any] # For updates, only provided fields are changed

class CIResponse(BaseModel):
    sys_id: str
    details: Dict[str, Any]

class IncidentValidationRequest(BaseModel):
    incident_number: str = Field(..., example="INC0012345")
    required_state: Optional[str] = Field(IncidentState.CHANGE_APPROVED, description="The state the incident must be in to be considered valid for the operation.")

class IncidentValidationResponse(BaseModel):
    valid: bool
    incident_number: str
    incident_sys_id: Optional[str] = None
    actual_state: Optional[str] = None
    message: str

# --- API Endpoints ---
@app.get("/health", tags=["Health"], summary="Health check for Mock ServiceNow service")
async def health_check():
    return {"status": "healthy", "service": "Mock ServiceNow", "version": "0.2.0"}

# CMDB Table API Simulation
@app.post("/api/now/table/{table_name}", response_model=CIResponse, status_code=status.HTTP_201_CREATED, tags=["CMDB"], summary="Create a new CI record in a table")
async def create_ci(table_name: str, payload: CICreatePayload):
    if table_name not in mock_cmdb_cis:
        mock_cmdb_cis[table_name] = {} # Create table if not exists for mock flexibility
    
    sys_id = str(uuid.uuid4())
    ci_data_to_store = {"sys_id": sys_id, **payload.data}
    ci_data_to_store["sys_updated_on"] = datetime.now(timezone.utc).isoformat()
    ci_data_to_store["sys_created_on"] = datetime.now(timezone.utc).isoformat()
    
    mock_cmdb_cis[table_name][sys_id] = ci_data_to_store
    return {"sys_id": sys_id, "details": ci_data_to_store}

@app.get("/api/now/table/{table_name}", response_model=List[CIResponse], tags=["CMDB"], summary="Query CI records from a table")
async def query_cis(
    table_name: str, 
    sysparm_query: Optional[str] = Query(None, description="ServiceNow-style query (e.g., name=myvip^environment=Prod)")
):
    if table_name not in mock_cmdb_cis:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Table 	'{table_name}'	 not found in mock CMDB.")
    
    results = []
    # For incident table, we key by number, but return structure expects sys_id in details
    table_data_iterable = mock_cmdb_cis[table_name].values() 

    if not sysparm_query:
        for data in table_data_iterable:
            results.append({"sys_id": data.get("sys_id", "N/A"), "details": data})
        return results

    query_params = {}
    if sysparm_query:
        parts = sysparm_query.split(	'^	')
        for part in parts:
            if 	'=	' in part:
                key, value = part.split(	'=	', 1)
                query_params[key] = value
            elif "LIKE" in part.upper(): # Basic LIKE support
                key, value = part.split("LIKE", 1) if "LIKE" in part else part.split("like",1)
                query_params[key.strip()] = {"LIKE": value.strip().strip("%")}
            elif "ISEMPTY" in part.upper():
                key = part.split("ISEMPTY")[0].strip()
                query_params[key] = {"ISEMPTY": True}

    for data in table_data_iterable:
        match = True
        for q_key, q_val_obj in query_params.items():
            data_val = data.get(q_key)
            if isinstance(q_val_obj, dict):
                if "LIKE" in q_val_obj:
                    if not data_val or q_val_obj["LIKE"].lower() not in str(data_val).lower():
                        match = False
                        break
                elif "ISEMPTY" in q_val_obj:
                    if data_val is not None and data_val != "":
                        match = False
                        break
            elif data_val != q_val_obj:
                match = False
                break
        if match:
            results.append({"sys_id": data.get("sys_id", "N/A"), "details": data})
            
    return results

@app.put("/api/now/table/{table_name}/{sys_id}", response_model=CIResponse, tags=["CMDB"], summary="Update a CI record by sys_id")
async def update_ci(table_name: str, sys_id: str, payload: CIUpdatePayload):
    if table_name not in mock_cmdb_cis or sys_id not in mock_cmdb_cis[table_name]:
        # For incident table, sys_id might be the incident number if used directly
        if table_name == mock_incident_table and sys_id in mock_cmdb_cis[table_name]: # sys_id is actually number here
            pass # allow update by number for incidents
        else:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"CI with sys_id 	'{sys_id}'	 not found in table 	'{table_name}'.")
    
    key_to_update = sys_id # Could be sys_id or incident number
    mock_cmdb_cis[table_name][key_to_update].update(payload.data)
    mock_cmdb_cis[table_name][key_to_update]["sys_updated_on"] = datetime.now(timezone.utc).isoformat()
    # Ensure sys_id remains consistent if it was part of payload.data and we are using actual sys_id
    if "sys_id" in mock_cmdb_cis[table_name][key_to_update]:
         mock_cmdb_cis[table_name][key_to_update]["sys_id"] = mock_cmdb_cis[table_name][key_to_update]["sys_id"]
    else: # if we updated by incident number, ensure the original sys_id is preserved
        pass # original sys_id is already there

    return {"sys_id": key_to_update, "details": mock_cmdb_cis[table_name][key_to_update]}

# Enhanced Incident Validation Simulation
@app.get("/api/servicenow_mock/validate_incident", response_model=IncidentValidationResponse, tags=["Incident"], summary="Validate a mock incident ticket number against a required state via GET")
async def validate_incident_enhanced_get(
    incident_number: str = Query(..., alias="number", example="INC0012345"), 
    required_state: Optional[str] = Query(IncidentState.CHANGE_APPROVED, description="The state the incident must be in to be considered valid for the operation.")
):
    incident_data = mock_cmdb_cis[mock_incident_table].get(incident_number)

    if not incident_data:
        return IncidentValidationResponse(
            valid=False, 
            incident_number=incident_number, 
            message=f"Incident '{incident_number}' not found."
        )

    actual_state = incident_data.get("state")
    incident_sys_id = incident_data.get("sys_id")

    if actual_state == required_state:
        return IncidentValidationResponse(
            valid=True, 
            incident_number=incident_number, 
            incident_sys_id=incident_sys_id,
            actual_state=actual_state,
            message=f"Incident '{incident_number}' is valid and in the required state: '{required_state}'."
        )
    else:
        rejection_reason = incident_data.get("rejection_reason", f"Incident is in state '{actual_state}', but required state is '{required_state}'.")
        if actual_state == IncidentState.CHANGE_REJECTED and "rejection_reason" in incident_data:
             message = f"Incident '{incident_number}' was rejected. Reason: {incident_data['rejection_reason']}"
        else:
            message = f"Incident '{incident_number}' is in state '{actual_state}'. Required state for operation is '{required_state}'."
        return IncidentValidationResponse(
            valid=False, 
            incident_number=incident_number, 
            incident_sys_id=incident_sys_id,
            actual_state=actual_state,
            message=message
        )


@app.post("/api/servicenow_mock/validate_incident", response_model=IncidentValidationResponse, tags=["Incident"], summary="Validate a mock incident ticket number against a required state")
async def validate_incident_enhanced(request: IncidentValidationRequest):
    incident_number = request.incident_number
    required_state = request.required_state

    incident_data = mock_cmdb_cis[mock_incident_table].get(incident_number)

    if not incident_data:
        return IncidentValidationResponse(
            valid=False, 
            incident_number=incident_number, 
            message=f"Incident 	'{incident_number}'	 not found."
        )

    actual_state = incident_data.get("state")
    incident_sys_id = incident_data.get("sys_id")

    if actual_state == required_state:
        return IncidentValidationResponse(
            valid=True, 
            incident_number=incident_number, 
            incident_sys_id=incident_sys_id,
            actual_state=actual_state,
            message=f"Incident 	'{incident_number}'	 is valid and in the required state: 	'{required_state}'."
        )
    else:
        rejection_reason = incident_data.get("rejection_reason", f"Incident is in state 	'{actual_state}'	, but required state is 	'{required_state}'.")
        if actual_state == IncidentState.CHANGE_REJECTED and "rejection_reason" in incident_data:
             message = f"Incident 	'{incident_number}'	 was rejected. Reason: {incident_data['rejection_reason']}"
        else:
            message = f"Incident 	'{incident_number}'	 is in state 	'{actual_state}'	. Required state for operation is 	'{required_state}'."
        return IncidentValidationResponse(
            valid=False, 
            incident_number=incident_number, 
            incident_sys_id=incident_sys_id,
            actual_state=actual_state,
            message=message
        )

# To run this mock service (save as main.py in mock_servicenow directory):
# cd mock_servicenow
# Ensure requirements.txt has fastapi, uvicorn, pydantic
# pip install -r requirements.txt
# uvicorn main:app --reload --port 8002

