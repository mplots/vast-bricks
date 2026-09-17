import { Data, Key, Setting2 } from 'iconsax-reactjs';

import { NavItemType } from 'types/menu';

/** How a tenant sets itself up: the values it can override, the provider accounts it configures, and the keys it
 * hands to programs that call the API without a login. */
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
      id: 'provider-accounts',
      title: 'provider-accounts',
      type: 'item',
      url: '/provider-accounts',
      icon: Data
    },
    {
      id: 'api-keys',
      title: 'api-keys',
      type: 'item',
      url: '/api-keys',
      icon: Key
    }
  ]
};

export default setupMenu;
