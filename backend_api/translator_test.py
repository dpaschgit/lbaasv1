"""
Load Balancer Translator Test Module

This module tests the load balancer translators with sample configurations
to ensure they correctly consume the standardized schema and produce
valid vendor-specific configurations.
"""

import os
import json
from typing import Dict, List

from common_lb_schema import CommonLBSchema
from translator_factory import TranslatorFactory


def create_test_directory():
    """Create test output directory"""
    test_dir = "./translator_test_output"
    os.makedirs(test_dir, exist_ok=True)
    
    # Create subdirectories for each translator
    os.makedirs(f"{test_dir}/nginx", exist_ok=True)
    os.makedirs(f"{test_dir}/f5", exist_ok=True)
    os.makedirs(f"{test_dir}/avi", exist_ok=True)
    
    return test_dir


def create_test_configs() -> List[Dict]:
    """Create test configurations for validation"""
    test_configs = []
    
    # Test Case 1: Basic HTTP configuration
    vip_config_1 = {
        'vip_fqdn': 'app.example.com',
        'vip_ip': '192.168.1.100',
        'port': 80,
        'protocol': 'HTTP',
        'environment': 'DEV',
        'datacenter': 'LADC',
        'lb_method': 'round_robin'
    }
    
    servers_1 = [
        {
            'fqdn': 'server1.example.com',
            'ip': '192.168.1.101',
            'server_port': 8080,
            'weight': 1
        },
        {
            'fqdn': 'server2.example.com',
            'ip': '192.168.1.102',
            'server_port': 8080,
            'weight': 2
        }
    ]
    
    placement_decision_1 = {
        'lb_type': 'NGINX',
        'environment': 'DEV',
        'datacenter': 'LADC'
    }
    
    # Test Case 2: HTTPS with cookie persistence
    vip_config_2 = {
        'vip_fqdn': 'secure.example.com',
        'vip_ip': '192.168.1.200',
        'port': 443,
        'protocol': 'HTTPS',
        'environment': 'UAT',
        'datacenter': 'NYDC',
        'lb_method': 'least_connections',
        # Persistence configuration
        'persistence_type': 'cookie',
        'persistence_cookie_name': 'JSESSIONID',
        'persistence_timeout': 3600
    }
    
    servers_2 = [
        {
            'fqdn': 'server1.example.com',
            'ip': '192.168.1.201',
            'server_port': 8443,
            'weight': 1
        },
        {
            'fqdn': 'server2.example.com',
            'ip': '192.168.1.202',
            'server_port': 8443,
            'weight': 1
        },
        {
            'fqdn': 'server3.example.com',
            'ip': '192.168.1.203',
            'server_port': 8443,
            'weight': 1,
            'backup': True
        }
    ]
    
    placement_decision_2 = {
        'lb_type': 'F5',
        'environment': 'UAT',
        'datacenter': 'NYDC'
    }
    
    # Test Case 3: HTTPS with mTLS and source IP persistence
    vip_config_3 = {
        'vip_fqdn': 'api.example.com',
        'vip_ip': '192.168.1.300',
        'port': 443,
        'protocol': 'HTTPS',
        'environment': 'PROD',
        'datacenter': 'UKDC',
        'lb_method': 'ip_hash',
        # Persistence configuration
        'persistence_type': 'source_ip',
        'persistence_timeout': 7200,
        # mTLS configuration
        'mtls_enabled': True,
        'client_auth_type': 'required',
        'mtls_verify_depth': 2,
        # HTTP settings
        'redirect_http_to_https': True,
        'hsts_enabled': True,
        'hsts_max_age': 31536000,
        'hsts_include_subdomains': True
    }
    
    servers_3 = [
        {
            'fqdn': 'api1.example.com',
            'ip': '192.168.1.301',
            'server_port': 8443,
            'weight': 1,
            'max_connections': 1000
        },
        {
            'fqdn': 'api2.example.com',
            'ip': '192.168.1.302',
            'server_port': 8443,
            'weight': 1,
            'max_connections': 1000
        }
    ]
    
    placement_decision_3 = {
        'lb_type': 'AVI',
        'environment': 'PROD',
        'datacenter': 'UKDC'
    }
    
    # Create standardized configurations
    schema = CommonLBSchema()
    
    # Add test case 1
    config_1 = schema.create_standard_config(vip_config_1, servers_1, placement_decision_1)
    test_configs.append({
        'name': 'basic_http',
        'config': config_1,
        'lb_type': placement_decision_1['lb_type']
    })
    
    # Add test case 2
    config_2 = schema.create_standard_config(vip_config_2, servers_2, placement_decision_2)
    test_configs.append({
        'name': 'https_with_persistence',
        'config': config_2,
        'lb_type': placement_decision_2['lb_type']
    })
    
    # Add test case 3
    config_3 = schema.create_standard_config(vip_config_3, servers_3, placement_decision_3)
    test_configs.append({
        'name': 'https_with_mtls',
        'config': config_3,
        'lb_type': placement_decision_3['lb_type']
    })
    
    return test_configs


def validate_nginx_config(config_path: str) -> Dict:
    """
    Validate NGINX configuration
    
    Args:
        config_path: Path to the NGINX configuration file
        
    Returns:
        Dictionary with validation results
    """
    try:
        with open(config_path, 'r') as f:
            content = f.read()
        
        # Check for key elements in the configuration
        validation_points = [
            'upstream',
            'server',
            'location',
            'proxy_pass'
        ]
        
        results = {}
        for point in validation_points:
            results[point] = point in content
        
        # Check for SSL configuration if applicable
        if 'ssl' in content:
            ssl_points = [
                'ssl_certificate',
                'ssl_certificate_key',
                'ssl_protocols'
            ]
            
            for point in ssl_points:
                results[point] = point in content
        
        # Check for mTLS configuration if applicable
        if 'ssl_verify_client' in content:
            mtls_points = [
                'ssl_verify_client',
                'ssl_client_certificate',
                'ssl_verify_depth'
            ]
            
            for point in mtls_points:
                results[point] = point in content
        
        # Check for persistence configuration if applicable
        if 'sticky' in content:
            results['persistence'] = True
        
        # Overall validation result
        results['valid'] = all(results.values())
        
        return results
    
    except Exception as e:
        return {
            'valid': False,
            'error': str(e)
        }


def validate_f5_config(config_path: str) -> Dict:
    """
    Validate F5 configuration
    
    Args:
        config_path: Path to the F5 configuration file
        
    Returns:
        Dictionary with validation results
    """
    try:
        with open(config_path, 'r') as f:
            content = json.load(f)
        
        # Check for key elements in the configuration
        validation_points = [
            'pools',
            'virtualServers',
            'schemaVersion'
        ]
        
        results = {}
        for point in validation_points:
            results[point] = point in content
        
        # Check that pools and virtualServers are non-empty lists
        results['has_pools'] = isinstance(content.get('pools', []), list) and len(content.get('pools', [])) > 0
        results['has_vs'] = isinstance(content.get('virtualServers', []), list) and len(content.get('virtualServers', [])) > 0
        
        # Check pool configuration
        if results['has_pools']:
            pool = content['pools'][0]
            results['pool_has_members'] = 'members' in pool and len(pool['members']) > 0
            results['pool_has_lb_mode'] = 'load_balancing_mode' in pool
        
        # Check virtual server configuration
        if results['has_vs']:
            vs = content['virtualServers'][0]
            results['vs_has_destination'] = 'destination' in vs
            results['vs_has_pool'] = 'pool' in vs
            results['vs_has_profiles'] = 'profiles' in vs and isinstance(vs['profiles'], list)
        
        # Overall validation result
        results['valid'] = all(results.values())
        
        return results
    
    except Exception as e:
        return {
            'valid': False,
            'error': str(e)
        }


def validate_avi_config(config_path: str) -> Dict:
    """
    Validate AVI configuration
    
    Args:
        config_path: Path to the AVI configuration file
        
    Returns:
        Dictionary with validation results
    """
    try:
        with open(config_path, 'r') as f:
            content = json.load(f)
        
        # Check for key elements in the configuration
        validation_points = [
            'pools',
            'virtual_services',
            'application_profiles',
            'version'
        ]
        
        results = {}
        for point in validation_points:
            results[point] = point in content
        
        # Check that pools and virtual_services are non-empty lists
        results['has_pools'] = isinstance(content.get('pools', []), list) and len(content.get('pools', [])) > 0
        results['has_vs'] = isinstance(content.get('virtual_services', []), list) and len(content.get('virtual_services', [])) > 0
        
        # Check pool configuration
        if results['has_pools']:
            pool = content['pools'][0]
            results['pool_has_servers'] = 'servers' in pool and len(pool['servers']) > 0
            results['pool_has_lb_algorithm'] = 'lb_algorithm' in pool
        
        # Check virtual service configuration
        if results['has_vs']:
            vs = content['virtual_services'][0]
            results['vs_has_vip'] = 'vip' in vs and len(vs['vip']) > 0
            results['vs_has_services'] = 'services' in vs and len(vs['services']) > 0
            results['vs_has_pool_ref'] = 'pool_ref' in vs
        
        # Check for SSL configuration if applicable
        if 'ssl_profiles' in content:
            results['has_ssl_profiles'] = len(content['ssl_profiles']) > 0
        
        # Overall validation result
        results['valid'] = all(results.values())
        
        return results
    
    except Exception as e:
        return {
            'valid': False,
            'error': str(e)
        }


def run_tests():
    """Run translator tests and return results"""
    # Create test directory
    test_dir = create_test_directory()
    
    # Create test configurations
    test_configs = create_test_configs()
    
    # Initialize results
    results = {
        'total_tests': len(test_configs),
        'passed': 0,
        'failed': 0,
        'details': []
    }
    
    # Run tests for each configuration
    for test_case in test_configs:
        name = test_case['name']
        config = test_case['config']
        lb_type = test_case['lb_type']
        
        try:
            # Get the appropriate translator
            translator = TranslatorFactory.get_translator(lb_type)
            
            # Generate configuration
            output_dir = f"{test_dir}/{lb_type.lower()}"
            deploy_result = translator.deploy(config, output_dir)
            
            # Validate the configuration
            validation_result = {}
            if lb_type == 'NGINX':
                validation_result = validate_nginx_config(deploy_result['config_path'])
            elif lb_type == 'F5':
                validation_result = validate_f5_config(deploy_result['config_path'])
            elif lb_type == 'AVI':
                validation_result = validate_avi_config(deploy_result['config_path'])
            
            # Record test result
            test_result = {
                'name': name,
                'lb_type': lb_type,
                'config_path': deploy_result['config_path'],
                'validation': validation_result,
                'passed': validation_result.get('valid', False)
            }
            
            if test_result['passed']:
                results['passed'] += 1
            else:
                results['failed'] += 1
            
            results['details'].append(test_result)
            
        except Exception as e:
            # Record test failure
            test_result = {
                'name': name,
                'lb_type': lb_type,
                'error': str(e),
                'passed': False
            }
            
            results['failed'] += 1
            results['details'].append(test_result)
    
    # Calculate success rate
    results['success_rate'] = (results['passed'] / results['total_tests']) * 100 if results['total_tests'] > 0 else 0
    
    return results


if __name__ == "__main__":
    # Run the tests
    results = run_tests()
    
    # Print summary
    print(f"Translator Test Results:")
    print(f"Total Tests: {results['total_tests']}")
    print(f"Passed: {results['passed']}")
    print(f"Failed: {results['failed']}")
    print(f"Success Rate: {results['success_rate']:.2f}%")
    print("\nTest Details:")
    
    for test in results['details']:
        status = "PASSED" if test['passed'] else "FAILED"
        print(f"- {test['name']} ({test['lb_type']}): {status}")
        
        if not test['passed']:
            if 'error' in test:
                print(f"  Error: {test['error']}")
            elif 'validation' in test:
                print(f"  Validation failures:")
                for key, value in test['validation'].items():
                    if not value and key != 'valid':
                        print(f"    - {key}")
        
        if 'config_path' in test:
            print(f"  Config: {test['config_path']}")
        
        print("")
