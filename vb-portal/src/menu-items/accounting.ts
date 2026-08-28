import { Archive, DocumentText } from 'iconsax-reactjs';

import { NavItemType } from 'types/menu';

const accountingMenu: NavItemType = {
  id: 'group-accounting',
  title: 'accounting',
  type: 'group',
  children: [
    {
      id: 'accounting-orders',
      title: 'accounting-orders',
      type: 'item',
      url: '/accounting',
      icon: DocumentText
    },
    {
      id: 'archives',
      title: 'archives',
      type: 'item',
      url: '/archives',
      icon: Archive
    }
  ]
};

export default accountingMenu;
