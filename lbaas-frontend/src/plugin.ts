import { createPlugin, createRoutableExtension } from "@backstage/core-plugin-api";
import { createApiFactory, discoveryApiRef, fetchApiRef } from "@backstage/core-plugin-api";

import { rootRouteRef, vipCreateRouteRef, vipViewRouteRef, vipEditRouteRef } from "./routes";
import { LbaasFrontendApiClient, lbaasFrontendApiRef } from "./api";

export const lbaasPlugin = createPlugin({
  id: "lbaas-frontend",
  apis: [
    createApiFactory({
      api: lbaasFrontendApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        new LbaasFrontendApiClient({ discoveryApi, fetchApi }),
    }),
  ],
  routes: {
    root: rootRouteRef,
    createVip: vipCreateRouteRef,
    viewVip: vipViewRouteRef,
    editVip: vipEditRouteRef,
  },
});

// Main page for listing VIPs
export const LbaasPage = lbaasPlugin.provide(
  createRoutableExtension({
    name: "LbaasPage",
    component: () =>
      import("./components/VipListPage").then(m => m.VipListPage),
    mountPoint: rootRouteRef,
  }),
);

// Page for creating a new VIP
export const VipCreatePageExtension = lbaasPlugin.provide(
  createRoutableExtension({
    name: "VipCreatePageExtension",
    component: () =>
      import("./components/VipCreatePage").then(m => m.VipCreatePage),
    mountPoint: vipCreateRouteRef,
  }),
);

// Page for viewing VIP details
export const VipViewPageExtension = lbaasPlugin.provide(
  createRoutableExtension({
    name: "VipViewPageExtension",
    component: () =>
      import("./components/VipViewPage").then(m => m.VipViewPage),
    mountPoint: vipViewRouteRef,
  }),
);

// Page for editing an existing VIP
export const VipEditPageExtension = lbaasPlugin.provide(
  createRoutableExtension({
    name: "VipEditPageExtension",
    component: () =>
      import("./components/VipEditPage").then(m => m.VipEditPage),
    mountPoint: vipEditRouteRef,
  }),
);

