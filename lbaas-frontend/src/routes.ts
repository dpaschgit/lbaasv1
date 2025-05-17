import { rootRouteRef, vipViewRouteRef, vipEditRouteRef, vipCreateRouteRef } from './plugin';

export { rootRouteRef, vipViewRouteRef, vipEditRouteRef, vipCreateRouteRef };

import { TranslatorOutputPage } from '../components/TranslatorOutputPage/TranslatorOutputPage';
import { EnvironmentPromotionPage } from '../components/EnvironmentPromotionPage/EnvironmentPromotionPage';

export const routes = [
  // Existing routes...
  {
    path: '/vips/:vipId/output',
    element: <TranslatorOutputPage />
  },
  {
    path: '/vips/:vipId/promote',
    element: <EnvironmentPromotionPage />
  },
];
