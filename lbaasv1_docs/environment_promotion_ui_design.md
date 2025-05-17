# Environment Promotion and Migration UI Design

## Overview

This document outlines the UI components and workflows for environment promotion and load balancer migration in the LBaaS platform. These features enable users to promote VIP configurations across environments (DEV → UAT → PROD) and migrate between different load balancer types while maintaining a vendor-agnostic approach.

## Environment Promotion UI

### 1. VIP List Page Enhancements

The VIP list page will be enhanced with a new "Promote" action in the dropdown menu for each VIP:

```
Actions ▼
  - View
  - Edit
  - Delete
  - Promote to Next Environment ✨
  - Migrate to Different LB Type ✨
```

### 2. Environment Promotion Wizard

When a user selects "Promote to Next Environment," a multi-step wizard will guide them through the promotion process:

#### Step 1: Source and Target Selection
- **Source Information (Read-only)**
  - Current VIP Name: app.example.com
  - Current Environment: DEV
  - Current Datacenter: LADC
  - Current Load Balancer Type: NGINX

- **Target Selection**
  - Target Environment: [Dropdown] UAT (default to next environment)
  - Target Datacenter: [Dropdown] NYDC, LADC, UKDC
  - Target Load Balancer Type: [Dropdown] F5, NGINX, AVI (default based on placement logic)

#### Step 2: Environment-Specific Parameters
- **IP Address Assignment**
  - [ ] Auto-assign from IPAM (recommended)
  - [ ] Manually specify: [Input field]

- **DNS Configuration**
  - VIP FQDN: [Input field, pre-filled with environment-specific name]
  - [ ] Create DNS record automatically

- **SSL Certificate**
  - [ ] Use existing certificate (if available for target environment)
  - [ ] Generate new certificate
  - [ ] Upload certificate: [File upload]

#### Step 3: Backend Servers
- Table of backend servers with checkboxes to include/exclude
- Option to add new servers specific to target environment
- Server validation against CMDB for target environment

#### Step 4: Change Management
- Change Request ID: [Input field, optional]
- Implementation Date: [Date picker]
- Implementation Time: [Time picker]
- Approval Workflow: [Dropdown] Standard, Emergency, Pre-approved
- Comments: [Text area]

#### Step 5: Review and Confirm
- Complete summary of promotion details
- Differences highlighted between source and target configurations
- Confirmation checkbox and Submit button

### 3. Promotion Status Page

After submission, users are directed to a status page showing:
- Promotion request ID
- Current status (Pending, In Progress, Completed, Failed)
- Timeline of steps with status indicators
- Logs and error messages if applicable
- Option to cancel pending promotion

## Load Balancer Migration UI

### 1. Migration Wizard

When a user selects "Migrate to Different LB Type," a wizard will guide them through the migration process:

#### Step 1: Target Selection
- **Source Information (Read-only)**
  - Current VIP Name: app.example.com
  - Current Environment: DEV
  - Current Datacenter: LADC
  - Current Load Balancer Type: NGINX

- **Target Selection**
  - Target Load Balancer Type: [Dropdown] F5, AVI
  - [ ] Keep same environment and datacenter

#### Step 2: Feature Compatibility Check
- Automatic analysis of feature compatibility between source and target LB types
- Warnings for features not supported in target LB type
- Required adjustments for persistence, SSL, and other LB-specific settings

#### Step 3: Change Management
- Change Request ID: [Input field, optional]
- Implementation Date: [Date picker]
- Implementation Time: [Time picker]
- Approval Workflow: [Dropdown] Standard, Emergency, Pre-approved
- Comments: [Text area]

#### Step 4: Review and Confirm
- Complete summary of migration details
- Differences highlighted between source and target configurations
- Confirmation checkbox and Submit button

### 2. Migration Status Page

Similar to the promotion status page, showing:
- Migration request ID
- Current status
- Timeline of steps
- Logs and error messages
- Option to cancel pending migration

## API Endpoints

The following API endpoints will be implemented to support these UI components:

### Environment Promotion API

```
GET    /lbaas/api/promotion/environments                # Get available environments
GET    /lbaas/api/promotion/datacenters/{environment}   # Get datacenters for environment
GET    /lbaas/api/promotion/lb-types/{environment}/{dc} # Get LB types for env/datacenter
POST   /lbaas/api/promotion/prepare/{vip_id}            # Prepare promotion plan
POST   /lbaas/api/promotion/execute                     # Execute promotion
GET    /lbaas/api/promotion/status/{promotion_id}       # Get promotion status
DELETE /lbaas/api/promotion/{promotion_id}              # Cancel promotion
```

### Migration API

```
GET    /lbaas/api/migration/lb-types                    # Get available LB types
POST   /lbaas/api/migration/prepare/{vip_id}            # Prepare migration plan
POST   /lbaas/api/migration/compatibility-check         # Check feature compatibility
POST   /lbaas/api/migration/execute                     # Execute migration
GET    /lbaas/api/migration/status/{migration_id}       # Get migration status
DELETE /lbaas/api/migration/{migration_id}              # Cancel migration
```

## Integration Points

The UI components will integrate with:

1. **MongoDB Storage**: For retrieving and storing configurations
2. **IPAM Service**: For IP address allocation in target environment
3. **DNS Service**: For creating DNS records in target environment
4. **ServiceNow**: For change management and approval workflows
5. **CMDB**: For server validation and environment data
6. **Certificate Management**: For SSL certificate handling

## User Permissions

- **Regular Users**: Can promote their own VIPs to DEV environment
- **Environment Owners**: Can promote VIPs to their owned environment
- **Administrators**: Can promote VIPs to any environment and perform migrations
- **Auditors**: Can view promotion/migration history but cannot execute

## Workflow Automation

The promotion and migration processes will support:

1. **Scheduled Execution**: Implement at specified date/time
2. **Approval Workflows**: Integration with ServiceNow for approvals
3. **Rollback Capability**: Revert to previous configuration if issues occur
4. **Audit Trail**: Complete history of all promotions and migrations
