import { rootRouteRef, vipViewRouteRef, vipEditRouteRef, vipCreateRouteRef, vipOutputRouteRef, vipPromoteRouteRef } from './plugin';
import { VipViewPage } from '../components/VipViewPage/VipViewPage';
import { VipEditPage } from '../components/VipEditPage/VipEditPage';
import { VipCreatePage } from '../components/VipCreatePage/VipCreatePage';
import { TranslatorOutputPage } from '../components/TranslatorOutputPage/TranslatorOutputPage';
import { EnvironmentPromotionPage } from '../components/EnvironmentPromotionPage/EnvironmentPromotionPage';

// Export route references for use in other parts of the application
export { 
  rootRouteRef, 
  vipViewRouteRef, 
  vipEditRouteRef, 
  vipCreateRouteRef,
  vipOutputRouteRef,
  vipPromoteRouteRef
};

// Define all routes with consistent parameter naming
export const routes = [
  // Core VIP routes
  {
    path: '/:vipId/view',
    element: <VipViewPage />
  },
  {
    path: '/:vipId/edit',
    element: <VipEditPage />
  },
  {
    path: '/create',
    element: <VipCreatePage />
  },
  // New feature routes
  {
    path: '/:vipId/output',
    element: <TranslatorOutputPage />
  },
  {
    path: '/:vipId/promote',
    element: <EnvironmentPromotionPage />
  },
];
