# integrations.py

import httpx
import asyncio
from typing import Dict, Any, Optional

from .models import VipBase # For type hinting if needed

# --- Configuration for Mock Services (URLs will be defined when mocks are built) ---
# These URLs assume the mock services will be running and accessible.
# When running in Docker Compose, these might be service names, e.g., http://mock-tcpwave:8001
# For local development before full Docker Compose, localhost is fine if ports are mapped.
TCPWAVE_MOCK_URL = "http://localhost:8001"  # Updated: Base URL for the service
SERVICENOW_MOCK_URL = "http://localhost:8002" # Updated: Base URL for the service
TRANSLATOR_BASE_URL = "http://localhost:8003/translate" # Example base URL for translator services (still a placeholder)

# --- HTTP Client (reusable) ---
async def _make_http_request(method: str, url: str, json_payload: Optional[Dict] = None, params: Optional[Dict] = None) -> Dict[str, Any]:
    """Helper function to make asynchronous HTTP requests."""
    async with httpx.AsyncClient() as client:
        try:
            print(f"Making {method} request to {url} with params={params} json={json_payload}")
            if method.upper() == "GET":
                response = await client.get(url, params=params, timeout=10.0)
            elif method.upper() == "POST":
                response = await client.post(url, json=json_payload, params=params, timeout=10.0)
            elif method.upper() == "PUT":
                response = await client.put(url, json=json_payload, params=params, timeout=10.0)
            elif method.upper() == "DELETE":
                response = await client.delete(url, params=params, timeout=10.0)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            print(f"HTTP error occurred: {e.response.status_code} - {e.response.text}")
            error_detail = e.response.text
            try:
                error_detail = e.response.json() # Try to parse JSON error from service
            except Exception:
                pass # Keep as text if not JSON
            return {"error": True, "status_code": e.response.status_code, "detail": error_detail}
        except httpx.RequestError as e:
            print(f"Request error occurred: {e}")
            return {"error": True, "status_code": 503, "detail": f"Service unavailable or network error: {str(e)}"}

# --- TCPwave IPAM Mock Integration ---
async def call_tcpwave_ipam_mock(action: str, payload: Optional[Dict] = None, fqdn: Optional[str] = None, ip_address: Optional[str] = None, subnet_id: Optional[str] = None) -> Dict[str, Any]:
    """Calls the TCPwave IPAM mock service endpoints."""
    if action == "request_ip":
        if not payload: # Expects {"subnet_id": "..."}
            return {"error": True, "detail": "Payload with subnet_id required for request_ip"}
        return await _make_http_request("POST", f"{TCPWAVE_MOCK_URL}/api/ipam/request_ip", json_payload=payload)
    elif action == "reserve_ip":
        if not payload: # Expects {"ip_address": "...", "fqdn": "...", "subnet_id": "..."}
            return {"error": True, "detail": "Payload required for reserve_ip"}
        return await _make_http_request("POST", f"{TCPWAVE_MOCK_URL}/api/ipam/reserve_ip", json_payload=payload)
    elif action == "release_ip":
        if not payload: # Expects {"ip_address": "..."}
            return {"error": True, "detail": "Payload with ip_address required for release_ip"}
        return await _make_http_request("POST", f"{TCPWAVE_MOCK_URL}/api/ipam/release_ip", json_payload=payload)
    elif action == "update_fqdn":
        if not payload: # Expects {"ip_address": "...", "fqdn": "..."}
            return {"error": True, "detail": "Payload required for update_fqdn"}
        return await _make_http_request("POST", f"{TCPWAVE_MOCK_URL}/api/ipam/update_fqdn", json_payload=payload)
    elif action == "resolve_fqdn":
        if not fqdn:
            return {"error": True, "detail": "FQDN parameter required for resolve_fqdn"}
        return await _make_http_request("GET", f"{TCPWAVE_MOCK_URL}/api/ipam/resolve", params={"fqdn": fqdn})
    
    print(f"Unknown TCPwave action: {action}")
    return {"error": True, "detail": f"Unknown TCPwave IPAM action: {action}"}

# --- ServiceNow CMDB & Incident Mock Integration ---
async def call_servicenow_cmdb_mock(action: str, table_name: str, payload: Optional[Dict] = None, query: Optional[str] = None, sys_id: Optional[str] = None) -> Dict[str, Any]:
    """Calls the ServiceNow CMDB mock service endpoints."""
    if action == "create_ci":
        if not payload:
            return {"error": True, "detail": "Payload required for create_ci"}
        # The mock service expects payload.data, so wrap it if main.py sends flat payload
        wrapped_payload = {"data": payload} 
        return await _make_http_request("POST", f"{SERVICENOW_MOCK_URL}/api/now/table/{table_name}", json_payload=wrapped_payload)
    elif action == "query_cis":
        params = {"sysparm_query": query} if query else None
        return await _make_http_request("GET", f"{SERVICENOW_MOCK_URL}/api/now/table/{table_name}", params=params)
    elif action == "update_ci":
        if not payload or not sys_id:
            return {"error": True, "detail": "Payload and sys_id required for update_ci"}
        wrapped_payload = {"data": payload}
        return await _make_http_request("PUT", f"{SERVICENOW_MOCK_URL}/api/now/table/{table_name}/{sys_id}", json_payload=wrapped_payload)
    
    print(f"Unknown ServiceNow CMDB action: {action}")
    return {"error": True, "detail": f"Unknown ServiceNow CMDB action: {action}"}

async def call_servicenow_incident_validation_mock(incident_id: str) -> Dict[str, Any]:
    """Calls ServiceNow for incident ticket validation."""
    if not incident_id:
        return {"error": True, "detail": "Incident ID required for validation"}
    return await _make_http_request("GET", f"{SERVICENOW_MOCK_URL}/api/servicenow_mock/validate_incident", params={"number": incident_id})

# --- Ansible/Translator Module Integration (Still a Placeholder) ---
async def call_translator_module(vendor: str, vip_data: VipBase, operation: str) -> Dict[str, Any]:
    """Simulates calling a specific vendor translator module/container."""
    print(f"Calling Translator Module: Vendor={vendor}, VIP FQDN={vip_data.vip_fqdn}, Operation={operation}")
    # This will eventually make an HTTP call to the translator service, e.g.:
    # translator_url = f"{TRANSLATOR_BASE_URL}/{vendor}/{operation}"
    # return await _make_http_request("POST", translator_url, json_payload=vip_data.model_dump())
    await asyncio.sleep(0.1) # Simulate network latency for now
    if operation == "deploy" or operation == "update":
        return {"status": "success", "message": f"VIP {vip_data.vip_fqdn} {operation} operation placeholder for {vendor}", "config_generated": "mock config data..."}
    elif operation == "delete":
        return {"status": "success", "message": f"VIP {vip_data.vip_fqdn} {operation} operation placeholder for {vendor}"}
    return {"error": True, "detail": f"Unknown translator operation: {operation}"}

