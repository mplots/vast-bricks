import { Data, Setting2 } from 'iconsax-reactjs';

import { NavItemType } from 'types/menu';

/** How a tenant sets itself up: the values it can override, and the provider accounts it configures. */
const setupMenu: NavItemType = {
  id: 'group-setup',
  title: 'setup',
  type: 'group',
  children: [
    {
      id: 'vast-settings',
      title: 'vast-settings',
      type: 'item',
      url: '/settings',
      icon: Setting2
    },
    {
      id: 'data-sources',
      title: 'data-sources',
      type: 'item',
      url: '/data-sources',
      icon: Data
    }
  ]
};

export default setupMenu;
