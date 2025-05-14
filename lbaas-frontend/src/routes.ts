import { createRouteRef, createSubRouteRef } from "@backstage/core-plugin-api";

export const rootRouteRef = createRouteRef({
  id: "lbaas-frontend",
});

// Route for creating a new VIP
export const vipCreateRouteRef = createSubRouteRef({
  id: "lbaas-frontend-vip-create",
  parent: rootRouteRef,
  path: "/create",
});

// Route for viewing a specific VIP's details
export const vipViewRouteRef = createSubRouteRef({
  id: "lbaas-frontend-vip-view",
  parent: rootRouteRef,
  path: "/:vipId/view", // Changed from /:vipId to /:vipId/view for clarity
});

// Route for editing an existing VIP
export const vipEditRouteRef = createSubRouteRef({
  id: "lbaas-frontend-vip-edit",
  parent: rootRouteRef,
  path: "/:vipId/edit",
});

