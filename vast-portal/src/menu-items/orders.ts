import { Bag2, Category } from 'iconsax-reactjs';

import { NavItemType } from 'types/menu';

/**
 * The store's own orders, which is what the portal opens on: a read of what the import job has already stored,
 * rather than the reconciliation report's live collection from every provider.
 */
const ordersMenu: NavItemType = {
  id: 'group-orders',
  title: 'orders',
  type: 'group',
  children: [
    {
      // What the portal opens on: a period read whole, before any one order in it is looked at.
      id: 'dashboard',
      title: 'dashboard',
      type: 'item',
      url: '/dashboard',
      icon: Category
    },
    {
      id: 'orders',
      title: 'orders',
      type: 'item',
      url: '/orders',
      icon: Bag2
    }
  ]
};

export default ordersMenu;
