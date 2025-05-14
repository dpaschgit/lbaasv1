import React from 'react';
import { createDevApp } from '@backstage/dev-utils';
import { lbaasPlugin, LbaasPage } from '../src/plugin';

createDevApp()
  .registerPlugin(lbaasPlugin)
  .addPage({
    element: <LbaasPage />,
    title: 'Root Page',
    path: '/lbaas-frontend'
  })
  .render();

