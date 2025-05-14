from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone # Ensure timezone is imported
from bson import ObjectId # Added for potential direct use or validation

# Pydantic V2 uses model_validator for root validators if needed.
# Pydantic V2 uses field_validator for field-specific validators.

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, field_info):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, core_schema, handler):
        # Pydantic V2 schema generation
        from pydantic_core import core_schema as cs
        return cs.str_schema()

class Monitor(BaseModel):
    type: str = Field(..., example="ECV", description="Type of health monitor (e.g., HTTP, TCP, ICMP, ECV).")
    port: int = Field(..., example=8080, description="Port to use for the health monitor.")
    send: Optional[str] = Field(None, example="GET /health HTTP/1.1", description="String to send for active health checks (e.g., HTTP GET request).")
    receive: Optional[str] = Field(None, example="200 OK", description="Expected string to receive for successful health checks.")

class Persistence(BaseModel):
    type: str = Field(..., example="source_ip", description="Type of session persistence (e.g., source_ip, cookie).")
    timeout: int = Field(..., example=300, description="Timeout for persistence record in seconds.")

class PoolMember(BaseModel):
    ip: str = Field(..., example="10.0.0.1", description="IP address of the backend server.")
    port: int = Field(..., example=8080, description="Port of the backend server.")

class VipBase(BaseModel):
    vip_fqdn: str = Field(..., example="vip123.davelab.net", description="Fully Qualified Domain Name of the VIP.")
    vip_ip: Optional[str] = Field(None, example="1.1.1.100", description="IP address of the VIP. Can be auto-assigned by IPAM.")
    app_id: str = Field(..., example="111111", description="Application identifier associated with this VIP.")
    environment: str = Field(..., example="Prod", description="Deployment environment (e.g., Dev, UAT, Prod).")
    datacenter: str = Field(..., example="LADC", description="Datacenter where the VIP is provisioned.")
    primary_contact_email: EmailStr = Field(..., example="user@example.com", description="Primary contact email for the VIP.")
    secondary_contact_email: Optional[EmailStr] = Field(None, example="alt@example.com", description="Secondary contact email.")
    team_distribution_email: Optional[EmailStr] = Field(None, example="team@example.com", description="Team distribution list email.")
    monitor: Monitor
    persistence: Optional[Persistence] = None
    ssl_cert_name: Optional[str] = Field(None, example="mycert.example.com", description="Name/reference to the SSL certificate for VIP termination.")
    mtls_ca_cert_name: Optional[str] = Field(None, example="my-client-ca.pem", description="Name/reference to the CA certificate for mTLS client certificate validation.")
    pool: List[PoolMember]
    owner: str = Field(..., example="user1", description="Owner or creator of the VIP configuration.")
    port: int = Field(..., example=443, description="Listening port for the VIP.")
    protocol: str = Field(..., example="HTTPS", description="Protocol for the VIP (e.g., TCP, HTTP, HTTPS).")
    lb_method: Optional[str] = Field("ROUND_ROBIN", example="ROUND_ROBIN", description="Load balancing method.")

class VipCreate(VipBase):
    pass

class VipUpdate(BaseModel):
    vip_fqdn: Optional[str] = Field(None, example="vip123.davelab.net")
    vip_ip: Optional[str] = Field(None, example="1.1.1.100")
    app_id: Optional[str] = Field(None, example="111111")
    environment: Optional[str] = Field(None, example="Prod")
    datacenter: Optional[str] = Field(None, example="LADC")
    primary_contact_email: Optional[EmailStr] = Field(None, example="user@example.com")
    secondary_contact_email: Optional[EmailStr] = Field(None, example="alt@example.com")
    team_distribution_email: Optional[EmailStr] = Field(None, example="team@example.com")
    monitor: Optional[Monitor] = None
    persistence: Optional[Persistence] = None
    ssl_cert_name: Optional[str] = Field(None, example="mycert.example.com")
    mtls_ca_cert_name: Optional[str] = Field(None, example="my-client-ca.pem")
    pool: Optional[List[PoolMember]] = None
    owner: Optional[str] = Field(None, example="user1") # Owner might not be updatable directly by user, but by system/admin
    port: Optional[int] = Field(None, example=443)
    protocol: Optional[str] = Field(None, example="HTTPS")
    lb_method: Optional[str] = Field(None, example="LEAST_CONNECTIONS")

# Correctly defining VipDB for database interaction
class VipDB(VipBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        populate_by_name = True # Allows using alias _id for id field
        from_attributes = True  # Pydantic V2 for ORM mode / from_orm
        json_encoders = {
            ObjectId: str,
            datetime: lambda dt: dt.isoformat() # Ensure datetime is serialized to ISO string
        }
        # For Pydantic V2, arbitrary_types_allowed is True by default if needed for ObjectId
        # but PyObjectId handles custom validation and serialization.

# VipResponse can be an alias or a specific response model if different from VipDB
# For now, let's assume API responses can use VipDB structure directly or a simplified one.
# If VipResponse was intended to be different, it should be defined accordingly.
# The previous VipResponse definition is removed to avoid confusion with VipDB, 
# as main.py uses VipDB for response_model in GET operations.
# If a different response structure is needed, it can be added back as VipResponse.

