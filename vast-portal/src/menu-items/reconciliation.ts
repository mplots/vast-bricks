import { Bank, Card, DocumentText, Wallet } from 'iconsax-reactjs';

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
    },
    {
      id: 'bank-statements',
      title: 'bank-statements',
      type: 'item',
      url: '/bank-statements',
      icon: Bank
    },
    {
      id: 'stripe-transactions',
      title: 'stripe-transactions',
      type: 'item',
      url: '/stripe-transactions',
      icon: Card
    },
    {
      id: 'paypal-transactions',
      title: 'paypal-transactions',
      type: 'item',
      url: '/paypal-transactions',
      icon: Wallet
    }
  ]
};

export default reconciliationMenu;
