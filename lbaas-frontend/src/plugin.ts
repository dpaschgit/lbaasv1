import { createPlugin, createRouteRef, createSubRouteRef, createRoutableExtension } from '@backstage/core-plugin-api';
import { createApiFactory } from '@backstage/core-plugin-api';
import { lbaasFrontendApiRef, LbaasFrontendApiClient } from './api';

// Root route reference for the plugin
export const rootRouteRef = createRouteRef({
  id: 'lbaas-frontend',
});

// Define all sub-routes with consistent parameter naming (vipId)
export const vipViewRouteRef = createSubRouteRef({
  id: 'lbaas-frontend-vip-view',
  parent: rootRouteRef,
  path: '/:vipId/view',
});

export const vipEditRouteRef = createSubRouteRef({
  id: 'lbaas-frontend-vip-edit',
  parent: rootRouteRef,
  path: '/:vipId/edit',
});

export const vipCreateRouteRef = createSubRouteRef({
  id: 'lbaas-frontend-vip-create',
  parent: rootRouteRef,
  path: '/create',
});

export const vipOutputRouteRef = createSubRouteRef({
  id: 'lbaas-frontend-vip-output',
  parent: rootRouteRef,
  path: '/:vipId/output',
});

export const vipPromoteRouteRef = createSubRouteRef({
  id: 'lbaas-frontend-vip-promote',
  parent: rootRouteRef,
  path: '/:vipId/promote',
});

// Create the plugin with API factory
export const lbaasFrontendPlugin = createPlugin({
  id: 'lbaas-frontend',
  apis: [
    createApiFactory({
      api: lbaasFrontendApiRef,
      deps: {},
      factory: () => new LbaasFrontendApiClient(),
    }),
  ],
  routes: {
    root: rootRouteRef,
    vipView: vipViewRouteRef,
    vipEdit: vipEditRouteRef,
    vipCreate: vipCreateRouteRef,
    vipOutput: vipOutputRouteRef,
    vipPromote: vipPromoteRouteRef,
  },
});

// Create routable extensions for all pages
export const LbaasFrontendPage = lbaasFrontendPlugin.provide(
  createRoutableExtension({
    name: 'LbaasFrontendPage',
    component: () =>
      import('./components/VipListPage/VipListPage').then(m => m.VipListPage),
    mountPoint: rootRouteRef,
  }),
);

export const LbaasFrontendViewPage = lbaasFrontendPlugin.provide(
  createRoutableExtension({
    name: 'LbaasFrontendViewPage',
    component: () =>
      import('./components/VipViewPage/VipViewPage').then(m => m.VipViewPage),
    mountPoint: vipViewRouteRef,
  }),
);

export const LbaasFrontendEditPage = lbaasFrontendPlugin.provide(
  createRoutableExtension({
    name: 'LbaasFrontendEditPage',
    component: () =>
      import('./components/VipEditPage/VipEditPage').then(m => m.VipEditPage),
    mountPoint: vipEditRouteRef,
  }),
);

export const LbaasFrontendCreatePage = lbaasFrontendPlugin.provide(
  createRoutableExtension({
    name: 'LbaasFrontendCreatePage',
    component: () =>
      import('./components/VipCreatePage/VipCreatePage').then(m => m.VipCreatePage),
    mountPoint: vipCreateRouteRef,
  }),
);

export const LbaasFrontendOutputPage = lbaasFrontendPlugin.provide(
  createRoutableExtension({
    name: 'LbaasFrontendOutputPage',
    component: () =>
      import('./components/TranslatorOutputPage/TranslatorOutputPage').then(m => m.TranslatorOutputPage),
    mountPoint: vipOutputRouteRef,
  }),
);

export const LbaasFrontendPromotePage = lbaasFrontendPlugin.provide(
  createRoutableExtension({
    name: 'LbaasFrontendPromotePage',
    component: () =>
      import('./components/EnvironmentPromotionPage/EnvironmentPromotionPage').then(m => m.EnvironmentPromotionPage),
    mountPoint: vipPromoteRouteRef,
  }),
);

// Compatibility exports for legacy code
export const lbaasPlugin = lbaasFrontendPlugin;
export const LbaasPage = LbaasFrontendPage;
