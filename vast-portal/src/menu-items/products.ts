import { MonitorMobbile, SearchNormal1 } from 'iconsax-reactjs';

import { NavItemType } from 'types/menu';

const icons = {
  products: MonitorMobbile,
  partFinder: SearchNormal1
};

const productsMenu: NavItemType = {
  id: 'group-products',
  title: 'products',
  type: 'group',
  children: [
    {
      id: 'products-list',
      title: 'product-list',
      type: 'item',
      url: '/products',
      icon: icons.products
    },
    {
      id: 'part-finder',
      title: 'part-finder',
      type: 'item',
      url: '/part-finder',
      icon: icons.partFinder
    }
  ]
};

export default productsMenu;
