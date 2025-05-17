import React from 'react';
import { createDevApp } from '@backstage/dev-utils';
import { lbaasFrontendPlugin, LbaasFrontendPage, LbaasFrontendViewPage, LbaasFrontendEditPage, LbaasFrontendCreatePage } from '../src/plugin';

createDevApp()
  .registerPlugin(lbaasFrontendPlugin)
  .addPage({
    element: <LbaasFrontendPage />,
    title: 'Root Page',
    path: '/lbaas-frontend'
  })
  .addPage({
    element: <LbaasFrontendViewPage />,
    title: 'View VIP',
    path: '/lbaas-frontend/view/:fqdn'
  })
  .addPage({
    element: <LbaasFrontendEditPage />,
    title: 'Edit VIP',
    path: '/lbaas-frontend/edit/:fqdn'
  })
  .addPage({
    element: <LbaasFrontendCreatePage />,
    title: 'Create VIP',
    path: '/lbaas-frontend/create'
  })
  .render();
