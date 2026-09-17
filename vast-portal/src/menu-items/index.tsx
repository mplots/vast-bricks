// project-imports
import pages from './pages';
import samplePage from './sample-page';
import support from './support';
import productsMenu from './products';
import accountingMenu from './accounting';
import ordersMenu from './orders';
import reconciliationMenu from './reconciliation';
import shippingMenu from './shipping';
import operationsMenu from './operations';
import setupMenu from './setup';

// types
import { NavItemType } from 'types/menu';

// ==============================|| MENU ITEMS ||============================== //

const menuItems: { items: NavItemType[] } = {
  items: [ordersMenu, reconciliationMenu, productsMenu, accountingMenu, shippingMenu, operationsMenu, setupMenu, samplePage, pages, support]
};

export default menuItems;
