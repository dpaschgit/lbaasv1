import { createPlugin, createRouteRef, createSubRouteRef, createRoutableExtension } from '@backstage/core-plugin-api';
import { createApiFactory } from '@backstage/core-plugin-api';
import { lbaasFrontendApiRef, LbaasFrontendApiClient } from './api';

export const rootRouteRef = createRouteRef({
  id: 'lbaas-frontend',
});

export const vipViewRouteRef = createSubRouteRef({
  id: 'lbaas-frontend-vip-view',
  parent: rootRouteRef,
  path: '/view/:fqdn',
});

export const vipEditRouteRef = createSubRouteRef({
  id: 'lbaas-frontend-vip-edit',
  parent: rootRouteRef,
  path: '/edit/:fqdn',
});

export const vipCreateRouteRef = createSubRouteRef({
  id: 'lbaas-frontend-vip-create',
  parent: rootRouteRef,
  path: '/create',
});

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
  },
});

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

// Compatibility exports for legacy code
export const lbaasPlugin = lbaasFrontendPlugin;
export const LbaasPage = LbaasFrontendPage;
