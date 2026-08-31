import { DocumentText } from 'iconsax-reactjs';

import { NavItemType } from 'types/menu';

const reconciliationMenu: NavItemType = {
  id: 'group-reconciliation',
  title: 'reconciliation',
  type: 'group',
  children: [
    {
      id: 'reconciliation-orders',
      title: 'reconciliation-orders',
      type: 'item',
      url: '/reconciliation',
      icon: DocumentText
    }
  ]
};

export default reconciliationMenu;
