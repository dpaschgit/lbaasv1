"""
F5 Load Balancer Translator Module

This module implements a translator for F5 load balancer configurations.
It inherits from the base translator class and implements F5-specific
translation and deployment logic.
"""

import os
import json
from typing import Dict, List, Optional, Any

from lb_translator_base import LBTranslatorBase
from common_lb_schema import LBProtocol, LBAlgorithm, PersistenceType, ClientAuthType


class F5Translator(LBTranslatorBase):
    """Translator for F5 load balancer"""
    
    def _generate_vendor_config(self, metadata: Dict, virtual_server: Dict, 
                               pools: List[Dict], certificates: List[Dict]) -> str:
        """
        Generate F5-specific configuration in JSON format
        
        Args:
            metadata: Metadata section from standardized config
            virtual_server: Virtual server section from standardized config
            pools: Pools section from standardized config
            certificates: Certificates section from standardized config
            
        Returns:
            F5 configuration as JSON string
        """
        # Get the pool referenced by the virtual server
        pool = self._get_pool_by_id(pools, virtual_server.get('pool_id', ''))
        if not pool:
            raise ValueError(f"Pool with ID {virtual_server.get('pool_id')} not found")
        
        # Get SSL configuration
        ssl = virtual_server.get('ssl', {})
        ssl_enabled = ssl.get('enabled', False)
        
        # Get mTLS configuration
        mtls = virtual_server.get('mtls', {})
        mtls_enabled = mtls.get('enabled', False)
        
        # Create pool members from standardized config
        pool_members = []
        for member in pool.get('members', []):
            f5_member = {
                "name": member.get('name', member.get('ip_address')),
                "address": member.get('ip_address'),
                "port": member.get('port', 80),
                "weight": member.get('weight', 1),
                "monitor": "http",
                "state": "enabled" if member.get('enabled', True) else "disabled"
            }
            
            # Add connection limit if specified
            conn_limit = member.get('connection_limit', 0)
            if conn_limit > 0:
                f5_member["connectionLimit"] = conn_limit
            
            # Add priority group if backup
            if member.get('backup', False):
                f5_member["priorityGroup"] = 1
            
            pool_members.append(f5_member)
        
        # Translate load balancing algorithm
        algorithm = pool.get('algorithm', LBAlgorithm.ROUND_ROBIN.value)
        f5_algorithm = "round-robin"
        if algorithm == LBAlgorithm.LEAST_CONNECTIONS.value:
            f5_algorithm = "least-connections-member"
        elif algorithm == LBAlgorithm.FASTEST_RESPONSE.value:
            f5_algorithm = "fastest-app-response"
        elif algorithm == LBAlgorithm.WEIGHTED_ROUND_ROBIN.value:
            f5_algorithm = "weighted-round-robin"
        elif algorithm == LBAlgorithm.IP_HASH.value:
            f5_algorithm = "ip-hash"
        
        # Create pool configuration
        pool_name = pool.get('name', 'pool').replace('-', '_')
        f5_pool = {
            "name": pool_name,
            "members": pool_members,
            "monitor": {
                "type": pool.get('monitor', {}).get('type', 'http'),
                "send": f"GET {pool.get('monitor', {}).get('http_path', '/')} HTTP/1.1\\r\\nHost: \\r\\nConnection: close\\r\\n\\r\\n",
                "recv": pool.get('monitor', {}).get('expected_text', ''),
                "interval": pool.get('monitor', {}).get('interval', 5),
                "timeout": pool.get('monitor', {}).get('timeout', 16),
                "retries": pool.get('monitor', {}).get('retries', 3)
            },
            "load_balancing_mode": f5_algorithm
        }
        
        # Add persistence configuration if needed
        persistence = pool.get('persistence', {})
        persistence_type = persistence.get('type', PersistenceType.NONE.value)
        
        if persistence_type != PersistenceType.NONE.value:
            f5_persistence = {
                "type": self._translate_persistence_type(persistence_type),
                "cookie_name": persistence.get('cookie_name', 'SERVERID') if persistence_type in [PersistenceType.COOKIE.value, PersistenceType.APP_COOKIE.value] else None,
                "timeout": persistence.get('timeout', 3600)
            }
            f5_pool["persistence"] = f5_persistence
        
        # Create profiles list based on protocol and SSL settings
        profiles = ["http", "tcp"]
        
        # Add SSL profile if enabled
        if ssl_enabled:
            profiles.append("clientssl")
            
            # Add server SSL profile if mTLS is enabled
            if mtls_enabled:
                profiles.append("serverssl")
        
        # Create virtual server configuration
        vs_name = virtual_server.get('name', 'vs').replace('-', '_')
        f5_virtual_server = {
            "name": vs_name,
            "destination": f"{virtual_server.get('ip_address')}:{virtual_server.get('port', 80)}",
            "pool": pool_name,
            "profiles": profiles,
            "source_address_translation": {"type": "automap"},
            "translate_address": True,
            "translate_port": True
        }
        
        # Add connection limits if specified
        conn_limit = virtual_server.get('connection_limit', 0)
        if conn_limit > 0:
            f5_virtual_server["connection_limit"] = conn_limit
        
        conn_rate_limit = virtual_server.get('connection_rate_limit', 0)
        if conn_rate_limit > 0:
            f5_virtual_server["rate_limit"] = conn_rate_limit
        
        # Create SSL configuration if enabled
        if ssl_enabled:
            cert_id = ssl.get('certificate_id', '')
            cert = self._get_certificate_by_id(certificates, cert_id)
            
            if cert:
                cert_name = cert.get('name', 'server').replace('-', '_')
                f5_ssl = {
                    "name": f"ssl_{cert_name}",
                    "cert": f"/config/ssl/ssl.crt/{cert_name}.crt",
                    "key": f"/config/ssl/ssl.key/{cert_name}.key",
                    "ciphers": ssl.get('ciphers', 'DEFAULT'),
                    "protocols": ssl.get('protocols', ['TLSv1.2', 'TLSv1.3'])
                }
                
                # Add mTLS configuration if enabled
                if mtls_enabled:
                    client_auth_type = mtls.get('client_auth_type', ClientAuthType.NONE.value)
                    
                    if client_auth_type != ClientAuthType.NONE.value:
                        ca_cert_id = mtls.get('client_ca_cert_id', '')
                        ca_cert = self._get_certificate_by_id(certificates, ca_cert_id)
                        
                        if ca_cert:
                            ca_cert_name = ca_cert.get('name', 'ca').replace('-', '_')
                            f5_ssl["client_auth"] = client_auth_type
                            f5_ssl["ca_file"] = f"/config/ssl/ssl.crt/{ca_cert_name}.crt"
                            f5_ssl["verify_depth"] = mtls.get('verify_depth', 1)
                            
                            # Add CRL if enabled
                            if mtls.get('crl_enabled', False):
                                f5_ssl["crl_file"] = f"/config/ssl/ssl.crl/{ca_cert_name}.crl"
                
                f5_virtual_server["ssl"] = f5_ssl
        
        # Create HTTP settings if needed
        http_settings = virtual_server.get('http', {})
        if http_settings:
            f5_http = {}
            
            # Add X-Forwarded-For header insertion
            if http_settings.get('x_forwarded_for', True):
                f5_http["insert_xforwarded_for"] = True
            
            # Add HTTPS redirect if enabled
            if http_settings.get('redirect_http_to_https', False):
                f5_http["redirect_http_to_https"] = True
            
            # Add HSTS if enabled
            if ssl_enabled and http_settings.get('hsts_enabled', False):
                f5_http["hsts_enabled"] = True
                f5_http["hsts_max_age"] = http_settings.get('hsts_max_age', 31536000)
                f5_http["hsts_include_subdomains"] = http_settings.get('hsts_include_subdomains', False)
                f5_http["hsts_preload"] = http_settings.get('hsts_preload', False)
            
            f5_virtual_server["http"] = f5_http
        
        # Create complete F5 configuration
        f5_config = {
            "class": "ADC",
            "schemaVersion": "3.0.0",
            "id": f"LBaaS_{metadata.get('environment')}_{metadata.get('datacenter')}",
            "label": f"LBaaS configuration for {virtual_server.get('name', '')}",
            "remark": f"Generated by {metadata.get('created_by', 'LBaaS')} for {metadata.get('environment')} in {metadata.get('datacenter')}",
            "controls": {
                "class": "Controls",
                "trace": True,
                "logLevel": "debug"
            },
            "pools": [f5_pool],
            "virtualServers": [f5_virtual_server]
        }
        
        # Return the configuration as a JSON string
        return json.dumps(f5_config, indent=2)
    
    def _translate_persistence_type(self, persistence_type: str) -> str:
        """
        Translate standardized persistence type to F5-specific type
        
        Args:
            persistence_type: Standardized persistence type
            
        Returns:
            F5-specific persistence type
        """
        persistence_map = {
            PersistenceType.SOURCE_IP.value: "source_addr",
            PersistenceType.COOKIE.value: "cookie",
            PersistenceType.APP_COOKIE.value: "app_cookie",
            PersistenceType.HTTP_HEADER.value: "hash",
            PersistenceType.TLS_SESSION_ID.value: "ssl",
            PersistenceType.CUSTOM.value: "universal"
        }
        
        return persistence_map.get(persistence_type, "none")
    
    def _deploy_vendor_config(self, standard_config: Dict, config_path: str) -> Dict:
        """
        Deploy F5 configuration (write to file for now)
        
        Args:
            standard_config: Standardized configuration dictionary
            config_path: Path to the generated configuration file
            
        Returns:
            Dictionary with deployment results
        """
        try:
            # In a real implementation, this would use the F5 API to deploy the configuration
            # For now, we'll just return success with the file path
            
            return {
                'success': True,
                'config_path': config_path,
                'message': f"F5 configuration generated and saved to {config_path}"
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Exception during F5 configuration generation: {str(e)}"
            }
    
    def _get_file_extension(self) -> str:
        """
        Get the file extension for F5 configuration
        
        Returns:
            File extension string
        """
        return "json"
