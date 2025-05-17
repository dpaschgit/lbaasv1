from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, List
from mongodb_config_storage import LBaaSConfigStorage, LBMigration
from auth import get_current_user, User  # Changed from models import User
from models import PyObjectId  # Keep other imports from models

# Initialize the router for migration API
router = APIRouter(prefix="/migration", tags=["migration"])

# Initialize storage (should be shared with main.py)
config_storage = LBaaSConfigStorage("mongodb://mongodb:27017", "lbaas_db")
migration_manager = LBMigration(config_storage)

@router.get("/lb-types")
async def get_lb_types(current_user: User = Depends(get_current_user)):
    # Return available LB types
    return ["NGINX", "F5", "AVI"]

@router.post("/prepare/{vip_id}")
async def prepare_migration(vip_id: str, target_lb_type: str,
                           current_user: User = Depends(get_current_user)):
    # Prepare migration plan
    try:
        plan = migration_manager.prepare_migration(
            vip_id=vip_id,
            target_lb_type=target_lb_type
        )
        return plan
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/compatibility-check")
async def check_compatibility(source_lb_type: str, target_lb_type: str,
                             features: List[str], current_user: User = Depends(get_current_user)):
    # Check feature compatibility between LB types
    compatibility = {
        "compatible_features": [],
        "incompatible_features": [],
        "warnings": []
    }
    
    # This is a simplified compatibility check
    # In a real implementation, this would be more comprehensive
    for feature in features:
        if feature in ["basic_http", "basic_https"]:
            compatibility["compatible_features"].append(feature)
        elif feature in ["cookie_persistence", "source_ip_persistence"]:
            if source_lb_type == "NGINX" and target_lb_type == "F5":
                compatibility["compatible_features"].append(feature)
            elif source_lb_type == "F5" and target_lb_type == "AVI":
                compatibility["compatible_features"].append(feature)
            else:
                compatibility["incompatible_features"].append(feature)
                compatibility["warnings"].append(f"Feature {feature} is not compatible between {source_lb_type} and {target_lb_type}")
        elif feature in ["mtls"]:
            if target_lb_type in ["F5", "AVI"]:
                compatibility["compatible_features"].append(feature)
            else:
                compatibility["warnings"].append(f"Feature {feature} may have limited support in {target_lb_type}")
        else:
            compatibility["incompatible_features"].append(feature)
            compatibility["warnings"].append(f"Unknown feature {feature}")
    
    return compatibility

@router.post("/execute")
async def execute_migration(vip_id: str, migrated_config: Dict,
                           target_lb_type: str, current_user: User = Depends(get_current_user)):
    # Execute migration
    try:
        config_id = migration_manager.execute_migration(
            vip_id=vip_id,
            migrated_config=migrated_config,
            target_lb_type=target_lb_type,
            user=current_user.username
        )
        return {"config_id": config_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/status/{migration_id}")
async def get_migration_status(migration_id: str, current_user: User = Depends(get_current_user)):
    # In a real implementation, this would query a migration status database
    # For now, we'll return a mock status
    return {
        "migration_id": migration_id,
        "status": "completed",
        "source_lb_type": "NGINX",
        "target_lb_type": "F5",
        "start_time": "2025-05-17T18:30:00Z",
        "end_time": "2025-05-17T18:35:00Z",
        "steps": [
            {"name": "Prepare migration", "status": "completed", "timestamp": "2025-05-17T18:30:00Z"},
            {"name": "Validate configuration", "status": "completed", "timestamp": "2025-05-17T18:31:00Z"},
            {"name": "Generate target configuration", "status": "completed", "timestamp": "2025-05-17T18:32:00Z"},
            {"name": "Deploy to target LB", "status": "completed", "timestamp": "2025-05-17T18:34:00Z"},
            {"name": "Verify deployment", "status": "completed", "timestamp": "2025-05-17T18:35:00Z"}
        ]
    }
