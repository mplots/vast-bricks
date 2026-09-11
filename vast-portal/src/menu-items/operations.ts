import { Timer1 } from 'iconsax-reactjs';

import { NavItemType } from 'types/menu';

/** What the backend does on its own, and where a person goes to watch it or to ask for it now. */
const operationsMenu: NavItemType = {
  id: 'group-operations',
  title: 'operations',
  type: 'group',
  children: [
    {
      id: 'jobs',
      title: 'jobs',
      type: 'item',
      url: '/jobs',
      icon: Timer1
    }
  ]
};

export default operationsMenu;
