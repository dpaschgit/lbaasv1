import { createPlugin, createRoutableExtension, createApiFactory } from '@backstage/core-plugin-api';

import { rootRouteRef } from './routes';
import { lbaasFrontendApiRef, LbaasFrontendApiClient } from './api';

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
  },
});

export const LbaasFrontendPage = lbaasFrontendPlugin.provide(
  createRoutableExtension({
    name: 'LbaasFrontendPage',
    component: () =>
      import('./components/VipListPage').then(m => m.VipListPage),
    mountPoint: rootRouteRef,
  }),
);

export const LbaasFrontendViewPage = lbaasFrontendPlugin.provide(
  createRoutableExtension({
    name: 'LbaasFrontendViewPage',
    component: () =>
      import('./components/VipViewPage').then(m => m.VipViewPage),
    mountPoint: rootRouteRef,
  }),
);

export const LbaasFrontendEditPage = lbaasFrontendPlugin.provide(
  createRoutableExtension({
    name: 'LbaasFrontendEditPage',
    component: () =>
      import('./components/VipEditPage').then(m => m.VipEditPage),
    mountPoint: rootRouteRef,
  }),
);

export const LbaasFrontendCreatePage = lbaasFrontendPlugin.provide(
  createRoutableExtension({
    name: 'LbaasFrontendCreatePage',
    component: () =>
      import('./components/VipCreatePage').then(m => m.VipCreatePage),
    mountPoint: rootRouteRef,
  }),
);

// Compatibility exports for legacy code
export const lbaasPlugin = lbaasFrontendPlugin;
export const LbaasPage = LbaasFrontendPage;
