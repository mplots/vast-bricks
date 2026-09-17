import { Box1 } from 'iconsax-reactjs';

import { NavItemType } from 'types/menu';

/** What it costs to post an order, which is reference data the backend keeps rather than anything a store owns. */
const shippingMenu: NavItemType = {
  id: 'group-shipping',
  title: 'shipping',
  type: 'group',
  children: [
    {
      id: 'shipping-prices',
      title: 'shipping-prices',
      type: 'item',
      url: '/shipping-prices',
      icon: Box1
    }
  ]
};

export default shippingMenu;
