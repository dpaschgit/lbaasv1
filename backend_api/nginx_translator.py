"""
NGINX Load Balancer Translator Module

This module implements a translator for NGINX load balancer configurations.
It inherits from the base translator class and implements NGINX-specific
translation and deployment logic.
"""

import os
import subprocess
from typing import Dict, List, Optional, Any

from lb_translator_base import LBTranslatorBase
from common_lb_schema import LBProtocol, LBAlgorithm, PersistenceType


class NginxTranslator(LBTranslatorBase):
    """Translator for NGINX load balancer"""
    
    def _generate_vendor_config(self, metadata: Dict, virtual_server: Dict, 
                               pools: List[Dict], certificates: List[Dict]) -> str:
        """
        Generate NGINX-specific configuration
        
        Args:
            metadata: Metadata section from standardized config
            virtual_server: Virtual server section from standardized config
            pools: Pools section from standardized config
            certificates: Certificates section from standardized config
            
        Returns:
            NGINX configuration as string
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
        
        # Start building the configuration
        config_lines = [
            f"# NGINX Load Balancer Configuration for {virtual_server.get('name', '')}",
            f"# Environment: {metadata.get('environment', '')}",
            f"# Datacenter: {metadata.get('datacenter', '')}",
            f"# Generated by: {metadata.get('created_by', 'LBaaS')}",
            ""
        ]
        
        # Add events block
        config_lines.extend([
            "events {",
            "    worker_connections 1024;",
            "}",
            ""
        ])
        
        # Start http block
        config_lines.append("http {")
        
        # Add MIME types
        config_lines.extend([
            "    include       /etc/nginx/mime.types;",
            "    default_type  application/octet-stream;",
            ""
        ])
        
        # Add logging configuration
        config_lines.extend([
            "    log_format  main  '$remote_addr - $remote_user [$time_local] \"$request\" '",
            "                      '$status $body_bytes_sent \"$http_referer\" '",
            "                      '\"$http_user_agent\" \"$http_x_forwarded_for\"';",
            "",
            "    access_log  /var/log/nginx/access.log  main;",
            ""
        ])
        
        # Add general settings
        config_lines.extend([
            "    sendfile        on;",
            "    keepalive_timeout  65;",
            ""
        ])
        
        # Add upstream block for backend servers
        config_lines.append(f"    upstream {pool.get('name', 'backend')} {{")
        
        # Add load balancing method
        algorithm = pool.get('algorithm', LBAlgorithm.ROUND_ROBIN.value)
        if algorithm == LBAlgorithm.LEAST_CONNECTIONS.value:
            config_lines.append("        least_conn;")
        elif algorithm == LBAlgorithm.IP_HASH.value:
            config_lines.append("        ip_hash;")
        else:
            # Default is round robin, which doesn't need a directive
            config_lines.append("        # Using default round robin")
        
        # Add persistence configuration if needed
        persistence = pool.get('persistence', {})
        persistence_type = persistence.get('type', PersistenceType.NONE.value)
        
        if persistence_type == PersistenceType.COOKIE.value:
            cookie_name = persistence.get('cookie_name', 'SERVERID')
            cookie_path = persistence.get('cookie_path', '/')
            config_lines.append(f"        # Cookie-based persistence")
            config_lines.append(f"        sticky cookie {cookie_name} expires={persistence.get('timeout', 3600)}s path={cookie_path};")
        
        # Add backend servers
        for member in pool.get('members', []):
            server_line = f"        server {member.get('ip_address')}:{member.get('port')} weight={member.get('weight', 1)}"
            
            # Add backup flag if server is a backup
            if member.get('backup', False):
                server_line += " backup"
            
            # Add max connections if specified
            max_conns = member.get('max_connections', 0)
            if max_conns > 0:
                server_line += f" max_conns={max_conns}"
            
            config_lines.append(f"{server_line};")
        
        # Close upstream block
        config_lines.append("    }")
        config_lines.append("")
        
        # Add server block
        config_lines.append("    server {")
        
        # Add listen directive with SSL if enabled
        port = virtual_server.get('port', 80)
        if ssl_enabled:
            config_lines.append(f"        listen {port} ssl;")
            
            # Add SSL certificate paths
            cert_id = ssl.get('certificate_id', '')
            cert = self._get_certificate_by_id(certificates, cert_id)
            if cert:
                cert_name = cert.get('name', 'server')
                config_lines.append(f"        ssl_certificate     /etc/nginx/ssl/{cert_name}.crt;")
                config_lines.append(f"        ssl_certificate_key /etc/nginx/ssl/{cert_name}.key;")
            
            # Add SSL protocols
            protocols = ssl.get('protocols', ['TLSv1.2', 'TLSv1.3'])
            config_lines.append(f"        ssl_protocols {' '.join(protocols)};")
            
            # Add SSL ciphers if specified
            ciphers = ssl.get('ciphers', '')
            if ciphers:
                config_lines.append(f"        ssl_ciphers {ciphers};")
                if ssl.get('prefer_server_ciphers', True):
                    config_lines.append("        ssl_prefer_server_ciphers on;")
            
            # Add SSL session cache settings
            if ssl.get('session_cache', True):
                config_lines.append("        ssl_session_cache shared:SSL:10m;")
                config_lines.append(f"        ssl_session_timeout {ssl.get('session_timeout', 300)}m;")
            
            # Add mTLS configuration if enabled
            if mtls_enabled:
                client_auth_type = mtls.get('client_auth_type', 'none')
                if client_auth_type == 'required':
                    config_lines.append("        ssl_verify_client on;")
                elif client_auth_type == 'optional':
                    config_lines.append("        ssl_verify_client optional;")
                
                # Add client CA certificate
                ca_cert_id = mtls.get('client_ca_cert_id', '')
                ca_cert = self._get_certificate_by_id(certificates, ca_cert_id)
                if ca_cert:
                    ca_cert_name = ca_cert.get('name', 'ca')
                    config_lines.append(f"        ssl_client_certificate /etc/nginx/ssl/{ca_cert_name}.crt;")
                
                # Add verify depth
                verify_depth = mtls.get('verify_depth', 1)
                config_lines.append(f"        ssl_verify_depth {verify_depth};")
                
                # Add CRL if enabled
                if mtls.get('crl_enabled', False):
                    config_lines.append(f"        ssl_crl /etc/nginx/ssl/crl.pem;")
        else:
            config_lines.append(f"        listen {port};")
        
        # Add server name
        config_lines.append(f"        server_name {virtual_server.get('name', '').replace('vs-', '')};")
        
        # Add HTTP settings
        http_settings = virtual_server.get('http', {})
        
        # Add HTTPS redirect if enabled
        if http_settings.get('redirect_http_to_https', False) and not ssl_enabled:
            config_lines.append("        return 301 https://$host$request_uri;")
        else:
            # Add location block
            config_lines.append("")
            config_lines.append("        location / {")
            config_lines.append(f"            proxy_pass http://{pool.get('name', 'backend')};")
            
            # Add proxy headers
            if http_settings.get('x_forwarded_for', True):
                config_lines.append("            proxy_set_header X-Real-IP $remote_addr;")
                config_lines.append("            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;")
            
            if http_settings.get('x_forwarded_proto', True):
                config_lines.append("            proxy_set_header X-Forwarded-Proto $scheme;")
            
            config_lines.append("            proxy_set_header Host $host;")
            
            # Add connection limits if specified
            conn_limit = virtual_server.get('connection_limit', 0)
            if conn_limit > 0:
                config_lines.append(f"            limit_conn conn_limit_per_ip {conn_limit};")
            
            # Add HSTS if enabled
            if ssl_enabled and http_settings.get('hsts_enabled', False):
                hsts_max_age = http_settings.get('hsts_max_age', 31536000)
                hsts_options = f"max-age={hsts_max_age}"
                
                if http_settings.get('hsts_include_subdomains', False):
                    hsts_options += "; includeSubDomains"
                
                if http_settings.get('hsts_preload', False):
                    hsts_options += "; preload"
                
                config_lines.append(f"            add_header Strict-Transport-Security \"{hsts_options}\" always;")
            
            # Close location block
            config_lines.append("        }")
        
        # Close server block
        config_lines.append("    }")
        
        # Close http block
        config_lines.append("}")
        
        # Join all lines with newlines
        return "\n".join(config_lines)
    
    def _deploy_vendor_config(self, standard_config: Dict, config_path: str) -> Dict:
        """
        Deploy NGINX configuration as Docker container
        
        Args:
            standard_config: Standardized configuration dictionary
            config_path: Path to the generated configuration file
            
        Returns:
            Dictionary with deployment results
        """
        try:
            # Get virtual server details
            virtual_server = standard_config.get('virtual_server', {})
            vs_name = virtual_server.get('name', 'unknown')
            port = virtual_server.get('port', 80)
            
            # Generate a unique container name
            container_name = f"nginx-{vs_name.replace('.', '-')}"
            
            # Create SSL directory and certificates if needed
            ssl = virtual_server.get('ssl', {})
            ssl_enabled = ssl.get('enabled', False)
            mtls_enabled = virtual_server.get('mtls', {}).get('enabled', False)
            
            if ssl_enabled or mtls_enabled:
                # Create SSL directory
                ssl_dir = os.path.dirname(config_path) + "/ssl"
                os.makedirs(ssl_dir, exist_ok=True)
                
                # Create certificates
                certificates = standard_config.get('certificates', [])
                for cert in certificates:
                    cert_name = cert.get('name', 'unknown')
                    # In a real implementation, we would generate or fetch actual certificates
                    # For now, we'll just create placeholder files
                    with open(f"{ssl_dir}/{cert_name}.crt", 'w') as f:
                        f.write(f"# Placeholder for {cert_name} certificate\n")
                    
                    with open(f"{ssl_dir}/{cert_name}.key", 'w') as f:
                        f.write(f"# Placeholder for {cert_name} private key\n")
            
            # Run Docker container with the configuration
            cmd = [
                "docker", "run", "-d",
                "--name", container_name,
                "-p", f"{port}:{port}",
                "-v", f"{config_path}:/etc/nginx/nginx.conf:ro"
            ]
            
            # Add SSL volume mount if needed
            if ssl_enabled or mtls_enabled:
                cmd.extend(["-v", f"{ssl_dir}:/etc/nginx/ssl:ro"])
            
            # Add NGINX image
            cmd.append("nginx:latest")
            
            # Execute the command
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                return {
                    'success': False,
                    'error': f"Failed to deploy NGINX container: {result.stderr}",
                    'config_path': config_path
                }
            
            return {
                'success': True,
                'container_name': container_name,
                'config_path': config_path,
                'message': f"NGINX container deployed successfully with configuration for {vs_name}"
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Exception during NGINX deployment: {str(e)}"
            }
    
    def _get_file_extension(self) -> str:
        """
        Get the file extension for NGINX configuration
        
        Returns:
            File extension string
        """
        return "conf"
