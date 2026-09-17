import { lazy } from 'react';
import { Navigate } from 'react-router-dom';

// project-imports
import Loadable from 'components/Loadable';
import { APP_DEFAULT_PATH, SimpleLayoutType } from 'config';
import DashboardLayout from 'layout/Dashboard';
import type { PageLayout } from 'types/page';
import PagesLayout from 'layout/Pages';
import SimpleLayout from 'layout/Simple';

// pages routing
const MaintenanceError = Loadable(lazy(() => import('pages/maintenance/error/404')));
const MaintenanceError500 = Loadable(lazy(() => import('pages/maintenance/error/500')));
const MaintenanceUnderConstruction = Loadable(lazy(() => import('pages/maintenance/under-construction/under-construction')));
const MaintenanceUnderConstruction2 = Loadable(lazy(() => import('pages/maintenance/under-construction/under-construction2')));
const MaintenanceComingSoon = Loadable(lazy(() => import('pages/maintenance/coming-soon/coming-soon')));
const MaintenanceComingSoon2 = Loadable(lazy(() => import('pages/maintenance/coming-soon/coming-soon2')));

// render - sample page
const SamplePage = Loadable(lazy(() => import('pages/extra-pages/sample-page')));
const ContactUS = Loadable(lazy(() => import('pages/contact-us')));
const ProductsPage = Loadable(lazy(() => import('pages/products')));
const AccountingPage = Loadable(lazy(() => import('pages/accounting')));
const ArchivesPage = Loadable(lazy(() => import('pages/archives')));
const DashboardPage = Loadable(lazy(() => import('pages/dashboard')));
const OrdersPage = Loadable(lazy(() => import('pages/orders')));
const ReconciliationPage = Loadable(lazy(() => import('pages/reconciliation')));
const BankStatementsPage = Loadable(lazy(() => import('pages/bank-statements')));
const StripeTransactionsPage = Loadable(lazy(() => import('pages/stripe-transactions')));
const PayPalTransactionsPage = Loadable(lazy(() => import('pages/paypal-transactions')));
const JobsPage = Loadable(lazy(() => import('pages/jobs')));
const VastSettingsPage = Loadable(lazy(() => import('pages/vast-settings')));
const ProviderAccountsPage = Loadable(lazy(() => import('pages/provider-accounts')));
const ApiKeysPage = Loadable(lazy(() => import('pages/api-keys')));
const ShippingPricesPage = Loadable(lazy(() => import('pages/shipping-prices')));

// ==============================|| MAIN ROUTES ||============================== //

const MainRoutes = {
  path: '/',
  children: [
    {
      path: '/',
      element: <DashboardLayout />,
      children: [
        {
          index: true,
          element: <Navigate to={APP_DEFAULT_PATH} replace />
        },
        {
          path: 'sample-page',
          element: <SamplePage />
        },
        {
          path: 'products',
          element: <ProductsPage />
        },
        {
          path: 'accounting',
          element: <AccountingPage />
        },
        {
          path: 'archives',
          element: <ArchivesPage />
        },
        {
          path: 'dashboard',
          element: <DashboardPage />
        },
        {
          path: 'orders',
          element: <OrdersPage />,
          // A range of orders is a wide table beside a filter panel, and the range over it already names the page.
          handle: { fullWidth: true, heading: false } satisfies PageLayout
        },
        {
          path: 'reconciliation',
          element: <ReconciliationPage />,
          // A month of orders is a wide table beside a filter panel, and the trail already names the page.
          handle: { fullWidth: true, heading: false } satisfies PageLayout
        },
        {
          path: 'bank-statements',
          element: <BankStatementsPage />,
          // A statement is a wide table, and the month over it already names the page.
          handle: { fullWidth: true, heading: false } satisfies PageLayout
        },
        {
          path: 'stripe-transactions',
          element: <StripeTransactionsPage />,
          // A ledger is a wide table, and the period over it already names the page.
          handle: { fullWidth: true, heading: false } satisfies PageLayout
        },
        {
          path: 'paypal-transactions',
          element: <PayPalTransactionsPage />,
          // A ledger is a wide table, and the period over it already names the page.
          handle: { fullWidth: true, heading: false } satisfies PageLayout
        },
        {
          path: 'shipping-prices',
          element: <ShippingPricesPage />
        },
        {
          path: 'jobs',
          element: <JobsPage />
        },
        {
          path: 'settings',
          element: <VastSettingsPage />
        },
        {
          path: 'provider-accounts',
          element: <ProviderAccountsPage />
        },
        {
          path: 'api-keys',
          element: <ApiKeysPage />
        }
      ]
    },
    {
      path: '/',
      element: <SimpleLayout layout={SimpleLayoutType.SIMPLE} />,
      children: [
        {
          path: 'contact-us',
          element: <ContactUS />
        }
      ]
    },
    {
      path: '/maintenance',
      element: <PagesLayout />,
      children: [
        {
          path: '404',
          element: <MaintenanceError />
        },
        {
          path: '500',
          element: <MaintenanceError500 />
        },
        {
          path: 'under-construction',
          element: <MaintenanceUnderConstruction />
        },
        {
          path: 'under-construction2',
          element: <MaintenanceUnderConstruction2 />
        },
        {
          path: 'coming-soon',
          element: <MaintenanceComingSoon />
        },
        {
          path: 'coming-soon2',
          element: <MaintenanceComingSoon2 />
        }
      ]
    },
    { path: '*', element: <MaintenanceError /> }
  ]
};

export default MainRoutes;
