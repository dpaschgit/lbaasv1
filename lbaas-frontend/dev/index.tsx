import React from 'react';
import { createDevApp } from '@backstage/dev-utils';
import { lbaasPlugin, LbaasPage } from '../src/plugin';

createDevApp()
  .registerPlugin(lbaasPlugin)
  .addPage({
    element: <LbaasPage />,
    title: 'VIPs', // Changed from 'Root Page' to 'VIPs'
    path: '/lbaas-frontend'
  })
  .render();