# main.py for ServiceNow Mock Service

from fastapi import FastAPI, HTTPException, status, Query
from pydantic import BaseModel, Field, EmailStr
from typing import Dict, Optional, List, Any
import uuid # For generating mock sys_ids

app = FastAPI(
    title="Mock ServiceNow Service",
    description="Simulates ServiceNow CMDB and Incident validation functionalities for development and testing.",
    version="0.1.0"
)

# --- In-memory storage for mock data ---
mock_cmdb_cis: Dict[str, Dict[str, Any]] = {} # {ci_table_name: {sys_id: ci_data}}
mock_server_hardware_table = "cmdb_ci_server_hardware"
mock_lb_virtual_server_table = "cmdb_ci_lb_virtual_server"

# Initialize tables
mock_cmdb_cis[mock_server_hardware_table] = {}
mock_cmdb_cis[mock_lb_virtual_server_table] = {}

# Seed some server data for entitlement checks
def seed_server_data():
    servers_to_seed = [
        {"name": "server1-user1-prod", "ip_address": "10.10.10.11", "owner": "user1", "owner_distro": "user1_team@example.com", "manager": "managerA", "environment": "Prod", "datacenter": "LADC"},
        {"name": "server2-user1-prod", "ip_address": "10.10.10.12", "owner": "user1", "owner_distro": "user1_team@example.com", "manager": "managerA", "environment": "Prod", "datacenter": "LADC"},
        {"name": "server3-user1-uat", "ip_address": "10.10.20.11", "owner": "user1", "owner_distro": "user1_team@example.com", "manager": "managerA", "environment": "UAT", "datacenter": "NYDC"},
        {"name": "server4-user1-dev", "ip_address": "192.168.100.11", "owner": "user1", "owner_distro": "user1_team@example.com", "manager": "managerA", "environment": "DEV", "datacenter": "LADC"},
        {"name": "server5-user2-prod", "ip_address": "10.10.10.21", "owner": "user2", "owner_distro": "user2_team@example.com", "manager": "managerB", "environment": "Prod", "datacenter": "LADC"},
        {"name": "server6-user2-prod", "ip_address": "10.10.10.22", "owner": "user2", "owner_distro": "user2_team@example.com", "manager": "managerB", "environment": "Prod", "datacenter": "LADC"},
        {"name": "server7-user2-uat", "ip_address": "10.10.20.21", "owner": "user2", "owner_distro": "user2_team@example.com", "manager": "managerB", "environment": "UAT", "datacenter": "NYDC"},
        {"name": "server8-user2-dev", "ip_address": "192.168.100.21", "owner": "user2", "owner_distro": "user2_team@example.com", "manager": "managerB", "environment": "DEV", "datacenter": "NYDC"},
    ]
    for server_data in servers_to_seed:
        sys_id = str(uuid.uuid4())
        mock_cmdb_cis[mock_server_hardware_table][sys_id] = {"sys_id": sys_id, **server_data}

seed_server_data() # Seed data on startup

# --- Pydantic Models (subset for mock interaction) ---
class GenericCIBase(BaseModel):
    # Common fields, specific CIs will inherit and add more
    name: Optional[str] = None
    ip_address: Optional[str] = None
    environment: Optional[str] = None
    # Add other common fields as needed

class CICreatePayload(BaseModel):
    # Flexible payload, actual fields depend on the CI table
    # For cmdb_ci_lb_virtual_server, it might include: name, ip_address, port, environment, etc.
    # For cmdb_ci_server_hardware: name, ip_address, owner, environment, etc.
    data: Dict[str, Any]

class CIResponse(BaseModel):
    sys_id: str
    details: Dict[str, Any]

class IncidentValidationResponse(BaseModel):
    valid: bool
    incident_id: str
    incident_state: Optional[str] = None
    reason: Optional[str] = None

# --- API Endpoints ---
@app.get("/health", tags=["Health"], summary="Health check for Mock ServiceNow service")
async def health_check():
    return {"status": "healthy", "service": "Mock ServiceNow"}

# CMDB Table API Simulation
@app.post("/api/now/table/{table_name}", response_model=CIResponse, status_code=status.HTTP_201_CREATED, tags=["CMDB"], summary="Create a new CI record in a table")
async def create_ci(table_name: str, payload: CICreatePayload):
    if table_name not in mock_cmdb_cis:
        # Optionally create the table on the fly for flexibility in mock
        mock_cmdb_cis[table_name] = {}
        # raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Table 	'{table_name}	' not found in mock CMDB.")
    
    sys_id = str(uuid.uuid4())
    ci_data_to_store = {"sys_id": sys_id, **payload.data}
    mock_cmdb_cis[table_name][sys_id] = ci_data_to_store
    return {"sys_id": sys_id, "details": ci_data_to_store}

@app.get("/api/now/table/{table_name}", response_model=List[CIResponse], tags=["CMDB"], summary="Query CI records from a table")
async def query_cis(
    table_name: str, 
    sysparm_query: Optional[str] = Query(None, description="ServiceNow-style query (e.g., owner=user1^environment=Prod)")
):
    if table_name not in mock_cmdb_cis:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Table 	'{table_name}	' not found in mock CMDB.")
    
    results = []
    table_data = mock_cmdb_cis[table_name]

    if not sysparm_query:
        for sys_id, data in table_data.items():
            results.append({"sys_id": sys_id, "details": data})
        return results

    # Basic query parsing (very simplified for mock purposes)
    query_params = {}
    if sysparm_query:
        parts = sysparm_query.split(	'^	')
        for part in parts:
            if 	'=	' in part:
                key, value = part.split(	'=	', 1)
                query_params[key] = value
    
    for sys_id, data in table_data.items():
        match = True
        for q_key, q_value in query_params.items():
            if data.get(q_key) != q_value:
                match = False
                break
        if match:
            results.append({"sys_id": sys_id, "details": data})
            
    return results

@app.put("/api/now/table/{table_name}/{sys_id}", response_model=CIResponse, tags=["CMDB"], summary="Update a CI record")
async def update_ci(table_name: str, sys_id: str, payload: CICreatePayload):
    if table_name not in mock_cmdb_cis or sys_id not in mock_cmdb_cis[table_name]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"CI with sys_id 	'{sys_id}	' not found in table 	'{table_name}	'.")
    
    # Merge new data with existing data
    mock_cmdb_cis[table_name][sys_id].update(payload.data)
    # Ensure sys_id remains consistent if it was part of payload.data
    mock_cmdb_cis[table_name][sys_id]["sys_id"] = sys_id 
    return {"sys_id": sys_id, "details": mock_cmdb_cis[table_name][sys_id]}

# Incident Validation Simulation
@app.get("/api/servicenow_mock/validate_incident", response_model=IncidentValidationResponse, tags=["Incident"], summary="Validate a mock incident ticket number")
async def validate_incident(number: str = Query(..., example="123456")):
    if number == "123456":
        return {"valid": True, "incident_id": number, "incident_state": "Change Approved"}
    elif number == "666666":
        return {"valid": False, "incident_id": number, "incident_state": "Change Rejected", "reason": "Mock: Change request was rejected due to policy violation."}
    else:
        return {"valid": False, "incident_id": number, "reason": "Mock: Incident not found or not in an actionable state."}

# To run this mock service (save as main.py in mock_servicenow directory):
# cd mock_servicenow
# pip install -r requirements.txt
# uvicorn main:app --reload --port 8002

