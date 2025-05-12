# LBaaS Platform - Testing Plan

## 1. Introduction

This document outlines the testing strategy and plan for the Load Balancer as a Service (LBaaS) platform. The goal is to ensure all components function correctly, integrate seamlessly, and meet the defined requirements before final packaging and delivery.

## 2. Testing Scope

The scope of testing includes all services developed as part of this project:

*   **Backend API Service (`backend_api`)**: Core logic, CRUD operations, authentication, authorization, and integrations.
*   **Mock TCPwave IPAM Service (`mock_tcpwave`)**: IP address management and DNS simulation.
*   **Mock ServiceNow Service (`mock_servicenow`)**: CMDB CI management and incident validation simulation.
*   **F5 AS3 Translator Service (`translator_f5`)**: AS3 JSON configuration generation.
*   **AVI Translator Service (`translator_avi`)**: AVI API configuration generation.
*   **Nginx Translator Service (`translator_nginx`)**: Nginx configuration block generation.
*   **MongoDB Database**: Data integrity and persistence.
*   **Overall Docker Compose setup**: Service orchestration and inter-service communication.

## 3. Testing Levels

### 3.1. Unit Tests

Unit tests will focus on individual functions and classes within each service. While full unit test suites are beyond the scope of automated generation in this context, key areas for manual or future automated unit testing include:

*   **Backend API**:
    *   Pydantic model validation.
    *   Authentication logic (token generation, user retrieval).
    *   Authorization logic (role-based access control).
    *   Database interaction logic (CRUD operations).
    *   Helper functions for integrations.
*   **Mock Services (TCPwave, ServiceNow)**:
    *   Endpoint request/response handling.
    *   In-memory data manipulation logic (e.g., IP allocation, CI creation).
*   **Translator Services (F5, AVI, Nginx)**:
    *   Input data model validation.
    *   Core configuration generation logic for various VIP parameters.
    *   Correct formatting of output (JSON for F5/AVI, text for Nginx).

### 3.2. Integration Tests

Integration tests will verify the interactions between different services:

*   **Backend API <-> MongoDB**: Test database connectivity, data creation, retrieval, update, and deletion.
*   **Backend API <-> Mock TCPwave**: Test IP request/release, FQDN update, and DNS resolution calls.
*   **Backend API <-> Mock ServiceNow**: Test CMDB CI creation/query and incident validation calls.
*   **Backend API <-> Translator Services**: Test calls from the backend API to each translator service, ensuring correct data passing and reception of generated configurations.

### 3.3. End-to-End (E2E) Tests

E2E tests will simulate real user scenarios from API interaction through to mock service and translator outputs. These tests will be performed manually using API client tools (e.g., Postman, curl) against the fully orchestrated Docker Compose environment.

Key E2E scenarios include:

1.  **User Authentication**: Obtain JWT token for different user roles (admin, auditor, user1, user2).
2.  **VIP Creation (Happy Path)**:
    *   Admin creates a Prod LADC VIP (should trigger AVI translator).
    *   `user1` creates a DEV NYDC VIP using their owned servers (should trigger Nginx translator).
    *   Verify IPAM interaction (mock TCPwave).
    *   Verify CMDB CI creation (mock ServiceNow).
    *   Verify correct translator is called and configuration is generated.
3.  **VIP Listing & Retrieval**:
    *   Admin lists all VIPs.
    *   `user1` lists only their VIPs.
    *   Auditor lists all VIPs.
    *   Retrieve specific VIP details by ID for different roles.
4.  **VIP Modification**:
    *   `user1` modifies their own VIP (e.g., adds a pool member) after providing a valid mock ServiceNow incident ID.
    *   Verify CMDB update and translator call for update.
5.  **VIP Deletion**:
    *   `user1` deletes their own VIP after providing a valid mock ServiceNow incident ID.
    *   Verify CMDB update/flagging and translator call for deletion.
6.  **Entitlement Checks**:
    *   `user1` attempts to modify/delete a VIP owned by `user2` (should be forbidden).
    *   `user1` attempts to create a VIP using servers not owned by them (should be forbidden - requires full implementation of server ownership check in API).
    *   Auditor attempts to create/modify/delete a VIP (should be forbidden).
    *   Attempt VIP modification/deletion without a valid ServiceNow incident ID (should fail).
    *   Attempt VIP modification/deletion with an invalid ServiceNow incident ID (should fail).
7.  **Translator Output Verification**: For selected VIP creation/modification scenarios, manually inspect the generated configuration from each translator to ensure it reflects the input parameters and adheres to vendor-specific formats and requirements (including L4/L7, persistence, monitoring).

## 4. Test Environment Setup

The test environment will be set up using Docker and Docker Compose.

1.  Ensure Docker and Docker Compose are installed.
2.  Navigate to the root of the `load_balancer_project` directory.
3.  Run `docker-compose up -d --build` to build and start all services.
4.  Run the MongoDB seed script: `docker exec -it lbaas-backend-api python seed_mongo.py` (or adjust if running locally: `python backend_api/seed_mongo.py` after activating a virtual environment with dependencies).

Services will be accessible on their mapped ports (e.g., Backend API on `localhost:8000`).

## 5. Test Data

*   **User Credentials**: Defined in `backend_api/auth.py` (admin, auditor, user1, user2; password: "testpassword").
*   **MongoDB Seed Data**: Populated by `backend_api/seed_mongo.py` (sample VIPs with different owners and configurations).
*   **Mock ServiceNow Seed Data**: Servers for `user1` and `user2` are seeded in `mock_servicenow/main.py`. Mock incident IDs `123456` (valid) and `666666` (invalid) are hardcoded for validation.
*   **Mock TCPwave Seed Data**: Default subnet and IP ranges are defined in `mock_tcpwave/main.py`.

## 6. Test Cases (High-Level Summary)

Refer to section 3.3 for key E2E scenarios. Detailed test steps for each scenario would involve:

1.  Authenticating as the specified user.
2.  Constructing the API request payload (e.g., for VIP creation).
3.  Sending the request to the appropriate backend API endpoint.
4.  Verifying the API response (status code, data).
5.  Checking logs of mock services and translator services (via `docker logs <container_name>`) to confirm interactions.
6.  Querying MongoDB or mock service APIs to verify data state changes.

## 7. Expected Results

*   All services start and run without errors in the Docker Compose environment.
*   API endpoints return correct status codes and data based on valid and invalid inputs.
*   Authentication and authorization mechanisms correctly restrict access based on user roles and ownership.
*   Integrations between the backend API and mock/translator services function as designed.
*   Translators generate plausible configurations based on input VIP data.
*   Seed data is correctly loaded and utilized for entitlement checks.
*   E2E scenarios pass as described.

## 8. Reporting (Placeholder)

For a formal project, issues found during testing would be logged in an issue tracking system with details on steps to reproduce, actual vs. expected results, and severity.

