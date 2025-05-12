# main.py for Nginx Translator Service

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

# --- Pydantic Models (Simplified for translator input) ---
class PoolMember(BaseModel):
    ip: str = Field(..., example="10.0.0.1")
    port: int = Field(..., example=8080)
    # weight: Optional[int] = Field(1, example="weight=1") # Nginx specific weight if needed

class Monitor(BaseModel):
    type: str = Field(..., example="TCP") # TCP, HTTP
    port: int = Field(..., example=8080)
    # Nginx health checks are often part of Nginx Plus or handled externally/by upstream block
    # For open-source Nginx, basic TCP check or HTTP check (if L7) is implied by proxy_pass
    # More advanced health checks might involve `health_check` directive in upstream (Nginx Plus)
    # or custom Lua scripting.
    # For this mock, we'll assume basic proxy_pass success implies health for open-source.
    # If Nginx Plus is assumed, `health_check` directive parameters would go here.
    interval: Optional[int] = Field(5, example=5)
    timeout: Optional[int] = Field(2, example=2)
    # For Nginx Plus health_check directive:
    # fails: Optional[int] = Field(3, example=3)
    # passes: Optional[int] = Field(2, example=2)
    # uri: Optional[str] = Field(None, example="/health") # for http health_check

class Persistence(BaseModel):
    type: str = Field(..., example="SOURCE_IP") # SOURCE_IP (ip_hash), COOKIE
    ttl: Optional[int] = Field(None, example=300) # Not directly a TTL for ip_hash, but concept exists for sticky cookies
    cookie_name: Optional[str] = Field(None, example="nginx_sticky_cookie")

class VipInput(BaseModel):
    vip_fqdn: str = Field(..., example="vip123.davelab.net")
    # vip_ip: str # Nginx typically listens on all IPs or specific ones defined in listen directive
    port: int = Field(..., example=80)
    protocol: str = Field(..., example="HTTP") # HTTP, HTTPS (TCP/UDP for stream block)
    is_l4: bool = Field(False, example=False) # True for TCP/UDP (stream block), False for HTTP/HTTPS (http block)
    pool_members: List[PoolMember]
    monitor: Monitor # Basic info, actual Nginx health check setup varies
    persistence: Optional[Persistence] = None
    lb_method: Optional[str] = Field("round_robin", example="round_robin") # round_robin (default), least_conn, ip_hash
    ssl_cert_path: Optional[str] = Field(None, example="/etc/nginx/ssl/vip123.davelab.net.crt") # Path on Nginx server
    ssl_key_path: Optional[str] = Field(None, example="/etc/nginx/ssl/vip123.davelab.net.key")  # Path on Nginx server
    app_id: str
    environment: str

app = FastAPI(
    title="Nginx Translator Service",
    description="Translates abstract VIP definitions into Nginx configuration blocks.",
    version="0.1.0"
)

@app.get("/health", tags=["Health"], summary="Health check for Nginx Translator service")
async def health_check():
    return {"status": "healthy", "service": "Nginx Translator"}

@app.post("/translate/nginx/deploy", tags=["Nginx Translation"], summary="Generate Nginx configuration for VIP deployment/update")
async def translate_to_nginx(vip_input: VipInput) -> Dict[str, Any]:
    """
    Accepts VIP configuration data and generates an Nginx configuration block string.
    This is a simplified example.
    """
    try:
        config_lines = []
        upstream_name = f"backend_{vip_input.app_id}_{vip_input.environment}_{vip_input.port}".replace("-", "_")

        # --- Upstream Block --- 
        config_lines.append(f"upstream {upstream_name} {{")
        if vip_input.lb_method == "least_conn":
            config_lines.append(f"    least_conn;")
        elif vip_input.lb_method == "ip_hash" or (vip_input.persistence and vip_input.persistence.type == "SOURCE_IP"):
            config_lines.append(f"    ip_hash;")
        # round_robin is default, no directive needed unless other params like `fair` (commercial) are used.
        
        for member in vip_input.pool_members:
            # Nginx Plus health_check directive would be configured here if applicable
            # For open-source, basic proxy_pass success is the check.
            # Member-specific monitor port for Nginx Plus health_check: member.monitor.alternate_port
            config_lines.append(f"    server {member.ip}:{member.port};")
        
        # Nginx Plus sticky cookie persistence
        if vip_input.persistence and vip_input.persistence.type == "COOKIE" and not vip_input.is_l4:
            cookie_name = vip_input.persistence.cookie_name or "nginx_sticky_session"
            expires = f" expires={vip_input.persistence.ttl}s" if vip_input.persistence.ttl else ""
            # Basic sticky cookie, more options available in Nginx Plus
            config_lines.append(f"    sticky cookie {cookie_name}{expires} httponly;") 

        config_lines.append(f"}}")
        config_lines.append("") # Newline for readability

        # --- Server Block (HTTP/HTTPS) or Stream Block (TCP/UDP) ---
        if vip_input.is_l4: # TCP/UDP Load Balancing (Stream module)
            config_lines.append(f"# Add to Nginx stream block or include this file in stream context")
            config_lines.append(f"server {{")
            config_lines.append(f"    listen {vip_input.port} {vip_input.protocol.lower() if vip_input.protocol.lower() == 'udp' else ''};")
            # SSL for stream (Nginx 1.9.0+)
            if vip_input.protocol.upper() == "TCPS" or (vip_input.protocol.upper() == "TCP" and vip_input.ssl_cert_path):
                config_lines.append(f"    ssl_certificate {vip_input.ssl_cert_path};")
                config_lines.append(f"    ssl_certificate_key {vip_input.ssl_key_path};")
                config_lines.append(f"    # Add other ssl_protocols, ssl_ciphers as needed")
            config_lines.append(f"    proxy_pass {upstream_name};")
            # Health checks for stream in Nginx Plus: health_check match=... port=... interval=...;
            # For open source, proxy_connect_timeout, proxy_timeout can be set.
            config_lines.append(f"    # proxy_connect_timeout {vip_input.monitor.timeout if vip_input.monitor else 2}s;")
            config_lines.append(f"}}")
        else: # HTTP/HTTPS Load Balancing (HTTP module)
            config_lines.append(f"# Add to Nginx http block or include this file in http context (e.g., in sites-available/)")
            config_lines.append(f"server {{")
            if vip_input.protocol.upper() == "HTTPS":
                config_lines.append(f"    listen {vip_input.port} ssl http2;") # Assuming HTTP/2 for SSL
                config_lines.append(f"    listen [::]:{vip_input.port} ssl http2;")
                config_lines.append(f"    ssl_certificate {vip_input.ssl_cert_path};")
                config_lines.append(f"    ssl_certificate_key {vip_input.ssl_key_path};")
                config_lines.append(f"    # Add other ssl_protocols, ssl_ciphers, HSTS headers as needed")
            else: # HTTP
                config_lines.append(f"    listen {vip_input.port};")
                config_lines.append(f"    listen [::]:{vip_input.port};")
            
            config_lines.append(f"    server_name {vip_input.vip_fqdn};")
            config_lines.append("")
            config_lines.append(f"    location / {{")
            config_lines.append(f"        proxy_pass http://{upstream_name}; # Assuming upstream is HTTP for L7 LB")
            config_lines.append(f"        proxy_set_header Host $host;")
            config_lines.append(f"        proxy_set_header X-Real-IP $remote_addr;")
            config_lines.append(f"        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;")
            config_lines.append(f"        proxy_set_header X-Forwarded-Proto $scheme;")
            config_lines.append(f"        # proxy_connect_timeout {vip_input.monitor.timeout if vip_input.monitor else 2}s;")
            config_lines.append(f"        # proxy_send_timeout 60s;")
            config_lines.append(f"        # proxy_read_timeout 60s;")
            config_lines.append(f"    }}")
            config_lines.append(f"}}")

        nginx_config_block = "\n".join(config_lines)
        return {"nginx_config": nginx_config_block}

    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error generating Nginx config: {str(e)}")

# To run this service:
# cd nginx_translator
# pip install -r requirements.txt
# uvicorn main:app --reload --port 8005

