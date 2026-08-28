import { MonitorMobbile } from 'iconsax-reactjs';

import { NavItemType } from 'types/menu';

const icons = {
  products: MonitorMobbile
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
    }
  ]
};

export default productsMenu;
