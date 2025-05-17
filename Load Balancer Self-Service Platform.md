# Load Balancer Self-Service Platform

This project provides a modular, containerized Load Balancer as a Service (LBaaS) platform. It includes a Backstage UI scaffold, a Python FastAPI backend API, mock services for TCPwave IPAM and ServiceNow CMDB/Ticketing, and translator modules for F5 (AS3), AVI, and Nginx load balancers.

## Project Structure

```
load_balancer_project/
├── backend_api/            # FastAPI backend service
│   ├── auth.py
│   ├── db.py
│   ├── Dockerfile
│   ├── integrations.py
│   ├── main.py
│   ├── models.py
│   ├── requirements.txt
│   ├── seed_mongo.py
│   ├── common_lb_schema.py # Common schema for all load balancer types
│   ├── lb_translator_base.py # Base translator class
│   ├── nginx_translator.py # NGINX-specific translator
│   ├── f5_translator.py    # F5-specific translator
│   ├── avi_translator.py   # AVI-specific translator
│   ├── translator_factory.py # Factory for creating translators
│   ├── translator_test.py  # Test framework for translators
│   ├── lb_registry_api.py  # CMDB load balancer management API
│   └── api_gateway_design.py # API Gateway integration design
├── backstage_ui/           # Backstage UI application scaffold
│   └── loadbalancer-portal/
├── database/               # MongoDB setup (managed by main docker-compose.yml)
│   └── docker-compose-mongo.yml # Initial mongo-only compose file (now superseded by root docker-compose.yml)
├── documentation/
│   ├── architecture_design.md
│   ├── todo.md
│   └── lb_registry_ui_design.md # Load balancer registry UI design
├── examples/
│   └── vip_config_example.json
├── mock_servicenow/        # Mock ServiceNow FastAPI service
│   ├── Dockerfile
│   ├── main.py
│   └── requirements.txt
├── mock_tcpwave/           # Mock TCPwave IPAM FastAPI service
│   ├── Dockerfile
│   ├── main.py
│   └── requirements.txt
├── translators/
│   ├── avi_translator/
│   │   ├── Dockerfile
│   │   ├── main.py
│   │   └── requirements.txt
│   ├── f5_as3_translator/
│   │   ├── Dockerfile
│   │   ├── main.py
│   │   └── requirements.txt
│   └── nginx_translator/
│       ├── Dockerfile
│       ├── main.py
│       └── requirements.txt
├── docker-compose.yml      # Main Docker Compose file to run all services
├── README.md               # This file
└── TESTING_PLAN.md         # Document outlining testing strategy
```

## Prerequisites

*   Docker
*   Docker Compose

## Getting Started

### 1. Clone the Repository (Conceptual)

If this project were on a Git repository, you would clone it. For now, ensure you have the `load_balancer_project` directory structure as provided.

### 2. Build and Run All Services

Navigate to the root of the `load_balancer_project` directory in your terminal and run:

```bash
docker-compose up -d --build
```

This command will:
*   Build Docker images for the backend API, mock services, and translator services.
*   Pull the official MongoDB image.
*   Start all services in detached mode (`-d`).

Services will be accessible on the following ports (by default, on `localhost`):
*   **MongoDB**: `27017`
*   **Backend API**: `8000` (API docs at `http://localhost:8000/docs`)
*   **Mock TCPwave**: `8001` (API docs at `http://localhost:8001/docs`)
*   **Mock ServiceNow**: `8002` (API docs at `http://localhost:8002/docs`)
*   **F5 AS3 Translator**: `8003` (API docs at `http://localhost:8003/docs`)
*   **AVI Translator**: `8004` (API docs at `http://localhost:8004/docs`)
*   **Nginx Translator**: `8005` (API docs at `http://localhost:8005/docs`)

### 3. Seed the MongoDB Database

Once the containers are running, you need to seed the MongoDB database with initial data (users are mocked in `auth.py`, this seeds VIPs).

Open a new terminal and run:

```bash
docker exec -it lbaas-backend-api python seed_mongo.py
```

This will execute the `seed_mongo.py` script inside the `lbaas-backend-api` container, populating the `lbaas_db` database with sample VIPs.

### 4. Testing the Platform

Refer to the `TESTING_PLAN.md` document for detailed instructions on how to test the various components and end-to-end scenarios. This includes:

*   Authenticating with different user roles (admin, auditor, user1, user2 - password for all is `testpassword`).
*   Creating, retrieving, updating, and deleting VIPs via the Backend API.
*   Verifying interactions with mock IPAM and ServiceNow services.
*   Checking the output of translator modules.
*   Testing user entitlement logic.

Use an API client like Postman or `curl` to interact with the Backend API at `http://localhost:8000`.

### 5. Backstage UI (Scaffold Only)

The Backstage UI (`backstage_ui/loadbalancer-portal`) is currently a scaffold created by `@backstage/create-app`. To run it:

1.  Navigate to `backstage_ui/loadbalancer-portal`.
2.  Install dependencies: `npm install` (or `pnpm install` if you prefer, ensure pnpm is installed: `npm install -g pnpm`).
3.  Start the development server: `npm run dev` (or `pnpm dev`).

This will typically start Backstage on `http://localhost:3000`.

**Note**: The Backstage UI plugin for interacting with the LBaaS API has **not** been developed as part of this automated generation. The UI scaffold is provided as a starting point if you wish to build a frontend.

## Stopping the Services

To stop all running services, navigate to the root of the `load_balancer_project` directory and run:

```bash
docker-compose down
```

To stop and remove volumes (like MongoDB data):

```bash
docker-compose down -v
```

## Common JSON Schema for Load Balancers

The LBaaS platform now includes a standardized JSON schema that serves as a common interface between the placement logic and various load balancer handlers. This enables consistent configuration across different load balancer types and simplifies the addition of new vendors in the future.

### Schema Structure

The common schema is defined in `backend_api/common_lb_schema.py` and includes the following main sections:

1. **Metadata**: Information about the environment, datacenter, and load balancer type
2. **Virtual Server**: The VIP configuration including IP, port, protocol, and advanced settings
3. **Pools**: Server groups with load balancing algorithms and health monitoring
4. **Certificates**: SSL/TLS certificates for the service

### Example Schema

```json
{
  "metadata": {
    "schema_version": "1.0",
    "lb_type": "F5",
    "environment": "PROD",
    "datacenter": "LADC",
    "created_by": "LBaaS",
    "description": "Load balancer configuration for app.example.com"
  },
  "virtual_server": {
    "id": "vs-app-example-com",
    "name": "vs-app.example.com",
    "ip_address": "192.168.1.100",
    "port": 443,
    "protocol": "https",
    "pool_id": "pool-app-example-com",
    "ssl": {
      "enabled": true,
      "certificate_id": "cert-app-example-com",
      "protocols": ["TLSv1.2", "TLSv1.3"],
      "ciphers": "ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256"
    },
    "mtls": {
      "enabled": true,
      "client_auth_type": "required",
      "client_ca_cert_id": "ca-cert-app-example-com",
      "verify_depth": 2
    },
    "http": {
      "x_forwarded_for": true,
      "x_forwarded_proto": true,
      "redirect_http_to_https": true,
      "hsts_enabled": true
    },
    "enabled": true
  },
  "pools": [
    {
      "id": "pool-app-example-com",
      "name": "pool-app.example.com",
      "members": [
        {
          "id": "server-1",
          "name": "server1.example.com",
          "ip_address": "192.168.1.101",
          "port": 8443,
          "weight": 1,
          "enabled": true
        },
        {
          "id": "server-2",
          "name": "server2.example.com",
          "ip_address": "192.168.1.102",
          "port": 8443,
          "weight": 2,
          "enabled": true
        }
      ],
      "algorithm": "round_robin",
      "monitor": {
        "type": "http",
        "interval": 5,
        "timeout": 15,
        "retries": 3,
        "http_method": "GET",
        "http_path": "/health",
        "expected_codes": "200"
      },
      "persistence": {
        "type": "cookie",
        "cookie_name": "JSESSIONID",
        "timeout": 3600
      }
    }
  ],
  "certificates": [
    {
      "id": "cert-app-example-com",
      "name": "cert-app.example.com",
      "type": "imported",
      "common_name": "app.example.com"
    },
    {
      "id": "ca-cert-app-example-com",
      "name": "ca-cert-app.example.com",
      "type": "imported",
      "content": "# Placeholder for CA certificate"
    }
  ]
}
```

### Key Features

The common schema supports advanced features including:

1. **mTLS (Mutual TLS)**:
   - Client authentication types (none, optional, required)
   - Certificate verification depth
   - CRL and OCSP validation options

2. **Persistence Models**:
   - Source IP persistence
   - Cookie-based persistence
   - Application-controlled cookies
   - HTTP header-based persistence
   - TLS session ID persistence

3. **SSL/TLS Configuration**:
   - Protocol and cipher selection
   - Server preference options
   - Session cache settings

4. **HTTP Settings**:
   - Header manipulation (X-Forwarded-For, X-Forwarded-Proto)
   - HTTPS redirection
   - HSTS configuration

## Translator Framework

The translator framework converts the standardized schema into vendor-specific configurations for different load balancer types. It consists of:

1. **Base Translator Class** (`lb_translator_base.py`): Provides common validation and deployment logic
2. **Vendor-Specific Translators**:
   - `nginx_translator.py`: Generates NGINX configuration files
   - `f5_translator.py`: Generates F5 BIG-IP AS3 JSON
   - `avi_translator.py`: Generates AVI (NSX ALB) configuration JSON
3. **Translator Factory** (`translator_factory.py`): Creates the appropriate translator based on the load balancer type

### Using the Translator Framework

```python
from common_lb_schema import CommonLBSchema
from translator_factory import TranslatorFactory

# Create standardized configuration
schema = CommonLBSchema()
standard_config = schema.create_standard_config(vip_config, servers, placement_decision)

# Get the appropriate translator
translator = TranslatorFactory.get_translator(placement_decision["lb_type"])

# Deploy the configuration
result = translator.deploy(standard_config, config_dir)
```

### Testing Translators

The `translator_test.py` script provides a comprehensive test framework for validating all translators with different configuration scenarios:

```bash
python translator_test.py
```

This will test all translators with:
- Basic HTTP configuration
- HTTPS with cookie persistence
- HTTPS with mTLS and source IP persistence

## Load Balancer Registry

The LBaaS platform now includes a registry for managing load balancer devices across your infrastructure. This is implemented in `backend_api/lb_registry_api.py` and provides:

1. **CRUD Operations for Load Balancers**:
   - List, get, create, update, and delete load balancers
   - Filter by type, datacenter, environment, and status

2. **Monitoring Endpoints**:
   - Get load balancer health status
   - Get performance metrics
   - List VIPs deployed on a load balancer

3. **Discovery Capabilities**:
   - Scan network ranges for load balancers
   - Automatically detect load balancer type and version

### Load Balancer Registry API

```
GET    /lbaas/api/lb-registry                # List all load balancers
GET    /lbaas/api/lb-registry/{id}           # Get specific load balancer
POST   /lbaas/api/lb-registry                # Register new load balancer
PUT    /lbaas/api/lb-registry/{id}           # Update load balancer
DELETE /lbaas/api/lb-registry/{id}           # Deregister load balancer
GET    /lbaas/api/lb-registry/types          # Get supported LB types
GET    /lbaas/api/lb-registry/datacenters    # Get available datacenters
GET    /lbaas/api/lb-registry/environments   # Get available environments
GET    /lbaas/api/lb-monitoring/{id}/status  # Get LB health status
GET    /lbaas/api/lb-monitoring/{id}/metrics # Get LB performance metrics
GET    /lbaas/api/lb-monitoring/{id}/vips    # List VIPs on this LB
POST   /lbaas/api/lb-discovery/scan          # Scan network range for LBs
GET    /lbaas/api/lb-discovery/jobs/{id}     # Get discovery job status
```

### UI Components

The UI design for the load balancer registry is documented in `documentation/lb_registry_ui_design.md` and includes:

1. **Load Balancer Registry Page**: CRUD operations for load balancers
2. **Load Balancer Dashboard**: Health monitoring and capacity planning
3. **Discovery Tool**: Network scanning and automatic registration
4. **Credentials Manager**: Secure storage for authentication details
5. **VIP Management Integration**: Enhanced placement logic with load balancer awareness

## API Gateway Integration

The LBaaS platform includes an API Gateway design (`backend_api/api_gateway_design.py`) that serves as an intermediary between the LBaaS platform and the actual load balancer devices. This provides:

1. **Centralized Authentication and Authorization**:
   - Secure credential storage in a vault
   - Role-based access control
   - Audit logging for all API calls

2. **Security Benefits**:
   - No direct access to load balancer management interfaces
   - Encryption of all traffic
   - Rate limiting and DDoS protection

3. **Operational Benefits**:
   - Consistent API interface regardless of backend LB type
   - Circuit breakers for reliability
   - Centralized monitoring of all API calls

### API Gateway Architecture

```
LBaaS Backend API → API Gateway → Load Balancer Devices
                      ↑
                      ↓
                 Credential Vault
```

### Using the API Gateway

```python
from api_gateway_design import ApiGatewayConfig, ApiGatewayIntegration

# Configure the API Gateway
gateway_config = ApiGatewayConfig(
    gateway_url="https://api-gateway.example.com",
    auth_enabled=True,
    ssl_verification=True
)

# Create API Gateway integration
integration = ApiGatewayIntegration(gateway_config)

# Deploy a VIP through the API Gateway
result = integration.deploy_vip(
    lb_id="f5-prod-01",
    lb_type="F5",
    credential_id="123e4567-e89b-12d3-a456-426614174000",
    standard_config=standard_config
)
```

## Integration with Existing Components

The new components integrate with the existing LBaaS platform as follows:

1. **Backend API Integration**:
   - The VIP creation/update endpoints use the common schema and translators
   - The placement logic determines which load balancer type to use
   - The API gateway handles communication with load balancer devices

2. **CMDB Integration**:
   - The load balancer registry is synchronized with the CMDB
   - Server selection is filtered based on user ownership and environment

3. **UI Integration**:
   - The VIP creation/edit pages show which load balancer will be used
   - Administrators can manage load balancers through the registry UI

## Further Development

*   **Backstage Plugin**: Develop the actual Backstage plugin to interact with the `backend_api`.
*   **Ansible Integration**: The `backend_api/integrations.py` has stubs for Ansible. This would involve creating Ansible roles/playbooks and a mechanism (e.g., `ansible-runner` in a container) for the API to trigger them.
*   **Real IPAM/ServiceNow**: Replace mock services with integrations to actual TCPwave and ServiceNow instances.
*   **Production Hardening**: Secure secrets, implement robust logging, monitoring, and error handling for all services.
*   **Unit & Integration Tests**: Develop comprehensive automated test suites for each service.
*   **API Gateway Implementation**: Implement the API gateway design for secure communication with load balancer devices.
*   **Load Balancer Registry UI**: Develop the UI components for the load balancer registry based on the design documentation.
*   **Additional Load Balancer Types**: Add support for more load balancer vendors by creating new translators.
