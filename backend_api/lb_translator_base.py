"""
Base Load Balancer Translator Module

This module defines a base translator class that all specific load balancer handlers
can inherit from. It provides common parsing logic for the standardized schema while
allowing each vendor-specific handler to focus on its unique translation requirements.
"""

import json
import os
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any, Union

from common_lb_schema import CommonLBSchema, LBProtocol, PersistenceType


class LBTranslatorBase(ABC):
    """Base class for all load balancer translators"""
    
    def __init__(self):
        """Initialize the translator"""
        pass
    
    def translate_config(self, standard_config: Dict) -> str:
        """
        Translate standardized configuration to vendor-specific format
        
        Args:
            standard_config: Standardized configuration dictionary
            
        Returns:
            Vendor-specific configuration as string
        """
        # Validate the input configuration
        self._validate_config(standard_config)
        
        # Extract key components from the standard config
        metadata = standard_config.get('metadata', {})
        virtual_server = standard_config.get('virtual_server', {})
        pools = standard_config.get('pools', [])
        certificates = standard_config.get('certificates', [])
        
        # Perform the vendor-specific translation
        return self._generate_vendor_config(metadata, virtual_server, pools, certificates)
    
    def _validate_config(self, config: Dict) -> None:
        """
        Validate the standardized configuration
        
        Args:
            config: Standardized configuration dictionary
            
        Raises:
            ValueError: If configuration is invalid
        """
        # Check for required top-level sections
        required_sections = ['metadata', 'virtual_server', 'pools']
        for section in required_sections:
            if section not in config:
                raise ValueError(f"Missing required section: {section}")
        
        # Check for required virtual server fields
        vs = config.get('virtual_server', {})
        required_vs_fields = ['id', 'name', 'ip_address', 'port', 'protocol', 'pool_id']
        for field in required_vs_fields:
            if field not in vs:
                raise ValueError(f"Missing required virtual server field: {field}")
        
        # Check that at least one pool exists
        pools = config.get('pools', [])
        if not pools:
            raise ValueError("At least one pool must be defined")
        
        # Check that the referenced pool exists
        pool_id = vs.get('pool_id')
        pool_ids = [p.get('id') for p in pools]
        if pool_id not in pool_ids:
            raise ValueError(f"Referenced pool_id '{pool_id}' not found in pools")
        
        # Check for SSL configuration if protocol is HTTPS
        if vs.get('protocol') == LBProtocol.HTTPS.value:
            ssl = vs.get('ssl', {})
            if not ssl.get('enabled'):
                raise ValueError("SSL must be enabled for HTTPS protocol")
            
            # Check for certificate if SSL is enabled
            cert_id = ssl.get('certificate_id')
            if not cert_id:
                raise ValueError("Certificate ID must be specified for SSL")
            
            # Check that the referenced certificate exists
            cert_ids = [c.get('id') for c in config.get('certificates', [])]
            if cert_id not in cert_ids:
                raise ValueError(f"Referenced certificate_id '{cert_id}' not found in certificates")
        
        # Check for mTLS configuration if enabled
        mtls = vs.get('mtls', {})
        if mtls.get('enabled'):
            client_ca_cert_id = mtls.get('client_ca_cert_id')
            if not client_ca_cert_id:
                raise ValueError("Client CA certificate ID must be specified for mTLS")
            
            # Check that the referenced CA certificate exists
            cert_ids = [c.get('id') for c in config.get('certificates', [])]
            if client_ca_cert_id not in cert_ids:
                raise ValueError(f"Referenced client_ca_cert_id '{client_ca_cert_id}' not found in certificates")
    
    @abstractmethod
    def _generate_vendor_config(self, metadata: Dict, virtual_server: Dict, 
                               pools: List[Dict], certificates: List[Dict]) -> str:
        """
        Generate vendor-specific configuration
        
        Args:
            metadata: Metadata section from standardized config
            virtual_server: Virtual server section from standardized config
            pools: Pools section from standardized config
            certificates: Certificates section from standardized config
            
        Returns:
            Vendor-specific configuration as string
        """
        pass
    
    def deploy(self, standard_config: Dict, output_dir: str) -> Dict:
        """
        Deploy the configuration
        
        Args:
            standard_config: Standardized configuration dictionary
            output_dir: Directory to write configuration files
            
        Returns:
            Dictionary with deployment results
        """
        try:
            # Translate the configuration
            vendor_config = self.translate_config(standard_config)
            
            # Create output directory if it doesn't exist
            os.makedirs(output_dir, exist_ok=True)
            
            # Get the virtual server name for the filename
            vs_name = standard_config.get('virtual_server', {}).get('name', 'unknown')
            
            # Write configuration to file
            config_path = os.path.join(output_dir, f"{vs_name}.{self._get_file_extension()}")
            with open(config_path, 'w') as f:
                f.write(vendor_config)
            
            # Perform vendor-specific deployment steps
            deploy_result = self._deploy_vendor_config(standard_config, config_path)
            
            # Add common result fields
            deploy_result.update({
                'config_path': config_path,
                'lb_type': standard_config.get('metadata', {}).get('lb_type', '')
            })
            
            return deploy_result
            
        except Exception as e:
            return {
                'success': False,
                'error': f"Exception during deployment: {str(e)}"
            }
    
    @abstractmethod
    def _deploy_vendor_config(self, standard_config: Dict, config_path: str) -> Dict:
        """
        Perform vendor-specific deployment steps
        
        Args:
            standard_config: Standardized configuration dictionary
            config_path: Path to the generated configuration file
            
        Returns:
            Dictionary with deployment results
        """
        pass
    
    @abstractmethod
    def _get_file_extension(self) -> str:
        """
        Get the file extension for the vendor-specific configuration
        
        Returns:
            File extension string (e.g., 'conf', 'json')
        """
        pass
    
    def _get_pool_by_id(self, pools: List[Dict], pool_id: str) -> Optional[Dict]:
        """
        Get a pool by its ID
        
        Args:
            pools: List of pool dictionaries
            pool_id: ID of the pool to find
            
        Returns:
            Pool dictionary or None if not found
        """
        for pool in pools:
            if pool.get('id') == pool_id:
                return pool
        return None
    
    def _get_certificate_by_id(self, certificates: List[Dict], cert_id: str) -> Optional[Dict]:
        """
        Get a certificate by its ID
        
        Args:
            certificates: List of certificate dictionaries
            cert_id: ID of the certificate to find
            
        Returns:
            Certificate dictionary or None if not found
        """
        for cert in certificates:
            if cert.get('id') == cert_id:
                return cert
        return None
