# Load Balancer Registry UI Design

This document outlines the UI design for the Load Balancer Registry component of the LBaaS platform. The UI will provide administrators with the ability to manage, monitor, and discover load balancers across the infrastructure.

## 1. Load Balancer Registry Page

### Purpose
Provide a comprehensive view of all registered load balancers with CRUD operations.

### Layout
- **Header**: Title, search bar, and "Add Load Balancer" button
- **Filters**: Type, Datacenter, Environment, Status
- **Table View**: Sortable columns for all key attributes
- **Detail Panel**: Slides in from right when a load balancer is selected

### Table Columns
- Name
- Type (with icon)
- IP Address
- Datacenter
- Environment
- Status (with color indicator)
- Capacity (visual indicator)
- Actions (Edit, Delete, View Details)

### Add/Edit Form
- **Basic Information**:
  - Name
  - Type (dropdown)
  - Version
  - IP Address
  - Port
  - Datacenter (dropdown)
  - Environment (dropdown)
  - Status (dropdown)
- **Connectivity**:
  - Admin URL
  - API Endpoint
  - Credentials (dropdown or "Create New")
- **Capacity**:
  - Max VIPs
  - Current VIPs
  - Max Connections
  - Max Throughput
- **Advanced Attributes**:
  - Type-specific attributes in collapsible sections

## 2. Load Balancer Dashboard

### Purpose
Monitor health, performance, and capacity of load balancers.

### Layout
- **Overview Cards**: Total LBs, Active LBs, LBs in Maintenance, Alerts
- **Health Status**: Grid of load balancer status cards
- **Capacity Planning**: Bar charts showing capacity utilization
- **Performance Metrics**: Line charts for key metrics

### Health Status Cards
- Name and Type
- Status indicator
- Uptime
- CPU/Memory/Disk usage mini-charts
- Active connections
- VIP count
- Quick action buttons

### Metrics Panels
- **Time Range Selector**: Hour, Day, Week, Month
- **Throughput Chart**: Mbps over time
- **Connections Chart**: Active connections over time
- **Response Time Chart**: ms over time
- **Errors Chart**: Error count over time

## 3. Discovery Tool

### Purpose
Scan networks to automatically discover and register load balancers.

### Layout
- **Scan Configuration Form**:
  - Network Range (CIDR notation)
  - Scan Type (ping, API, SNMP)
  - Credentials to try
  - Schedule options
- **Active Scans**: Progress indicators for running scans
- **Results Table**: Discovered load balancers with confidence scores
- **Registration Panel**: Form to register selected discoveries

### Results Table Columns
- IP Address
- Port
- Detected Type
- Detected Version
- Confidence Score
- Status (New, Known, Changed)
- Actions (Register, Ignore)

## 4. Credentials Manager

### Purpose
Securely store and manage authentication details for load balancers.

### Layout
- **Credentials Table**: List of saved credentials
- **Add/Edit Form**: Form to create or update credentials
- **Usage Information**: Where each credential is being used

### Credentials Table Columns
- Name
- Type (Basic, Token, Certificate)
- Username (masked)
- Created/Updated Date
- Usage Count
- Actions (Edit, Delete, View Usage)

## 5. VIP Management Integration

### Purpose
Enhance VIP creation and management with load balancer awareness.

### Enhancements to VIP Create/Edit Pages
- **Load Balancer Selection**:
  - Auto-selected based on placement logic
  - Manual override option for admins
  - Health and capacity indicators
- **Placement Preview**:
  - Visual indication of which LB will be used
  - Explanation of placement decision
  - Warning if capacity issues exist

### VIP List Enhancements
- Add Load Balancer column
- Filter by Load Balancer
- Group by Load Balancer option

## 6. Navigation and Access Control

### Navigation Menu
- Dashboard
- Load Balancers
- VIPs
- Discovery
- Credentials
- Settings

### Role-Based Access
- **Admin**: Full access to all features
- **Operator**: View all, manage VIPs, view LBs
- **User**: View and manage own VIPs only

## 7. Responsive Design

The UI will be fully responsive, supporting:
- Desktop workstations (1920x1080 and higher)
- Laptops (1366x768 and higher)
- Tablets (portrait and landscape)
- Mobile devices (limited functionality)

## 8. Theme and Styling

The UI will follow the Backstage design system with:
- Consistent color scheme
- Clear typography hierarchy
- Accessible contrast ratios
- Consistent spacing and layout
- Meaningful icons and visual indicators

## 9. Implementation Technologies

- React for component framework
- Material-UI for UI components
- Chart.js for metrics visualization
- React Query for data fetching
- Formik for form handling
- Yup for validation
