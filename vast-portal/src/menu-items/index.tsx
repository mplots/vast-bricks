// project-imports
import pages from './pages';
import samplePage from './sample-page';
import support from './support';
import productsMenu from './products';
import accountingMenu from './accounting';
import reconciliationMenu from './reconciliation';

// types
import { NavItemType } from 'types/menu';

// ==============================|| MENU ITEMS ||============================== //

const menuItems: { items: NavItemType[] } = {
  items: [reconciliationMenu, productsMenu, accountingMenu, samplePage, pages, support]
};

export default menuItems;
