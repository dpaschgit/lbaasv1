"""
AVI Load Balancer Translator Module

This module implements a translator for AVI (VMware NSX Advanced Load Balancer) configurations.
It inherits from the base translator class and implements AVI-specific
translation and deployment logic.
"""

import os
import json
from typing import Dict, List, Optional, Any

from lb_translator_base import LBTranslatorBase
from common_lb_schema import LBProtocol, LBAlgorithm, PersistenceType, ClientAuthType


class AviTranslator(LBTranslatorBase):
    """Translator for AVI load balancer"""
    
    def _generate_vendor_config(self, metadata: Dict, virtual_server: Dict, 
                               pools: List[Dict], certificates: List[Dict]) -> str:
        """
        Generate AVI-specific configuration in JSON format
        
        Args:
            metadata: Metadata section from standardized config
            virtual_server: Virtual server section from standardized config
            pools: Pools section from standardized config
            certificates: Certificates section from standardized config
            
        Returns:
            AVI configuration as JSON string
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
        
        # Create pool servers from standardized config
        pool_servers = []
        for member in pool.get('members', []):
            server_config = {
                "ip": {
                    "addr": member.get('ip_address'),
                    "type": "V4"
                },
                "port": member.get('port', 80),
                "hostname": member.get('name', ''),
                "ratio": member.get('weight', 1),
                "enabled": member.get('enabled', True)
            }
            
            # Add connection limit if specified
            conn_limit = member.get('connection_limit', 0)
            if conn_limit > 0:
                server_config["connection_limit"] = conn_limit
            
            pool_servers.append(server_config)
        
        # Translate load balancing algorithm
        algorithm = pool.get('algorithm', LBAlgorithm.ROUND_ROBIN.value)
        avi_algorithm = self._translate_lb_algorithm(algorithm)
        
        # Create health monitor configuration
        monitor = pool.get('monitor', {})
        health_monitor = {
            "type": monitor.get('type', 'HTTP'),
            "http_monitor": {
                "http_method": monitor.get('http_method', 'GET'),
                "http_request": monitor.get('http_path', '/'),
                "http_response_code": [
                    {"code": code.strip()} for code in monitor.get('expected_codes', '200').split(',')
                ]
            },
            "monitor_port": monitor.get('port', 0),
            "receive_timeout": monitor.get('timeout', 15),
            "failed_checks": monitor.get('retries', 3),
            "send_interval": monitor.get('interval', 5)
        }
        
        # Create persistence configuration
        persistence_profile = None
        persistence = pool.get('persistence', {})
        persistence_type = persistence.get('type', PersistenceType.NONE.value)
        
        if persistence_type != PersistenceType.NONE.value:
            persistence_profile = {
                "type": self._translate_persistence_type(persistence_type)
            }
            
            # Add cookie settings for cookie persistence
            if persistence_type in [PersistenceType.COOKIE.value, PersistenceType.APP_COOKIE.value]:
                persistence_profile["cookie_name"] = persistence.get('cookie_name', 'SERVERID')
                persistence_profile["timeout"] = persistence.get('timeout', 3600)
            
            # Add header name for HTTP header persistence
            elif persistence_type == PersistenceType.HTTP_HEADER.value:
                persistence_profile["http_header_name"] = persistence.get('header_name', 'X-Persistence')
        
        # Create pool configuration
        avi_pool = {
            "name": pool.get('name', 'pool'),
            "servers": pool_servers,
            "lb_algorithm": avi_algorithm,
            "health_monitor_refs": ["/api/healthmonitor?name=System-HTTP"],
            "health_monitor": health_monitor,
            "enabled": True
        }
        
        # Add persistence if configured
        if persistence_profile:
            avi_pool["persistence_profile"] = persistence_profile
        
        # Create SSL configuration if enabled
        ssl_profile = None
        if ssl_enabled:
            cert_id = ssl.get('certificate_id', '')
            cert = self._get_certificate_by_id(certificates, cert_id)
            
            if cert:
                cert_name = cert.get('name', 'server')
                ssl_profile = {
                    "name": f"ssl-{cert_name}",
                    "certificate_refs": [f"/api/sslkeyandcertificate?name={cert_name}"],
                    "ssl_profile_ref": "/api/sslprofile?name=System-Standard",
                    "enabled": True,
                    "accepted_versions": []
                }
                
                # Add SSL protocols
                protocols = ssl.get('protocols', ['TLSv1.2', 'TLSv1.3'])
                for protocol in protocols:
                    if protocol == 'TLSv1.2':
                        ssl_profile["accepted_versions"].append({"type": "SSL_VERSION_TLS1_2"})
                    elif protocol == 'TLSv1.3':
                        ssl_profile["accepted_versions"].append({"type": "SSL_VERSION_TLS1_3"})
                
                # Add SSL ciphers if specified
                ciphers = ssl.get('ciphers', '')
                if ciphers:
                    ssl_profile["cipher_suites"] = ciphers
                
                # Add mTLS configuration if enabled
                if mtls_enabled:
                    client_auth_type = mtls.get('client_auth_type', ClientAuthType.NONE.value)
                    
                    if client_auth_type != ClientAuthType.NONE.value:
                        ca_cert_id = mtls.get('client_ca_cert_id', '')
                        ca_cert = self._get_certificate_by_id(certificates, ca_cert_id)
                        
                        if ca_cert:
                            ca_cert_name = ca_cert.get('name', 'ca')
                            ssl_profile["client_auth"] = True
                            ssl_profile["ca_certs"] = [f"/api/sslkeyandcertificate?name={ca_cert_name}"]
                            
                            # Set validation type based on client auth type
                            if client_auth_type == ClientAuthType.REQUIRED.value:
                                ssl_profile["client_auth_require"] = True
                            else:
                                ssl_profile["client_auth_require"] = False
                            
                            # Add validation depth
                            ssl_profile["validate_depth"] = mtls.get('verify_depth', 1)
        
        # Create HTTP application profile
        http_profile = {
            "name": f"http-{virtual_server.get('name', 'vs')}",
            "type": "APPLICATION_PROFILE_TYPE_HTTP",
            "http_profile": {
                "x_forwarded_proto_enabled": virtual_server.get('http', {}).get('x_forwarded_proto', True),
                "x_forwarded_for_enabled": virtual_server.get('http', {}).get('x_forwarded_for', True)
            }
        }
        
        # Add HSTS if enabled
        http_settings = virtual_server.get('http', {})
        if ssl_enabled and http_settings.get('hsts_enabled', False):
            http_profile["http_profile"]["hsts_enabled"] = True
            http_profile["http_profile"]["hsts_max_age"] = http_settings.get('hsts_max_age', 31536000)
            
            if http_settings.get('hsts_include_subdomains', False):
                http_profile["http_profile"]["hsts_subdomains_enabled"] = True
            
            if http_settings.get('hsts_preload', False):
                http_profile["http_profile"]["hsts_preload_enabled"] = True
        
        # Create virtual service configuration
        vs_name = virtual_server.get('name', 'vs')
        avi_virtual_service = {
            "name": vs_name,
            "enabled": virtual_server.get('enabled', True),
            "services": [
                {
                    "port": virtual_server.get('port', 80),
                    "enable_ssl": ssl_enabled
                }
            ],
            "vip": [
                {
                    "ip_address": {
                        "addr": virtual_server.get('ip_address'),
                        "type": "V4"
                    },
                    "enabled": True
                }
            ],
            "pool_ref": f"/api/pool?name={pool.get('name', 'pool')}",
            "application_profile_ref": f"/api/applicationprofile?name={http_profile['name']}",
            "network_profile_ref": "/api/networkprofile?name=System-TCP-Proxy"
        }
        
        # Add SSL profile if configured
        if ssl_profile:
            avi_virtual_service["ssl_profile_ref"] = f"/api/sslprofile?name={ssl_profile['name']}"
            avi_virtual_service["ssl_key_and_certificate_refs"] = ssl_profile["certificate_refs"]
        
        # Add connection limits if specified
        conn_limit = virtual_server.get('connection_limit', 0)
        if conn_limit > 0:
            avi_virtual_service["connection_limit"] = conn_limit
        
        # Add HTTP redirect policy if enabled
        if http_settings.get('redirect_http_to_https', False):
            avi_virtual_service["http_policies"] = [
                {
                    "name": f"redirect-{vs_name}",
                    "http_request_policy": {
                        "rules": [
                            {
                                "name": "redirect-http-to-https",
                                "redirect_action": {
                                    "protocol": "HTTPS",
                                    "port": 443,
                                    "status_code": "HTTP_REDIRECT_STATUS_CODE_302"
                                }
                            }
                        ]
                    }
                }
            ]
        
        # Create complete AVI configuration
        avi_config = {
            "pools": [avi_pool],
            "virtual_services": [avi_virtual_service],
            "application_profiles": [http_profile],
            "tenant": metadata.get('environment', 'admin'),
            "version": "20.1.1",
            "description": f"Generated by {metadata.get('created_by', 'LBaaS')} for {metadata.get('environment')} in {metadata.get('datacenter')}"
        }
        
        # Add SSL profiles if configured
        if ssl_profile:
            avi_config["ssl_profiles"] = [ssl_profile]
        
        # Return the configuration as a JSON string
        return json.dumps(avi_config, indent=2)
    
    def _translate_lb_algorithm(self, algorithm: str) -> str:
        """
        Translate standardized load balancing algorithm to AVI-specific algorithm
        
        Args:
            algorithm: Standardized load balancing algorithm
            
        Returns:
            AVI-specific load balancing algorithm
        """
        algorithm_map = {
            LBAlgorithm.ROUND_ROBIN.value: "LB_ALGORITHM_ROUND_ROBIN",
            LBAlgorithm.LEAST_CONNECTIONS.value: "LB_ALGORITHM_LEAST_CONNECTIONS",
            LBAlgorithm.IP_HASH.value: "LB_ALGORITHM_CONSISTENT_HASH",
            LBAlgorithm.LEAST_REQUESTS.value: "LB_ALGORITHM_FEWEST_SERVERS",
            LBAlgorithm.FASTEST_RESPONSE.value: "LB_ALGORITHM_FASTEST_RESPONSE",
            LBAlgorithm.WEIGHTED_ROUND_ROBIN.value: "LB_ALGORITHM_ROUND_ROBIN"
        }
        
        return algorithm_map.get(algorithm, "LB_ALGORITHM_ROUND_ROBIN")
    
    def _translate_persistence_type(self, persistence_type: str) -> str:
        """
        Translate standardized persistence type to AVI-specific type
        
        Args:
            persistence_type: Standardized persistence type
            
        Returns:
            AVI-specific persistence type
        """
        persistence_map = {
            PersistenceType.SOURCE_IP.value: "PERSISTENCE_TYPE_CLIENT_IP_ADDRESS",
            PersistenceType.COOKIE.value: "PERSISTENCE_TYPE_HTTP_COOKIE",
            PersistenceType.APP_COOKIE.value: "PERSISTENCE_TYPE_APP_COOKIE",
            PersistenceType.HTTP_HEADER.value: "PERSISTENCE_TYPE_CUSTOM_HTTP_HEADER",
            PersistenceType.TLS_SESSION_ID.value: "PERSISTENCE_TYPE_TLS",
            PersistenceType.CUSTOM.value: "PERSISTENCE_TYPE_CUSTOM_SERVER"
        }
        
        return persistence_map.get(persistence_type, "PERSISTENCE_TYPE_NONE")
    
    def _deploy_vendor_config(self, standard_config: Dict, config_path: str) -> Dict:
        """
        Deploy AVI configuration (write to file for now)
        
        Args:
            standard_config: Standardized configuration dictionary
            config_path: Path to the generated configuration file
            
        Returns:
            Dictionary with deployment results
        """
        try:
            # In a real implementation, this would use the AVI API to deploy the configuration
            # For now, we'll just return success with the file path
            
            # Generate configuration
            vendor_config = self.translate_config(standard_config)
            
            # Write configuration to file
            with open(config_path, 'w') as f:
                f.write(vendor_config)
            
            return {
                'success': True,
                'config_path': config_path,  # Ensure config_path is always included
                'message': f"AVI configuration generated and saved to {config_path}"
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Exception during AVI configuration generation: {str(e)}",
                'config_path': config_path  # Include config_path even on error
            }
    
    def _get_file_extension(self) -> str:
        """
        Get the file extension for AVI configuration
        
        Returns:
            File extension string
        """
        return "json"
