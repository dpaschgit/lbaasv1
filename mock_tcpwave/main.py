# main.py for TCPwave IPAM Mock Service

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field
from typing import Dict, Optional, List
import ipaddress # For IP address manipulation and subnet checking

app = FastAPI(
    title="Mock TCPwave IPAM Service",
    description="Simulates TCPwave IPAM functionalities for development and testing.",
    version="0.1.0"
)

# --- In-memory storage for mock data ---
# Subnets: Store available IPs. For simplicity, we can just decrement a counter or pick from a list.
# For a more realistic mock, we could generate a pool of IPs for each known subnet.
mock_ip_allocations: Dict[str, Dict[str, str]] = {} # {ip_address: {"fqdn": fqdn, "subnet": subnet}}
mock_dns_records: Dict[str, str] = {} # {fqdn: ip_address}

# Example subnets known to the mock IPAM
# In a real scenario, these might be pre-configured or dynamically added.
KNOWN_SUBNETS = {
    "LADC-subnet": ipaddress.ip_network("10.10.10.0/24", strict=False),
    "NYDC-subnet": ipaddress.ip_network("10.10.20.0/24", strict=False),
    "DEV-generic": ipaddress.ip_network("192.168.100.0/24", strict=False)
}
# Keep track of the next available host index for each subnet to simulate allocation
subnet_next_host_index: Dict[str, int] = {name: 100 for name in KNOWN_SUBNETS} # Start allocating from .100

# --- Pydantic Models ---
class IPRequest(BaseModel):
    subnet_id: str = Field(..., example="LADC-subnet", description="Identifier for the subnet to request an IP from.")
    # requested_fqdn_pattern: Optional[str] = Field(None, example="vip-myapp-{env}") # Future: for patterned FQDNs

class IPReservation(BaseModel):
    ip_address: str = Field(..., example="10.10.10.100")
    fqdn: str = Field(..., example="vip123.davelab.net")
    subnet_id: str = Field(..., example="LADC-subnet")

class IPRelease(BaseModel):
    ip_address: str = Field(..., example="10.10.10.100")

class FQDNUpdate(BaseModel):
    ip_address: str = Field(..., example="10.10.10.100")
    fqdn: str = Field(..., example="new-vip.davelab.net")

# --- API Endpoints ---
@app.get("/health", tags=["Health"], summary="Health check for Mock IPAM service")
async def health_check():
    return {"status": "healthy", "service": "Mock TCPwave IPAM"}

@app.post("/api/ipam/request_ip", tags=["IPAM"], summary="Request the next available IP from a subnet")
async def request_ip(ip_request: IPRequest):
    subnet_name = ip_request.subnet_id
    if subnet_name not in KNOWN_SUBNETS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Subnet ID 	'{subnet_name}	' not found.")

    network = KNOWN_SUBNETS[subnet_name]
    current_index = subnet_next_host_index.get(subnet_name, 100)

    # Try a few times to find an unallocated IP
    for i in range(current_index, current_index + 20): # Try next 20 IPs
        try:
            potential_ip = str(network.network_address + i) # Simplified allocation
            if network.network_address + i not in network.hosts(): # Ensure it's a valid host IP
                if i == network.num_addresses -2: # near end of subnet
                    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"No more available IPs in subnet 	'{subnet_name}	'.")
                continue
            
            if potential_ip not in mock_ip_allocations:
                # Generate a mock FQDN
                mock_fqdn = f"vip-mock-{subnet_name.lower().replace(	'-	', 	''	)}-{potential_ip.split(	'.	')[-1]}.davelab.net"
                
                # Reserve it (basic reservation)
                mock_ip_allocations[potential_ip] = {"fqdn": mock_fqdn, "subnet": subnet_name}
                mock_dns_records[mock_fqdn] = potential_ip
                subnet_next_host_index[subnet_name] = i + 1 # Move to next index for this subnet
                return {"ip_address": potential_ip, "fqdn": mock_fqdn, "subnet_id": subnet_name}
        except ValueError: # If we go out of hosts in the subnet
            break
            
    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Failed to allocate an IP in subnet 	'{subnet_name}	'. May be full or allocation error.")

@app.post("/api/ipam/reserve_ip", tags=["IPAM"], summary="Reserve a specific IP with an FQDN")
async def reserve_ip(reservation: IPReservation):
    if reservation.ip_address in mock_ip_allocations and mock_ip_allocations[reservation.ip_address]["fqdn"] != reservation.fqdn:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"IP 	'{reservation.ip_address}	' already allocated with a different FQDN.")
    
    # Check if FQDN is already in use by another IP
    if reservation.fqdn in mock_dns_records and mock_dns_records[reservation.fqdn] != reservation.ip_address:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"FQDN 	'{reservation.fqdn}	' already in use by another IP.")

    mock_ip_allocations[reservation.ip_address] = {"fqdn": reservation.fqdn, "subnet": reservation.subnet_id}
    mock_dns_records[reservation.fqdn] = reservation.ip_address
    return {"status": "success", "message": f"IP 	'{reservation.ip_address}	' reserved for FQDN 	'{reservation.fqdn}	'."}

@app.post("/api/ipam/release_ip", tags=["IPAM"], summary="Release an IP address")
async def release_ip(release_info: IPRelease):
    if release_info.ip_address not in mock_ip_allocations:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"IP 	'{release_info.ip_address}	' not found in allocations.")
    
    allocated_fqdn = mock_ip_allocations[release_info.ip_address]["fqdn"]
    del mock_ip_allocations[release_info.ip_address]
    if allocated_fqdn in mock_dns_records:
        del mock_dns_records[allocated_fqdn]
        
    return {"status": "success", "message": f"IP 	'{release_info.ip_address}	' and associated FQDN 	'{allocated_fqdn}	' released."}

@app.post("/api/ipam/update_fqdn", tags=["IPAM"], summary="Update the FQDN for a given IP address")
async def update_fqdn(update_info: FQDNUpdate):
    if update_info.ip_address not in mock_ip_allocations:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"IP 	'{update_info.ip_address}	' not found in allocations. Cannot update FQDN.")

    # Check if new FQDN is already in use by another IP
    if update_info.fqdn in mock_dns_records and mock_dns_records[update_info.fqdn] != update_info.ip_address:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"New FQDN 	'{update_info.fqdn}	' already in use by another IP.")

    old_fqdn = mock_ip_allocations[update_info.ip_address]["fqdn"]
    if old_fqdn in mock_dns_records:
        del mock_dns_records[old_fqdn]
    
    mock_ip_allocations[update_info.ip_address]["fqdn"] = update_info.fqdn
    mock_dns_records[update_info.fqdn] = update_info.ip_address
    return {"status": "success", "message": f"FQDN for IP 	'{update_info.ip_address}	' updated to 	'{update_info.fqdn}	'."}

@app.get("/api/ipam/resolve", tags=["DNS"], summary="Mock DNS resolution for an FQDN")
async def resolve_fqdn(fqdn: str):
    if fqdn in mock_dns_records:
        return {"fqdn": fqdn, "ip_address": mock_dns_records[fqdn]}
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"FQDN 	'{fqdn}	' not found in mock DNS records.")

# To run this mock service (save as main.py in mock_tcpwave directory):
# cd mock_tcpwave
# pip install -r requirements.txt
# uvicorn main:app --reload --port 8001

