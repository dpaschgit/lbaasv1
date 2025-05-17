from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, List
from mongodb_config_storage import LBaaSConfigStorage, EnvironmentPromotion
from auth import get_current_user, User  # Changed from models import User
from models import PyObjectId  # Keep other imports from models

# Initialize the router for promotion API
router = APIRouter(prefix="/promotion", tags=["promotion"])

# Initialize storage (should be shared with main.py)
config_storage = LBaaSConfigStorage("mongodb://mongodb:27017", "lbaas_db")
promotion_manager = EnvironmentPromotion(config_storage)

@router.get("/environments")
async def get_environments(current_user: User = Depends(get_current_user)):
    # Return available environments
    return ["DEV", "UAT", "PROD"]

@router.get("/datacenters/{environment}")
async def get_datacenters(environment: str, current_user: User = Depends(get_current_user)):
    # Return datacenters for environment
    return ["LADC", "NYDC", "UKDC"]

@router.post("/prepare/{vip_id}")
async def prepare_promotion(vip_id: str, target_environment: str, 
                          target_datacenter: str, target_lb_type: str,
                          current_user: User = Depends(get_current_user)):
    # Prepare promotion plan
    try:
        plan = promotion_manager.prepare_promotion(
            vip_id=vip_id,
            target_environment=target_environment,
            target_datacenter=target_datacenter,
            target_lb_type=target_lb_type
        )
        return plan
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/execute")
async def execute_promotion(vip_id: str, promoted_config: Dict,
                          target_environment: str, target_datacenter: str,
                          target_lb_type: str, current_user: User = Depends(get_current_user)):
    # Execute promotion
    try:
        config_id = promotion_manager.execute_promotion(
            vip_id=vip_id,
            promoted_config=promoted_config,
            target_environment=target_environment,
            target_datacenter=target_datacenter,
            target_lb_type=target_lb_type,
            user=current_user.username
        )
        return {"config_id": config_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
