# main.py for TCPwave IPAM Mock Service

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field
from typing import Dict, Optional, List, Set
import ipaddress # For IP address manipulation and subnet checking

app = FastAPI(
    title="Mock TCPwave IPAM Service",
    description="Simulates TCPwave IPAM functionalities for development and testing.",
    version="0.2.0" # Version updated
)

# --- In-memory storage for mock data ---

# Example subnets known to the mock IPAM
KNOWN_SUBNETS: Dict[str, ipaddress.IPv4Network] = {
    "LADC-subnet": ipaddress.ip_network("10.10.10.0/24", strict=False),
    "NYDC-subnet": ipaddress.ip_network("10.10.20.0/24", strict=False),
    "DEV-generic": ipaddress.ip_network("192.168.100.0/24", strict=False)
}

# More robust pool management
ip_pools: Dict[str, Dict[str, Set[str]]] = {
    subnet: {"available": set(), "used": set()} for subnet in KNOWN_SUBNETS
}

mock_ip_allocations: Dict[str, Dict[str, str]] = {} # {ip_address: {"fqdn": fqdn, "subnet": subnet_name}}
mock_dns_records: Dict[str, str] = {} # {fqdn: ip_address}

MAX_IPS_PER_SUBNET_POOL = 20 # Max IPs to pre-populate in each subnet pool for the mock

def initialize_ip_pools():
    print("Initializing IP pools...")
    for subnet_name, network in KNOWN_SUBNETS.items():
        count = 0
        # Iterate over usable host addresses in the subnet
        for ip_obj in network.hosts():
            if count >= MAX_IPS_PER_SUBNET_POOL:
                break
            ip_str = str(ip_obj)
            ip_pools[subnet_name]["available"].add(ip_str)
            count += 1
        print(f"Initialized pool for {subnet_name} with {len(ip_pools[subnet_name]['available'])} IPs.")

# Initialize pools when the app starts
initialize_ip_pools()

# --- Pydantic Models ---
class IPRequest(BaseModel):
    subnet_id: str = Field(..., example="LADC-subnet", description="Identifier for the subnet to request an IP from.")
    fqdn_prefix: Optional[str] = Field(None, example="my-vip", description="Optional prefix for generating FQDN.")

class IPReservation(BaseModel):
    ip_address: str = Field(..., example="10.10.10.100")
    fqdn: str = Field(..., example="vip123.davelab.net")
    subnet_id: str = Field(..., example="LADC-subnet")

class IPRelease(BaseModel):
    ip_address: str = Field(..., example="10.10.10.100")

class FQDNUpdateRequest(BaseModel):
    ip_address: str = Field(..., example="10.10.10.100")
    new_fqdn: str = Field(..., example="new-vip.davelab.net")

# --- API Endpoints ---
@app.get("/health", tags=["Health"], summary="Health check for Mock IPAM service")
async def health_check():
    return {"status": "healthy", "service": "Mock TCPwave IPAM", "version": "0.2.0"}

@app.post("/api/ipam/request_ip", response_model=IPReservation, tags=["IPAM"], summary="Request the next available IP from a subnet")
async def request_ip(ip_request: IPRequest):
    subnet_name = ip_request.subnet_id
    if subnet_name not in KNOWN_SUBNETS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Subnet ID '{subnet_name}' not found or not managed.")

    if not ip_pools[subnet_name]["available"]:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"No more available IPs in subnet '{subnet_name}'. Pool exhausted.")

    # Get an IP from the available pool
    potential_ip = ip_pools[subnet_name]["available"].pop()
    ip_pools[subnet_name]["used"].add(potential_ip)

    # Generate a mock FQDN
    fqdn_prefix = ip_request.fqdn_prefix if ip_request.fqdn_prefix else f"vip-mock-{subnet_name.lower().replace('-', '')}"
    mock_fqdn = f"{fqdn_prefix}-{potential_ip.split('.')[-1]}.davelab.net"
    
    # Reserve it
    mock_ip_allocations[potential_ip] = {"fqdn": mock_fqdn, "subnet": subnet_name}
    mock_dns_records[mock_fqdn] = potential_ip
    
    return IPReservation(ip_address=potential_ip, fqdn=mock_fqdn, subnet_id=subnet_name)

@app.post("/api/ipam/reserve_ip", tags=["IPAM"], summary="Reserve a specific IP with an FQDN")
async def reserve_ip(reservation: IPReservation):
    subnet_name = reservation.subnet_id
    ip_to_reserve = reservation.ip_address
    fqdn_to_reserve = reservation.fqdn

    if subnet_name not in KNOWN_SUBNETS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Subnet ID '{subnet_name}' not found or not managed.")

    # Check if IP is part of the managed pool for this subnet
    if ip_to_reserve not in ip_pools[subnet_name]["available"] and ip_to_reserve not in ip_pools[subnet_name]["used"]:
        # Check if it's a valid IP for the subnet, even if not in our small pre-generated pool
        if ipaddress.ip_address(ip_to_reserve) not in KNOWN_SUBNETS[subnet_name]:
             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"IP '{ip_to_reserve}' does not belong to subnet '{subnet_name}'.")
        # If valid for subnet but not in pool, we can choose to allow this or not.
        # For now, let's assume it must be from the available pool or already used (for re-reservation with same FQDN).
        if ip_to_reserve not in ip_pools[subnet_name]["used"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"IP '{ip_to_reserve}' is not available in the managed pool for subnet '{subnet_name}'.")

    if ip_to_reserve in mock_ip_allocations:
        if mock_ip_allocations[ip_to_reserve]["fqdn"] != fqdn_to_reserve:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"IP '{ip_to_reserve}' already allocated with a different FQDN: {mock_ip_allocations[ip_to_reserve]['fqdn']}.")
        # If same FQDN, it's a re-reservation, which is fine.
    elif fqdn_to_reserve in mock_dns_records and mock_dns_records[fqdn_to_reserve] != ip_to_reserve:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"FQDN '{fqdn_to_reserve}' already in use by IP '{mock_dns_records[fqdn_to_reserve]}'.")

    # If IP was available, move it from available to used
    if ip_to_reserve in ip_pools[subnet_name]["available"]:
        ip_pools[subnet_name]["available"].remove(ip_to_reserve)
        ip_pools[subnet_name]["used"].add(ip_to_reserve)
    
    mock_ip_allocations[ip_to_reserve] = {"fqdn": fqdn_to_reserve, "subnet": subnet_name}
    mock_dns_records[fqdn_to_reserve] = ip_to_reserve
    return {"status": "success", "message": f"IP '{ip_to_reserve}' reserved for FQDN '{fqdn_to_reserve}' in subnet '{subnet_name}'."}

@app.post("/api/ipam/release_ip", tags=["IPAM"], summary="Release an IP address")
async def release_ip(release_info: IPRelease):
    ip_to_release = release_info.ip_address

    if ip_to_release not in mock_ip_allocations:
        # For more realistic behavior, don't reveal if it was never allocated vs already released
        # but for a mock, this is fine.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"IP '{ip_to_release}' not found in current allocations.")
    
    allocation_details = mock_ip_allocations[ip_to_release]
    subnet_name = allocation_details["subnet"]
    allocated_fqdn = allocation_details["fqdn"]

    # Remove from allocations and DNS
    del mock_ip_allocations[ip_to_release]
    if allocated_fqdn in mock_dns_records and mock_dns_records[allocated_fqdn] == ip_to_release:
        del mock_dns_records[allocated_fqdn]
        
    # Move IP back to available pool if it was in used pool
    if subnet_name in ip_pools and ip_to_release in ip_pools[subnet_name]["used"]:
        ip_pools[subnet_name]["used"].remove(ip_to_release)
        ip_pools[subnet_name]["available"].add(ip_to_release)
    # If not in a known subnet's used pool (e.g. reserved out-of-band), just remove allocation.
        
    return {"status": "success", "message": f"IP '{ip_to_release}' and associated FQDN '{allocated_fqdn}' released from subnet '{subnet_name}'."}

@app.post("/api/ipam/update_fqdn", tags=["IPAM"], summary="Update the FQDN for a given IP address")
async def update_fqdn(update_info: FQDNUpdateRequest):
    ip_address = update_info.ip_address
    new_fqdn = update_info.new_fqdn

    if ip_address not in mock_ip_allocations:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"IP '{ip_address}' not found in allocations. Cannot update FQDN.")

    # Check if new FQDN is already in use by another IP
    if new_fqdn in mock_dns_records and mock_dns_records[new_fqdn] != ip_address:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"New FQDN '{new_fqdn}' already in use by IP '{mock_dns_records[new_fqdn]}'.")

    old_fqdn = mock_ip_allocations[ip_address]["fqdn"]
    if old_fqdn in mock_dns_records and mock_dns_records[old_fqdn] == ip_address:
        del mock_dns_records[old_fqdn]
    
    mock_ip_allocations[ip_address]["fqdn"] = new_fqdn
    mock_dns_records[new_fqdn] = ip_address
    return {"status": "success", "message": f"FQDN for IP '{ip_address}' updated to '{new_fqdn}'."}

@app.get("/api/ipam/resolve", tags=["DNS"], summary="Mock DNS resolution for an FQDN")
async def resolve_fqdn(fqdn: str):
    if fqdn in mock_dns_records:
        return {"fqdn": fqdn, "ip_address": mock_dns_records[fqdn]}
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"FQDN '{fqdn}' not found in mock DNS records.")

@app.get("/api/ipam/subnet_info/{subnet_name}", tags=["IPAM"], summary="Get information about a subnet's IP pool")
async def get_subnet_info(subnet_name: str):
    if subnet_name not in KNOWN_SUBNETS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Subnet ID '{subnet_name}' not found or not managed.")
    return {
        "subnet_id": subnet_name,
        "network_address": str(KNOWN_SUBNETS[subnet_name].network_address),
        "netmask": str(KNOWN_SUBNETS[subnet_name].netmask),
        "total_managed_available": len(ip_pools[subnet_name]["available"]),
        "total_managed_used": len(ip_pools[subnet_name]["used"]),
        # "available_ips": list(ip_pools[subnet_name]["available"])[0:5], # Sample, don't list all
        # "used_ips": list(ip_pools[subnet_name]["used"])[0:5] # Sample
    }


# To run this mock service (save as main.py in mock_tcpwave directory):
# cd mock_tcpwave
# Ensure requirements.txt has fastapi, uvicorn, pydantic, ipaddress
# pip install -r requirements.txt
# uvicorn main:app --reload --port 8001

