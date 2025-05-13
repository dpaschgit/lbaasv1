# Load Balancer Self-Service Platform

This project provides a modular, containerized mock Load Balancer as a Service (LBaaS) platform. It includes a Backstage UI scaffold, a Python FastAPI backend API, mock services for TCPwave IPAM and ServiceNow CMDB/Ticketing, and translator modules for F5 (AS3), AVI, and NGINX load balancers.

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
│   └── seed_mongo.py
├── backstage_ui/           # Backstage UI application scaffold
│   └── loadbalancer-portal/
├── database/               # MongoDB setup (managed by main docker-compose.yml)
│   └── docker-compose-mongo.yml # Initial mongo-only compose file (now superseded by root docker-compose.yml)
├── documentation/
│   ├── architecture_design.md
│   └── todo.md
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

## Further Development

*   **Backstage Plugin**: Develop the actual Backstage plugin to interact with the `backend_api`.
*   **Ansible Integration**: The `backend_api/integrations.py` has stubs for Ansible. This would involve creating Ansible roles/playbooks and a mechanism (e.g., `ansible-runner` in a container) for the API to trigger them.
*   **Real IPAM/ServiceNow**: Replace mock services with integrations to actual TCPwave and ServiceNow instances.
*   **Production Hardening**: Secure secrets, implement robust logging, monitoring, and error handling for all services.
*   **Unit & Integration Tests**: Develop comprehensive automated test suites for each service.

