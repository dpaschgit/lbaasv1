"""
API Gateway Design for Load Balancer Management

This document outlines the design for an API Gateway layer that will serve as the intermediary
between the LBaaS platform and the actual load balancer devices. This gateway will provide
centralized authentication, authorization, and auditing for all load balancer operations.
"""

import json
import uuid
import logging
import requests
from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from enum import Enum
from pydantic import BaseModel, Field

# API Gateway Models

class GatewayCredentialType(str, Enum):
    """Types of credentials supported by the API Gateway"""
    BASIC_AUTH = "basic_auth"
    API_KEY = "api_key"
    OAUTH2 = "oauth2"
    CERTIFICATE = "certificate"
    TOKEN = "token"


class GatewayCredential(BaseModel):
    """Model for credentials stored in the API Gateway vault"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique identifier")
    name: str = Field(..., description="Name of the credential")
    type: GatewayCredentialType = Field(..., description="Type of credential")
    description: Optional[str] = Field(default=None, description="Description of the credential")
    # The actual credential values are not included in the model
    # They are stored securely in the vault and referenced by ID
    created_at: datetime = Field(default_factory=datetime.now, description="Creation timestamp")
    updated_at: datetime = Field(default_factory=datetime.now, description="Last update timestamp")
    created_by: str = Field(..., description="User who created the credential")
    last_used: Optional[datetime] = Field(default=None, description="Last usage timestamp")


class GatewayRoute(BaseModel):
    """Model for API Gateway routing configuration"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique identifier")
    name: str = Field(..., description="Name of the route")
    description: Optional[str] = Field(default=None, description="Description of the route")
    lb_type: str = Field(..., description="Type of load balancer (NGINX, F5, AVI)")
    base_path: str = Field(..., description="Base path for the route")
    target_url: str = Field(..., description="Target URL for the route")
    credential_id: Optional[str] = Field(default=None, description="ID of the credential to use")
    rate_limit: Optional[int] = Field(default=None, description="Rate limit in requests per minute")
    timeout: int = Field(default=30, description="Timeout in seconds")
    retry_count: int = Field(default=3, description="Number of retries")
    circuit_breaker_enabled: bool = Field(default=True, description="Whether circuit breaker is enabled")
    created_at: datetime = Field(default_factory=datetime.now, description="Creation timestamp")
    updated_at: datetime = Field(default_factory=datetime.now, description="Last update timestamp")


class ApiGatewayConfig(BaseModel):
    """Configuration for the API Gateway"""
    gateway_url: str = Field(..., description="Base URL of the API Gateway")
    auth_enabled: bool = Field(default=True, description="Whether authentication is enabled")
    ssl_verification: bool = Field(default=True, description="Whether SSL verification is enabled")
    timeout: int = Field(default=30, description="Default timeout in seconds")
    retry_count: int = Field(default=3, description="Default number of retries")
    headers: Dict[str, str] = Field(default_factory=dict, description="Default headers")


class ApiGatewayClient:
    """Client for interacting with the API Gateway"""
    
    def __init__(self, config: ApiGatewayConfig):
        """
        Initialize the API Gateway client
        
        Args:
            config: API Gateway configuration
        """
        self.config = config
        self.logger = logging.getLogger(__name__)
    
    def send_request(self, 
                    method: str, 
                    path: str, 
                    lb_type: str,
                    data: Optional[Dict] = None, 
                    params: Optional[Dict] = None,
                    headers: Optional[Dict] = None,
                    credential_id: Optional[str] = None,
                    timeout: Optional[int] = None) -> Dict:
        """
        Send a request through the API Gateway
        
        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            path: API path
            lb_type: Type of load balancer (NGINX, F5, AVI)
            data: Request data
            params: Query parameters
            headers: Request headers
            credential_id: ID of the credential to use
            timeout: Request timeout in seconds
            
        Returns:
            Response data
        """
        # Construct the full URL
        url = f"{self.config.gateway_url}/{lb_type.lower()}/{path.lstrip('/')}"
        
        # Merge headers
        all_headers = self.config.headers.copy()
        if headers:
            all_headers.update(headers)
        
        # Add credential if provided
        if credential_id:
            all_headers["X-Credential-ID"] = credential_id
        
        # Set timeout
        request_timeout = timeout if timeout is not None else self.config.timeout
        
        # Log the request
        self.logger.info(f"Sending {method} request to {url}")
        
        try:
            # Send the request
            response = requests.request(
                method=method,
                url=url,
                json=data,
                params=params,
                headers=all_headers,
                timeout=request_timeout,
                verify=self.config.ssl_verification
            )
            
            # Check for errors
            response.raise_for_status()
            
            # Parse the response
            if response.content:
                return response.json()
            return {}
            
        except requests.exceptions.RequestException as e:
            self.logger.error(f"Error sending request to API Gateway: {str(e)}")
            raise


class LoadBalancerApiGateway:
    """API Gateway for load balancer operations"""
    
    def __init__(self, gateway_config: ApiGatewayConfig):
        """
        Initialize the load balancer API Gateway
        
        Args:
            gateway_config: API Gateway configuration
        """
        self.client = ApiGatewayClient(gateway_config)
        self.logger = logging.getLogger(__name__)
    
    def get_vips(self, lb_id: str, lb_type: str, credential_id: str) -> List[Dict]:
        """
        Get VIPs from a load balancer
        
        Args:
            lb_id: Load balancer ID
            lb_type: Load balancer type
            credential_id: Credential ID
            
        Returns:
            List of VIPs
        """
        return self.client.send_request(
            method="GET",
            path=f"loadbalancers/{lb_id}/vips",
            lb_type=lb_type,
            credential_id=credential_id
        )
    
    def get_vip(self, lb_id: str, vip_id: str, lb_type: str, credential_id: str) -> Dict:
        """
        Get a specific VIP from a load balancer
        
        Args:
            lb_id: Load balancer ID
            vip_id: VIP ID
            lb_type: Load balancer type
            credential_id: Credential ID
            
        Returns:
            VIP details
        """
        return self.client.send_request(
            method="GET",
            path=f"loadbalancers/{lb_id}/vips/{vip_id}",
            lb_type=lb_type,
            credential_id=credential_id
        )
    
    def create_vip(self, lb_id: str, vip_config: Dict, lb_type: str, credential_id: str) -> Dict:
        """
        Create a VIP on a load balancer
        
        Args:
            lb_id: Load balancer ID
            vip_config: VIP configuration
            lb_type: Load balancer type
            credential_id: Credential ID
            
        Returns:
            Created VIP details
        """
        return self.client.send_request(
            method="POST",
            path=f"loadbalancers/{lb_id}/vips",
            lb_type=lb_type,
            data=vip_config,
            credential_id=credential_id
        )
    
    def update_vip(self, lb_id: str, vip_id: str, vip_config: Dict, lb_type: str, credential_id: str) -> Dict:
        """
        Update a VIP on a load balancer
        
        Args:
            lb_id: Load balancer ID
            vip_id: VIP ID
            vip_config: VIP configuration
            lb_type: Load balancer type
            credential_id: Credential ID
            
        Returns:
            Updated VIP details
        """
        return self.client.send_request(
            method="PUT",
            path=f"loadbalancers/{lb_id}/vips/{vip_id}",
            lb_type=lb_type,
            data=vip_config,
            credential_id=credential_id
        )
    
    def delete_vip(self, lb_id: str, vip_id: str, lb_type: str, credential_id: str) -> Dict:
        """
        Delete a VIP from a load balancer
        
        Args:
            lb_id: Load balancer ID
            vip_id: VIP ID
            lb_type: Load balancer type
            credential_id: Credential ID
            
        Returns:
            Deletion result
        """
        return self.client.send_request(
            method="DELETE",
            path=f"loadbalancers/{lb_id}/vips/{vip_id}",
            lb_type=lb_type,
            credential_id=credential_id
        )
    
    def get_lb_status(self, lb_id: str, lb_type: str, credential_id: str) -> Dict:
        """
        Get load balancer status
        
        Args:
            lb_id: Load balancer ID
            lb_type: Load balancer type
            credential_id: Credential ID
            
        Returns:
            Load balancer status
        """
        return self.client.send_request(
            method="GET",
            path=f"loadbalancers/{lb_id}/status",
            lb_type=lb_type,
            credential_id=credential_id
        )
    
    def get_lb_metrics(self, lb_id: str, lb_type: str, credential_id: str, period: str = "hour") -> Dict:
        """
        Get load balancer metrics
        
        Args:
            lb_id: Load balancer ID
            lb_type: Load balancer type
            credential_id: Credential ID
            period: Time period (hour, day, week, month)
            
        Returns:
            Load balancer metrics
        """
        return self.client.send_request(
            method="GET",
            path=f"loadbalancers/{lb_id}/metrics",
            lb_type=lb_type,
            params={"period": period},
            credential_id=credential_id
        )


class ApiGatewayIntegration:
    """Integration between LBaaS and the API Gateway"""
    
    def __init__(self, gateway_config: ApiGatewayConfig):
        """
        Initialize the API Gateway integration
        
        Args:
            gateway_config: API Gateway configuration
        """
        self.gateway = LoadBalancerApiGateway(gateway_config)
        self.logger = logging.getLogger(__name__)
    
    def deploy_vip(self, lb_id: str, lb_type: str, credential_id: str, standard_config: Dict) -> Dict:
        """
        Deploy a VIP configuration through the API Gateway
        
        Args:
            lb_id: Load balancer ID
            lb_type: Load balancer type
            credential_id: Credential ID
            standard_config: Standardized VIP configuration
            
        Returns:
            Deployment result
        """
        try:
            # Extract VIP ID from standard config
            vip_id = standard_config.get("virtual_server", {}).get("id", "")
            
            # Check if VIP already exists
            try:
                existing_vip = self.gateway.get_vip(lb_id, vip_id, lb_type, credential_id)
                # VIP exists, update it
                self.logger.info(f"Updating existing VIP {vip_id} on load balancer {lb_id}")
                result = self.gateway.update_vip(lb_id, vip_id, standard_config, lb_type, credential_id)
                return {
                    "success": True,
                    "operation": "update",
                    "vip_id": vip_id,
                    "lb_id": lb_id,
                    "result": result
                }
            except requests.exceptions.HTTPError as e:
                if e.response.status_code == 404:
                    # VIP doesn't exist, create it
                    self.logger.info(f"Creating new VIP on load balancer {lb_id}")
                    result = self.gateway.create_vip(lb_id, standard_config, lb_type, credential_id)
                    return {
                        "success": True,
                        "operation": "create",
                        "vip_id": result.get("id", vip_id),
                        "lb_id": lb_id,
                        "result": result
                    }
                else:
                    # Other error
                    raise
        
        except Exception as e:
            self.logger.error(f"Error deploying VIP to load balancer {lb_id}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "lb_id": lb_id,
                "vip_id": vip_id if 'vip_id' in locals() else None
            }
    
    def delete_vip(self, lb_id: str, vip_id: str, lb_type: str, credential_id: str) -> Dict:
        """
        Delete a VIP through the API Gateway
        
        Args:
            lb_id: Load balancer ID
            vip_id: VIP ID
            lb_type: Load balancer type
            credential_id: Credential ID
            
        Returns:
            Deletion result
        """
        try:
            self.logger.info(f"Deleting VIP {vip_id} from load balancer {lb_id}")
            result = self.gateway.delete_vip(lb_id, vip_id, lb_type, credential_id)
            return {
                "success": True,
                "operation": "delete",
                "vip_id": vip_id,
                "lb_id": lb_id,
                "result": result
            }
        except Exception as e:
            self.logger.error(f"Error deleting VIP {vip_id} from load balancer {lb_id}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "lb_id": lb_id,
                "vip_id": vip_id
            }
    
    def get_lb_health(self, lb_id: str, lb_type: str, credential_id: str) -> Dict:
        """
        Get load balancer health through the API Gateway
        
        Args:
            lb_id: Load balancer ID
            lb_type: Load balancer type
            credential_id: Credential ID
            
        Returns:
            Load balancer health
        """
        try:
            status = self.gateway.get_lb_status(lb_id, lb_type, credential_id)
            metrics = self.gateway.get_lb_metrics(lb_id, lb_type, credential_id, period="hour")
            
            return {
                "success": True,
                "lb_id": lb_id,
                "status": status,
                "metrics": metrics,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            self.logger.error(f"Error getting health for load balancer {lb_id}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "lb_id": lb_id
            }


# Example usage
if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(level=logging.INFO)
    
    # Create API Gateway configuration
    gateway_config = ApiGatewayConfig(
        gateway_url="https://api-gateway.example.com",
        auth_enabled=True,
        ssl_verification=True,
        timeout=30,
        retry_count=3,
        headers={
            "User-Agent": "LBaaS/1.0",
            "Content-Type": "application/json"
        }
    )
    
    # Create API Gateway integration
    integration = ApiGatewayIntegration(gateway_config)
    
    # Example: Deploy a VIP
    standard_config = {
        "metadata": {
            "schema_version": "1.0",
            "lb_type": "F5",
            "environment": "PROD",
            "datacenter": "LADC",
            "created_by": "LBaaS",
            "description": "Load balancer configuration for app.example.com"
        },
        "virtual_server": {
            "id": "vs-app-example-com",
            "name": "vs-app.example.com",
            "ip_address": "192.168.1.100",
            "port": 443,
            "protocol": "https",
            "pool_id": "pool-app-example-com",
            "ssl": {
                "enabled": True,
                "certificate_id": "cert-app-example-com",
                "protocols": ["TLSv1.2", "TLSv1.3"]
            },
            "enabled": True
        },
        "pools": [
            {
                "id": "pool-app-example-com",
                "name": "pool-app.example.com",
                "members": [
                    {
                        "id": "server-1",
                        "name": "server1.example.com",
                        "ip_address": "192.168.1.101",
                        "port": 8443,
                        "weight": 1,
                        "enabled": True
                    },
                    {
                        "id": "server-2",
                        "name": "server2.example.com",
                        "ip_address": "192.168.1.102",
                        "port": 8443,
                        "weight": 2,
                        "enabled": True
                    }
                ],
                "algorithm": "round_robin"
            }
        ]
    }
    
    # Deploy the VIP
    result = integration.deploy_vip(
        lb_id="f5-prod-01",
        lb_type="F5",
        credential_id="123e4567-e89b-12d3-a456-426614174000",
        standard_config=standard_config
    )
    
    print(json.dumps(result, indent=2))
