# main.py for AVI Translator Service

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid

# --- Pydantic Models (Simplified for translator input) ---
class PoolMemberMonitor(BaseModel):
    """Monitor settings for a specific pool member, allowing alternate port."""
    use_alternate_port: bool = Field(False, description="Whether to use an alternate port for monitoring")
    alternate_port: Optional[int] = Field(None, description="Alternate port for monitoring if different from service port")

class PoolMember(BaseModel):
    ip: str = Field(..., example="10.0.0.1", description="IP address of the backend server")
    port: int = Field(..., example=8080, description="Port of the backend server")
    monitor: Optional[PoolMemberMonitor] = Field(None, description="Optional member-specific monitoring settings")
    # weight: Optional[int] = Field(1, example=1, description="Weight for load balancing")
    # enabled: Optional[bool] = Field(True, description="Whether this pool member is enabled")

class Monitor(BaseModel):
    type: str = Field(..., example="TCP", description="Type of health monitor (TCP, HTTP, HTTPS, UDP)")
    port: int = Field(..., example=8080, description="Default port to use for health monitoring")
    send: Optional[str] = Field(None, example="GET /health HTTP/1.1\\r\\nHost: example.com\\r\\n\\r\\n", 
                               description="String to send for active health checks (e.g., HTTP request)")
    receive: Optional[str] = Field(None, example="200 OK", 
                                 description="Expected string to receive for successful health checks")
    interval: Optional[int] = Field(5, example=5, description="Interval between health checks in seconds")
    timeout: Optional[int] = Field(16, example=16, description="Timeout for health checks in seconds")
    successful_checks: Optional[int] = Field(2, example=2, description="Number of successful checks before marking up")
    failed_checks: Optional[int] = Field(3, example=3, description="Number of failed checks before marking down")

class Persistence(BaseModel):
    type: str = Field(..., example="SOURCE_IP", 
                     description="Type of persistence (SOURCE_IP, COOKIE, APP_COOKIE, etc.)")
    ttl: int = Field(300, example=300, description="Time to live for persistence in seconds")
    cookie_name: Optional[str] = Field(None, example="JSESSIONID", 
                                     description="Cookie name for cookie-based persistence")

class VipInput(BaseModel):
    vip_fqdn: str = Field(..., example="vip123.davelab.net", description="Fully Qualified Domain Name of the VIP")
    vip_ip: str = Field(..., example="1.1.1.100", description="IP address of the VIP")
    port: int = Field(..., example=443, description="Listening port for the VIP")
    protocol: str = Field(..., example="HTTPS", description="Protocol for the VIP (TCP, UDP, HTTP, HTTPS)")
    is_l4: bool = Field(False, example=False, description="Whether this is an L4 VIP (true) or L7 VIP (false)")
    pool_members: List[PoolMember] = Field(..., description="List of backend servers in the pool")
    monitor: Monitor = Field(..., description="Health monitoring configuration")
    persistence: Optional[Persistence] = Field(None, description="Session persistence configuration")
    lb_method: str = Field("ROUND_ROBIN", example="ROUND_ROBIN", 
                          description="Load balancing algorithm (ROUND_ROBIN, LEAST_CONNECTIONS, etc.)")
    ssl_cert_name: Optional[str] = Field(None, example="my_cert", 
                                       description="Name of SSL certificate for HTTPS VIPs")
    app_id: str = Field(..., example="app123", description="Application identifier")
    environment: str = Field(..., example="Prod", description="Deployment environment")

app = FastAPI(
    title="AVI Translator Service",
    description="Translates abstract VIP definitions into AVI API configuration.",
    version="0.1.0"
)

@app.get("/health", tags=["Health"], summary="Health check for AVI Translator service")
async def health_check():
    return {"status": "healthy", "service": "AVI Translator"}

@app.post("/translate/avi/deploy", tags=["AVI Translation"], summary="Generate AVI API configuration for VIP deployment/update")
async def translate_to_avi(vip_input: VipInput) -> Dict[str, Any]:
    """
    Accepts VIP configuration data and generates AVI API configuration.
    This is a simplified example that would need to be expanded for production use.
    """
    try:
        # Generate a unique name for AVI objects based on input
        name_prefix = f"{vip_input.app_id}-{vip_input.environment}-{vip_input.port}"
        
        # Determine application profile based on protocol and L4/L7 setting
        app_profile_type = "APPLICATION_PROFILE_TYPE_L4" if vip_input.is_l4 else "APPLICATION_PROFILE_TYPE_HTTP"
        if vip_input.protocol in ["HTTPS", "HTTP"] and not vip_input.is_l4:
            app_profile_type = "APPLICATION_PROFILE_TYPE_HTTP"
        elif vip_input.protocol == "TCP" or vip_input.is_l4:
            app_profile_type = "APPLICATION_PROFILE_TYPE_L4"
        
        # Build AVI configuration
        avi_config = {
            # Virtual Service configuration
            "virtual_service": {
                "name": f"vs-{name_prefix}",
                "enabled": True,
                "services": [
                    {
                        "port": vip_input.port,
                        "enable_ssl": vip_input.protocol == "HTTPS"
                    }
                ],
                "vip": [
                    {
                        "ip_address": {
                            "addr": vip_input.vip_ip,
                            "type": "V4"
                        },
                        "fqdn": vip_input.vip_fqdn
                    }
                ],
                "application_profile_ref": f"/api/applicationprofile?name={app_profile_type}",
                "pool_ref": f"/api/pool?name=pool-{name_prefix}"
            },
            
            # Pool configuration
            "pool": {
                "name": f"pool-{name_prefix}",
                "lb_algorithm": vip_input.lb_method,
                "servers": [],
                "health_monitor_refs": [
                    f"/api/healthmonitor?name=hm-{name_prefix}"
                ]
            },
            
            # Health Monitor configuration
            "health_monitor": {
                "name": f"hm-{name_prefix}",
                "type": vip_input.monitor.type,
                "monitor_port": vip_input.monitor.port,
                "send_interval": vip_input.monitor.interval,
                "receive_timeout": vip_input.monitor.timeout,
                "successful_checks": vip_input.monitor.successful_checks,
                "failed_checks": vip_input.monitor.failed_checks
            }
        }
        
        # Add pool members
        for i, member in enumerate(vip_input.pool_members):
            server_config = {
                "ip": {
                    "addr": member.ip,
                    "type": "V4"
                },
                "port": member.port,
                "enabled": True
            }
            
            # Add member-specific monitoring if configured
            if member.monitor and member.monitor.use_alternate_port:
                server_config["health_monitor_port"] = member.monitor.alternate_port
                
            avi_config["pool"]["servers"].append(server_config)
        
        # Add persistence if configured
        if vip_input.persistence:
            persistence_config = {
                "name": f"persist-{name_prefix}",
                "persistence_timeout": vip_input.persistence.ttl
            }
            
            if vip_input.persistence.type == "SOURCE_IP":
                persistence_config["type"] = "PERSISTENCE_TYPE_CLIENT_IP_ADDRESS"
            elif vip_input.persistence.type == "COOKIE" and not vip_input.is_l4:
                persistence_config["type"] = "PERSISTENCE_TYPE_HTTP_COOKIE"
            elif vip_input.persistence.type == "APP_COOKIE" and not vip_input.is_l4:
                persistence_config["type"] = "PERSISTENCE_TYPE_APP_COOKIE"
                if vip_input.persistence.cookie_name:
                    persistence_config["cookie_name"] = vip_input.persistence.cookie_name
            
            avi_config["application_persistence_profile"] = persistence_config
            avi_config["virtual_service"]["application_persistence_profile_ref"] = f"/api/applicationpersistenceprofile?name=persist-{name_prefix}"
        
        # Add SSL certificate reference if HTTPS
        if vip_input.protocol == "HTTPS" and vip_input.ssl_cert_name:
            avi_config["virtual_service"]["ssl_key_and_certificate_refs"] = [
                f"/api/sslkeyandcertificate?name={vip_input.ssl_cert_name}"
            ]
        
        # Add monitor send/receive for HTTP/HTTPS monitors
        if vip_input.monitor.type in ["HTTP", "HTTPS"] and vip_input.monitor.send:
            avi_config["health_monitor"]["http_request"] = vip_input.monitor.send
            if vip_input.monitor.receive:
                avi_config["health_monitor"]["http_response_code"] = [
                    {"code": "HTTP_2XX"} # Default to 2XX, could be more specific based on receive
                ]
        
        return avi_config

    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
                           detail=f"Error generating AVI configuration: {str(e)}")

# To run this service:
# cd avi_translator
# pip install -r requirements.txt
# uvicorn main:app --reload --port 8004
