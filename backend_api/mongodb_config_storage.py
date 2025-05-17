"""
MongoDB Storage Module for LBaaS Configurations

This module implements MongoDB storage for standardized load balancer configurations,
supporting vendor-agnostic storage, environment promotion, and migration.
"""

import json
from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from pymongo import MongoClient
from bson.objectid import ObjectId

from common_lb_schema import CommonLBSchema


class LBaaSConfigStorage:
    """Storage manager for LBaaS configurations in MongoDB"""
    
    def __init__(self, mongo_uri: str, db_name: str = "lbaas_db"):
        """
        Initialize the LBaaS configuration storage
        
        Args:
            mongo_uri: MongoDB connection URI
            db_name: Database name
        """
        self.client = MongoClient(mongo_uri)
        self.db = self.client[db_name]
        self.configs = self.db.lb_configurations
        
    def store_config(self, vip_id: str, standard_config: Dict, 
                    environment: str, datacenter: str, lb_type: str, 
                    user: str) -> str:
        """
        Store a standardized configuration in MongoDB
        
        Args:
            vip_id: VIP identifier
            standard_config: Standardized configuration dictionary
            environment: Environment (DEV, UAT, PROD)
            datacenter: Datacenter (LADC, NYDC, UKDC)
            lb_type: Load balancer type (NGINX, F5, AVI)
            user: Username who created/updated the configuration
            
        Returns:
            Configuration ID
        """
        # Check if configuration already exists
        existing = self.configs.find_one({"vip_id": vip_id})
        
        if existing:
            # Update existing configuration
            result = self.configs.update_one(
                {"vip_id": vip_id},
                {
                    "$set": {
                        "standard_config": standard_config,
                        "environment": environment,
                        "datacenter": datacenter,
                        "lb_type": lb_type,
                        "last_updated": datetime.now(),
                        "updated_by": user
                    }
                }
            )
            return str(existing["_id"])
        else:
            # Create new configuration
            result = self.configs.insert_one({
                "vip_id": vip_id,
                "standard_config": standard_config,
                "environment": environment,
                "datacenter": datacenter,
                "lb_type": lb_type,
                "created_at": datetime.now(),
                "created_by": user,
                "last_updated": datetime.now(),
                "updated_by": user
            })
            return str(result.inserted_id)
    
    def get_config(self, vip_id: str) -> Optional[Dict]:
        """
        Get a standardized configuration from MongoDB
        
        Args:
            vip_id: VIP identifier
            
        Returns:
            Standardized configuration dictionary or None if not found
        """
        result = self.configs.find_one({"vip_id": vip_id})
        return result
    
    def get_configs_by_environment(self, environment: str) -> List[Dict]:
        """
        Get all configurations for a specific environment
        
        Args:
            environment: Environment (DEV, UAT, PROD)
            
        Returns:
            List of configuration dictionaries
        """
        results = list(self.configs.find({"environment": environment}))
        return results
    
    def get_configs_by_datacenter(self, datacenter: str) -> List[Dict]:
        """
        Get all configurations for a specific datacenter
        
        Args:
            datacenter: Datacenter (LADC, NYDC, UKDC)
            
        Returns:
            List of configuration dictionaries
        """
        results = list(self.configs.find({"datacenter": datacenter}))
        return results
    
    def get_configs_by_lb_type(self, lb_type: str) -> List[Dict]:
        """
        Get all configurations for a specific load balancer type
        
        Args:
            lb_type: Load balancer type (NGINX, F5, AVI)
            
        Returns:
            List of configuration dictionaries
        """
        results = list(self.configs.find({"lb_type": lb_type}))
        return results
    
    def delete_config(self, vip_id: str) -> bool:
        """
        Delete a configuration from MongoDB
        
        Args:
            vip_id: VIP identifier
            
        Returns:
            True if deleted, False if not found
        """
        result = self.configs.delete_one({"vip_id": vip_id})
        return result.deleted_count > 0


class EnvironmentPromotion:
    """Environment promotion manager for LBaaS configurations"""
    
    def __init__(self, config_storage: LBaaSConfigStorage):
        """
        Initialize the environment promotion manager
        
        Args:
            config_storage: LBaaS configuration storage
        """
        self.config_storage = config_storage
        self.schema = CommonLBSchema()
    
    def prepare_promotion(self, vip_id: str, target_environment: str, 
                         target_datacenter: str, target_lb_type: str) -> Dict:
        """
        Prepare a configuration for promotion to a new environment
        
        Args:
            vip_id: VIP identifier
            target_environment: Target environment (DEV, UAT, PROD)
            target_datacenter: Target datacenter (LADC, NYDC, UKDC)
            target_lb_type: Target load balancer type (NGINX, F5, AVI)
            
        Returns:
            Prepared configuration dictionary
        """
        # Get the source configuration
        source_config = self.config_storage.get_config(vip_id)
        if not source_config:
            raise ValueError(f"Configuration for VIP {vip_id} not found")
        
        # Create a copy of the standardized configuration
        promoted_config = source_config["standard_config"].copy()
        
        # Update metadata for the new environment
        if "metadata" in promoted_config:
            promoted_config["metadata"]["environment"] = target_environment
            promoted_config["metadata"]["datacenter"] = target_datacenter
            promoted_config["metadata"]["lb_type"] = target_lb_type
        
        # Clear environment-specific fields that need to be re-specified
        # IP address would typically be re-assigned for the new environment
        if "virtual_server" in promoted_config:
            promoted_config["virtual_server"]["ip_address"] = ""
        
        # Return the prepared configuration for further customization
        return {
            "source_config": source_config,
            "promoted_config": promoted_config,
            "target_environment": target_environment,
            "target_datacenter": target_datacenter,
            "target_lb_type": target_lb_type,
            "fields_requiring_update": [
                "virtual_server.ip_address",
                "certificates"
            ]
        }
    
    def execute_promotion(self, vip_id: str, promoted_config: Dict, 
                         target_environment: str, target_datacenter: str, 
                         target_lb_type: str, user: str) -> str:
        """
        Execute the promotion of a configuration to a new environment
        
        Args:
            vip_id: VIP identifier
            promoted_config: Promoted configuration dictionary
            target_environment: Target environment (DEV, UAT, PROD)
            target_datacenter: Target datacenter (LADC, NYDC, UKDC)
            target_lb_type: Target load balancer type (NGINX, F5, AVI)
            user: Username executing the promotion
            
        Returns:
            New configuration ID
        """
        # Generate a new VIP ID for the promoted configuration
        # This allows having the same service in multiple environments
        env_prefix = target_environment.lower()
        new_vip_id = f"{env_prefix}-{vip_id}"
        
        # Store the promoted configuration
        config_id = self.config_storage.store_config(
            vip_id=new_vip_id,
            standard_config=promoted_config,
            environment=target_environment,
            datacenter=target_datacenter,
            lb_type=target_lb_type,
            user=user
        )
        
        return config_id


class LBMigration:
    """Load balancer migration manager for LBaaS configurations"""
    
    def __init__(self, config_storage: LBaaSConfigStorage):
        """
        Initialize the load balancer migration manager
        
        Args:
            config_storage: LBaaS configuration storage
        """
        self.config_storage = config_storage
    
    def prepare_migration(self, vip_id: str, target_lb_type: str) -> Dict:
        """
        Prepare a configuration for migration to a new load balancer type
        
        Args:
            vip_id: VIP identifier
            target_lb_type: Target load balancer type (NGINX, F5, AVI)
            
        Returns:
            Prepared migration dictionary
        """
        # Get the source configuration
        source_config = self.config_storage.get_config(vip_id)
        if not source_config:
            raise ValueError(f"Configuration for VIP {vip_id} not found")
        
        # Create a copy of the standardized configuration
        migrated_config = source_config["standard_config"].copy()
        
        # Update load balancer type
        if "metadata" in migrated_config:
            migrated_config["metadata"]["lb_type"] = target_lb_type
        
        # Return the prepared configuration for further customization
        return {
            "source_config": source_config,
            "migrated_config": migrated_config,
            "source_lb_type": source_config.get("lb_type"),
            "target_lb_type": target_lb_type,
            "fields_requiring_review": [
                "persistence",
                "ssl",
                "mtls"
            ]
        }
    
    def execute_migration(self, vip_id: str, migrated_config: Dict, 
                         target_lb_type: str, user: str) -> str:
        """
        Execute the migration of a configuration to a new load balancer type
        
        Args:
            vip_id: VIP identifier
            migrated_config: Migrated configuration dictionary
            target_lb_type: Target load balancer type (NGINX, F5, AVI)
            user: Username executing the migration
            
        Returns:
            Configuration ID
        """
        # Get the current configuration
        current_config = self.config_storage.get_config(vip_id)
        if not current_config:
            raise ValueError(f"Configuration for VIP {vip_id} not found")
        
        # Store the migrated configuration
        config_id = self.config_storage.store_config(
            vip_id=vip_id,
            standard_config=migrated_config,
            environment=current_config.get("environment"),
            datacenter=current_config.get("datacenter"),
            lb_type=target_lb_type,
            user=user
        )
        
        return config_id


# Example usage
if __name__ == "__main__":
    # Initialize storage
    storage = LBaaSConfigStorage("mongodb://localhost:27017", "lbaas_db")
    
    # Create a sample configuration
    schema = CommonLBSchema()
    vip_config = {
        "vip_fqdn": "app.example.com",
        "vip_ip": "192.168.1.100",
        "port": 443,
        "protocol": "HTTPS",
        "environment": "DEV",
        "datacenter": "LADC",
        "lb_method": "round_robin"
    }
    
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
            "weight": 2
        }
    ]
    
    placement_decision = {
        "lb_type": "NGINX",
        "environment": "DEV",
        "datacenter": "LADC"
    }
    
    # Generate standardized configuration
    standard_config = schema.create_standard_config(vip_config, servers, placement_decision)
    
    # Store the configuration
    vip_id = "vs-app-example-com"
    config_id = storage.store_config(
        vip_id=vip_id,
        standard_config=standard_config,
        environment="DEV",
        datacenter="LADC",
        lb_type="NGINX",
        user="admin"
    )
    
    print(f"Stored configuration with ID: {config_id}")
    
    # Prepare for promotion to UAT
    promotion = EnvironmentPromotion(storage)
    promotion_plan = promotion.prepare_promotion(
        vip_id=vip_id,
        target_environment="UAT",
        target_datacenter="NYDC",
        target_lb_type="F5"
    )
    
    print("Promotion plan prepared:")
    print(f"Source environment: {promotion_plan['source_config']['environment']}")
    print(f"Target environment: {promotion_plan['target_environment']}")
    print(f"Fields requiring update: {promotion_plan['fields_requiring_update']}")
    
    # Update required fields in the promoted configuration
    promoted_config = promotion_plan["promoted_config"]
    promoted_config["virtual_server"]["ip_address"] = "192.168.2.100"
    
    # Execute the promotion
    new_config_id = promotion.execute_promotion(
        vip_id=vip_id,
        promoted_config=promoted_config,
        target_environment="UAT",
        target_datacenter="NYDC",
        target_lb_type="F5",
        user="admin"
    )
    
    print(f"Executed promotion with new configuration ID: {new_config_id}")
