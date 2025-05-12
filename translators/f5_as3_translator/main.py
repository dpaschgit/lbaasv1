# main.py for F5 AS3 Translator Service

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field, EmailStr # Re-using or adapting models from the main API
from typing import List, Optional, Dict, Any

# It might be beneficial to have a shared library for common Pydantic models (like VipBase)
# For now, let's redefine a simplified version or assume it can be imported if structured as a monorepo/shared lib.

# --- Pydantic Models (Simplified for translator input, should match VipBase from main API ideally) ---
# Assuming the main backend API will send data conforming to its VipBase or a similar structure.
# For this translator, we only need the fields relevant to F5 AS3 configuration.

class Monitor(BaseModel):
    type: str = Field(..., example="http") # AS3 uses http, https, tcp, icmp, etc.
    port: int = Field(..., example=8080)
    send: Optional[str] = Field(None, example="GET /health HTTP/1.1")
    receive: Optional[str] = Field(None, example="200 OK")
    interval: Optional[int] = Field(5, example=5) # AS3 default
    timeout: Optional[int] = Field(16, example=16) # AS3 default

class PoolMember(BaseModel):
    ip: str = Field(..., example="10.0.0.1")
    port: int = Field(..., example=8080)
    # connectionLimit: Optional[int] = None
    # priorityGroup: Optional[int] = None

class VipInput(BaseModel):
    vip_fqdn: str = Field(..., example="vip123.davelab.net")
    vip_ip: str = Field(..., example="1.1.1.100")
    port: int = Field(..., example=443)
    protocol: str = Field(..., example="HTTPS") # TCP, HTTP, HTTPS
    pool_members: List[PoolMember]
    monitor: Monitor
    lb_method: Optional[str] = Field("round-robin", example="round-robin") # AS3: round-robin, least-connections-member, etc.
    persistence_method: Optional[str] = Field(None, example="source-address") # AS3: source-address, cookie, etc.
    ssl_cert_name: Optional[str] = Field(None, example="/Common/my_cert_bundle") # Name of cert on F5 or AS3 reference
    # mtls_ca_cert_name: Optional[str] = Field(None, example="/Common/my_client_ca_bundle")
    app_id: str # Used for naming conventions, e.g., Tenant name
    environment: str # Used for naming conventions

app = FastAPI(
    title="F5 AS3 Translator Service",
    description="Translates abstract VIP definitions into F5 AS3 JSON declarations.",
    version="0.1.0"
)

@app.get("/health", tags=["Health"], summary="Health check for F5 AS3 Translator service")
async def health_check():
    return {"status": "healthy", "service": "F5 AS3 Translator"}

@app.post("/translate/f5/deploy", tags=["F5 AS3 Translation"], summary="Generate F5 AS3 JSON for VIP deployment/update")
async def translate_to_f5_as3(vip_input: VipInput) -> Dict[str, Any]:
    """
    Accepts VIP configuration data and generates an F5 AS3 JSON declaration.
    This is a simplified example and would need to be much more robust for production use,
    covering various AS3 features, profiles, and error handling.
    """
    try:
        tenant_name = f"{vip_input.app_id}_{vip_input.environment}".replace("-", "_").replace(".", "_") # AS3 compliant tenant name
        app_name = vip_input.vip_fqdn.split(".")[0].replace("-", "_") # Simplified app name from FQDN

        as3_declaration = {
            "class": "AS3",
            "action": "deploy",
            "persist": True,
            "declaration": {
                "class": "ADC",
                "schemaVersion": "3.0.0", # Or newer, ensure compatibility
                "id": f"urn:uuid:{uuid.uuid4()}",
                "label": f"Declaration for {vip_input.vip_fqdn}",
                tenant_name: {
                    "class": "Tenant",
                    app_name: {
                        "class": "Application",
                        # Service (Virtual Server)
                        f"service_{vip_input.protocol.lower()}": {
                            "class": f"Service_{vip_input.protocol.upper()}", # Service_HTTP, Service_HTTPS, Service_TCP, Service_L4
                            "virtualAddresses": [
                                vip_input.vip_ip
                            ],
                            "virtualPort": vip_input.port,
                            "pool": f"pool_{app_name}",
                            # Add persistence profile if specified
                            # Add SSL profiles if HTTPS
                        },
                        # Pool
                        f"pool_{app_name}": {
                            "class": "Pool",
                            "members": [],
                            "monitors": [
                                {"bigip": f"/Common/{app_name}_monitor"} # Assuming monitor is in /Common or tenant
                            ],
                            "loadBalancingMode": vip_input.lb_method
                        },
                        # Monitor
                        f"{app_name}_monitor": {
                            "class": "Monitor",
                            "monitorType": vip_input.monitor.type.lower(),
                            "interval": vip_input.monitor.interval,
                            "timeout": vip_input.monitor.timeout,
                            "send": vip_input.monitor.send if vip_input.monitor.send else "",
                            "receive": vip_input.monitor.receive if vip_input.monitor.receive else ""
                            # Target port for monitor might be needed if different from pool member port
                        }
                    }
                }
            }
        }

        # Populate pool members
        for member in vip_input.pool_members:
            as3_declaration["declaration"][tenant_name][app_name][f"pool_{app_name}"]["members"].append({
                "servicePort": member.port,
                "serverAddresses": [member.ip]
            })
        
        # Add persistence profile if specified
        if vip_input.persistence_method:
            as3_declaration["declaration"][tenant_name][app_name][f"service_{vip_input.protocol.lower()}"]["persistenceMethods"] = [
                {"bigip": f"/Common/{vip_input.persistence_method}"} # Assuming standard persistence profiles
            ]

        # Add SSL Client Profile if HTTPS and cert name is provided
        if vip_input.protocol.upper() == "HTTPS" and vip_input.ssl_cert_name:
            as3_declaration["declaration"][tenant_name][app_name][f"service_{vip_input.protocol.lower()}"]["serverTLS"] = {
                "bigip": vip_input.ssl_cert_name # e.g., /Common/clientssl_profile_name or a full cert object
            }
            # If mtls_ca_cert_name is provided, configure clientTLS (mTLS)
            # This requires a client SSL profile with client auth settings.

        return as3_declaration

    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error generating F5 AS3 JSON: {str(e)}")

# To run this mock service (save as main.py in f5_as3_translator directory):
# cd f5_as3_translator
# pip install -r requirements.txt
# uvicorn main:app --reload --port 8003 # Or a different port for this translator

