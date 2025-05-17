"""
Common Load Balancer Schema Module

This module defines a standardized JSON schema for all load balancer translators.
It provides a common interface between the placement logic and various load balancer handlers,
making it easier to add support for new load balancer vendors in the future.
"""

import json
from typing import Dict, List, Optional, Any, Union
from enum import Enum


class LBProtocol(str, Enum):
    """Supported load balancer protocols"""
    HTTP = "http"
    HTTPS = "https"
    TCP = "tcp"
    UDP = "udp"


class LBAlgorithm(str, Enum):
    """Standardized load balancing algorithms"""
    ROUND_ROBIN = "round_robin"
    LEAST_CONNECTIONS = "least_connections"
    IP_HASH = "ip_hash"
    LEAST_REQUESTS = "least_requests"
    WEIGHTED_ROUND_ROBIN = "weighted_round_robin"
    FASTEST_RESPONSE = "fastest_response"


class HealthMonitorType(str, Enum):
    """Health monitor types"""
    HTTP = "http"
    HTTPS = "https"
    TCP = "tcp"
    UDP = "udp"
    ICMP = "icmp"


class PersistenceType(str, Enum):
    """Session persistence types"""
    NONE = "none"
    SOURCE_IP = "source_ip"
    COOKIE = "cookie"
    APP_COOKIE = "app_cookie"
    HTTP_HEADER = "http_header"
    TLS_SESSION_ID = "tls_session_id"
    CUSTOM = "custom"


class CertificateType(str, Enum):
    """Certificate types"""
    SELF_SIGNED = "self_signed"
    IMPORTED = "imported"
    MANAGED = "managed"
    LETS_ENCRYPT = "lets_encrypt"


class ClientAuthType(str, Enum):
    """Client authentication types for mTLS"""
    NONE = "none"
    OPTIONAL = "optional"
    REQUIRED = "required"


class CommonLBSchema:
    """
    Common Load Balancer Schema class for standardizing load balancer configurations
    across different vendors and implementations.
    """
    
    @staticmethod
    def create_standard_config(vip_config: Dict, servers: List[Dict], placement_decision: Dict) -> Dict:
        """
        Create a standardized load balancer configuration that can be translated
        to vendor-specific formats.
        
        Args:
            vip_config: VIP configuration dictionary
            servers: List of server dictionaries
            placement_decision: Placement decision dictionary
            
        Returns:
            Standardized configuration dictionary
        """
        # Extract VIP details
        vip_fqdn = vip_config.get('vip_fqdn', '')
        vip_ip = vip_config.get('vip_ip', '')
        port = vip_config.get('port', 80)
        protocol = vip_config.get('protocol', 'HTTP').lower()
        environment = vip_config.get('environment', '')
        datacenter = vip_config.get('datacenter', '')
        lb_method = vip_config.get('lb_method', 'round_robin')
        
        # Extract advanced configuration options
        persistence_type = vip_config.get('persistence_type', 'none')
        persistence_cookie_name = vip_config.get('persistence_cookie_name', 'SERVERID')
        persistence_timeout = vip_config.get('persistence_timeout', 3600)
        
        # mTLS configuration
        mtls_enabled = vip_config.get('mtls_enabled', False)
        client_auth_type = vip_config.get('client_auth_type', 'none')
        client_ca_cert = vip_config.get('client_ca_cert', '')
        
        # Standardize protocol
        std_protocol = protocol
        if protocol.lower() in [p.value for p in LBProtocol]:
            std_protocol = protocol.lower()
        else:
            std_protocol = LBProtocol.HTTP.value
        
        # Standardize load balancing algorithm
        std_algorithm = lb_method
        if lb_method in [a.value for a in LBAlgorithm]:
            std_algorithm = lb_method
        elif lb_method == 'round-robin':
            std_algorithm = LBAlgorithm.ROUND_ROBIN.value
        elif lb_method == 'least_conn':
            std_algorithm = LBAlgorithm.LEAST_CONNECTIONS.value
        
        # Standardize persistence type
        std_persistence_type = persistence_type
        if persistence_type in [p.value for p in PersistenceType]:
            std_persistence_type = persistence_type
        else:
            std_persistence_type = PersistenceType.NONE.value
        
        # Standardize client auth type for mTLS
        std_client_auth_type = client_auth_type
        if client_auth_type in [a.value for a in ClientAuthType]:
            std_client_auth_type = client_auth_type
        else:
            std_client_auth_type = ClientAuthType.NONE.value
        
        # Create pool members
        pool_members = []
        for server in servers:
            member = {
                "id": server.get('id', f"server-{len(pool_members) + 1}"),
                "name": server.get('fqdn', server.get('ip', '')),
                "ip_address": server.get('ip', ''),
                "port": server.get('server_port', 80),
                "weight": server.get('weight', 1),
                "enabled": True,
                "monitor": HealthMonitorType.HTTP.value,
                "backup": server.get('backup', False),
                "max_connections": server.get('max_connections', 0),
                "connection_limit": server.get('connection_limit', 0)
            }
            pool_members.append(member)
        
        # Create persistence configuration
        persistence_config = {
            "type": std_persistence_type,
            "timeout": persistence_timeout
        }
        
        # Add cookie-specific configuration if using cookie persistence
        if std_persistence_type in [PersistenceType.COOKIE.value, PersistenceType.APP_COOKIE.value]:
            persistence_config.update({
                "cookie_name": persistence_cookie_name,
                "cookie_mode": vip_config.get('cookie_mode', 'insert'),
                "cookie_path": vip_config.get('cookie_path', '/'),
                "cookie_attributes": vip_config.get('cookie_attributes', '')
            })
        # Add header-specific configuration if using header persistence
        elif std_persistence_type == PersistenceType.HTTP_HEADER.value:
            persistence_config.update({
                "header_name": vip_config.get('persistence_header_name', 'X-Persistence')
            })
        
        # Create pool configuration
        pool = {
            "id": f"pool-{vip_fqdn.replace('.', '-')}",
            "name": f"pool-{vip_fqdn}",
            "members": pool_members,
            "algorithm": std_algorithm,
            "monitor": {
                "type": HealthMonitorType.HTTP.value,
                "interval": vip_config.get('monitor_interval', 5),
                "timeout": vip_config.get('monitor_timeout', 15),
                "retries": vip_config.get('monitor_retries', 3),
                "http_method": vip_config.get('monitor_http_method', 'GET'),
                "http_path": vip_config.get('monitor_http_path', '/'),
                "http_version": vip_config.get('monitor_http_version', '1.1'),
                "expected_codes": vip_config.get('monitor_expected_codes', '200'),
                "expected_text": vip_config.get('monitor_expected_text', '')
            },
            "persistence": persistence_config,
            "connection_limit": vip_config.get('pool_connection_limit', 0),
            "service_down_action": vip_config.get('service_down_action', 'none')
        }
        
        # Create SSL configuration
        ssl_config = {
            "enabled": std_protocol == LBProtocol.HTTPS.value,
            "certificate_id": f"cert-{vip_fqdn.replace('.', '-')}",
            "protocols": vip_config.get('ssl_protocols', ['TLSv1.2', 'TLSv1.3']),
            "ciphers": vip_config.get('ssl_ciphers', ''),
            "prefer_server_ciphers": vip_config.get('prefer_server_ciphers', True),
            "session_cache": vip_config.get('ssl_session_cache', True),
            "session_timeout": vip_config.get('ssl_session_timeout', 300)
        }
        
        # Create mTLS configuration
        client_ca_cert_id = ""
        if mtls_enabled:
            client_ca_cert_id = f"ca-cert-{vip_fqdn.replace('.', '-')}"
            
        mtls_config = {
            "enabled": mtls_enabled,
            "client_auth_type": std_client_auth_type,
            "client_ca_cert_id": client_ca_cert_id,
            "verify_depth": vip_config.get('mtls_verify_depth', 1),
            "crl_enabled": vip_config.get('mtls_crl_enabled', False),
            "ocsp_enabled": vip_config.get('mtls_ocsp_enabled', False)
        }
        
        # Create virtual server configuration
        virtual_server = {
            "id": f"vs-{vip_fqdn.replace('.', '-')}",
            "name": f"vs-{vip_fqdn}",
            "ip_address": vip_ip,
            "port": port,
            "protocol": std_protocol,
            "pool_id": pool["id"],
            "ssl": ssl_config,
            "mtls": mtls_config,
            "enabled": True,
            "connection_limit": vip_config.get('vs_connection_limit', 0),
            "connection_rate_limit": vip_config.get('vs_connection_rate_limit', 0),
            "http": {
                "x_forwarded_for": vip_config.get('x_forwarded_for', True),
                "x_forwarded_proto": vip_config.get('x_forwarded_proto', True),
                "redirect_http_to_https": vip_config.get('redirect_http_to_https', False),
                "hsts_enabled": vip_config.get('hsts_enabled', False),
                "hsts_max_age": vip_config.get('hsts_max_age', 31536000),
                "hsts_include_subdomains": vip_config.get('hsts_include_subdomains', False),
                "hsts_preload": vip_config.get('hsts_preload', False)
            }
        }
        
        # Create certificates list
        certificates = []
        
        # Add server certificate if SSL is enabled
        if ssl_config["enabled"]:
            certificates.append({
                "id": ssl_config["certificate_id"],
                "name": f"cert-{vip_fqdn}",
                "type": vip_config.get('cert_type', CertificateType.SELF_SIGNED.value),
                "common_name": vip_fqdn,
                "sans": vip_config.get('cert_sans', [vip_fqdn]),
                "key_type": vip_config.get('cert_key_type', 'RSA'),
                "key_size": vip_config.get('cert_key_size', 2048)
            })
        
        # Add client CA certificate if mTLS is enabled
        if mtls_enabled:
            # Always add a placeholder CA certificate if mTLS is enabled, even if content is not provided
            certificates.append({
                "id": client_ca_cert_id,
                "name": f"ca-cert-{vip_fqdn}",
                "type": CertificateType.IMPORTED.value,
                "content": client_ca_cert if client_ca_cert else "# Placeholder for CA certificate"
            })
        
        # Create complete standardized configuration
        config = {
            "metadata": {
                "schema_version": "1.0",
                "lb_type": placement_decision.get("lb_type", ""),
                "environment": environment,
                "datacenter": datacenter,
                "created_by": "LBaaS",
                "description": f"Load balancer configuration for {vip_fqdn}"
            },
            "virtual_server": virtual_server,
            "pools": [pool],
            "certificates": certificates,
            "policies": []
        }
        
        return config
    
    @staticmethod
    def to_json(config: Dict) -> str:
        """
        Convert standardized configuration to JSON string
        
        Args:
            config: Standardized configuration dictionary
            
        Returns:
            JSON string representation
        """
        return json.dumps(config, indent=2)
    
    @staticmethod
    def from_json(json_str: str) -> Dict:
        """
        Parse JSON string into standardized configuration
        
        Args:
            json_str: JSON string representation
            
        Returns:
            Standardized configuration dictionary
        """
        return json.loads(json_str)


# Example usage
if __name__ == "__main__":
    # Example VIP configuration with advanced features
    vip_config = {
        "vip_fqdn": "app.example.com",
        "vip_ip": "192.168.1.100",
        "port": 443,
        "protocol": "HTTPS",
        "environment": "PROD",
        "datacenter": "LADC",
        "lb_method": "round_robin",
        # Persistence configuration
        "persistence_type": "cookie",
        "persistence_cookie_name": "JSESSIONID",
        "persistence_timeout": 3600,
        "cookie_mode": "rewrite",
        # mTLS configuration
        "mtls_enabled": True,
        "client_auth_type": "required",
        "client_ca_cert": "-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----",
        "mtls_verify_depth": 2,
        # SSL configuration
        "ssl_protocols": ["TLSv1.2", "TLSv1.3"],
        "ssl_ciphers": "ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256",
        # HTTP settings
        "redirect_http_to_https": True,
        "hsts_enabled": True
    }
    
    # Example servers
    servers = [
        {
            "fqdn": "server1.example.com",
            "ip": "192.168.1.101",
            "server_port": 8443,
            "weight": 1
        },
        {
            "fqdn": "server2.example.com",
            "ip": "192.168.1.102",
            "server_port": 8443,
            "weight": 2,
            "backup": True
        }
    ]
    
    # Example placement decision
    placement_decision = {
        "lb_type": "F5",
        "environment": "PROD",
        "datacenter": "LADC"
    }
    
    # Create standardized configuration
    schema = CommonLBSchema()
    config = schema.create_standard_config(vip_config, servers, placement_decision)
    
    # Convert to JSON
    json_str = schema.to_json(config)
    print("Standardized Load Balancer Configuration with mTLS and Persistence:")
    print(json_str)
