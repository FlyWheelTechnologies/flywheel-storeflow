import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Sales from "./pages/Sales";
import Deposits from "./pages/Deposits";
import Expenses from "./pages/Expenses";
import JournalEntries from "./pages/JournalEntries";
import Logs from "./pages/Logs";
import Customers from "./pages/Customers";
import AdminSettings from "./pages/AdminSettings";
import SystemGuide from "./pages/SystemGuide";
import StoreflowAI from "./pages/StoreflowAI";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import SuperAdminNewOrg from "./pages/SuperAdminNewOrg";
import SuperAdminEditOrg from "./pages/SuperAdminEditOrg";
import SuperAdminBilling from "./pages/SuperAdminBilling";
import SuperAdminAI from "./pages/SuperAdminAI";
import SuperAdminDatabase from "./pages/SuperAdminDatabase";
import SuperAdminApiKeys from "./pages/SuperAdminApiKeys";
import SuperAdminRoute from "./components/SuperAdminRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import PageErrorFallback from "./components/PageErrorFallback";

// Wrapper to add page-level error boundaries
const withErrorBoundary = (Component, pageName) => (props) => (
  <ErrorBoundary
    fallback={(error, resetErrorBoundary) => (
      <PageErrorFallback
        error={error}
        resetErrorBoundary={resetErrorBoundary}
        pageName={pageName}
      />
    )}
  >
    <Component {...props} />
  </ErrorBoundary>
);

// Pre-create wrapped components at module scope for valid JSX usage
const SafeDashboard = withErrorBoundary(Dashboard, "Dashboard");
const SafeStoreflowAI = withErrorBoundary(StoreflowAI, "AI Assistant");
const SafeProducts = withErrorBoundary(Products, "Products");
const SafeSales = withErrorBoundary(Sales, "Sales");
const SafeCustomers = withErrorBoundary(Customers, "Customers");
const SafeDeposits = withErrorBoundary(Deposits, "Deposits");
const SafeExpenses = withErrorBoundary(Expenses, "Expenses");
const SafeJournalEntries = withErrorBoundary(JournalEntries, "Journal Entries");
const SafeLogs = withErrorBoundary(Logs, "Activity Logs");
const SafeAdminSettings = withErrorBoundary(AdminSettings, "Settings");
const SafeSystemGuide = withErrorBoundary(SystemGuide, "System Guide");
const SafeSuperAdminDashboard = withErrorBoundary(SuperAdminDashboard, "Admin Dashboard");
const SafeSuperAdminBilling = withErrorBoundary(SuperAdminBilling, "Billing");
const SafeSuperAdminNewOrg = withErrorBoundary(SuperAdminNewOrg, "New Organization");
const SafeSuperAdminEditOrg = withErrorBoundary(SuperAdminEditOrg, "Edit Organization");
const SafeSuperAdminAI = withErrorBoundary(SuperAdminAI, "Admin AI");
const SafeSuperAdminDatabase = withErrorBoundary(SuperAdminDatabase, "Database");
const SafeSuperAdminApiKeys = withErrorBoundary(SuperAdminApiKeys, "API Keys");

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute><Layout><SafeDashboard /></Layout></ProtectedRoute>} />
          <Route path="/ai" element={<ProtectedRoute><Layout><SafeStoreflowAI /></Layout></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute><Layout><SafeProducts /></Layout></ProtectedRoute>} />
          <Route path="/sales" element={<ProtectedRoute><Layout><SafeSales /></Layout></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute><Layout><SafeCustomers /></Layout></ProtectedRoute>} />
          <Route path="/deposits" element={<ProtectedRoute><Layout><SafeDeposits /></Layout></ProtectedRoute>} />
          <Route path="/expenses" element={<ProtectedRoute><Layout><SafeExpenses /></Layout></ProtectedRoute>} />
          <Route path="/reports/daily" element={<ProtectedRoute><Layout><SafeJournalEntries /></Layout></ProtectedRoute>} />
          <Route path="/logs" element={<ProtectedRoute><Layout><SafeLogs /></Layout></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Layout><SafeAdminSettings /></Layout></ProtectedRoute>} />
          <Route path="/guide" element={<ProtectedRoute><Layout><SafeSystemGuide /></Layout></ProtectedRoute>} />

          {/* Super Admin Routes */}
          <Route path="/admin" element={<SuperAdminRoute><Layout><SafeSuperAdminDashboard /></Layout></SuperAdminRoute>} />
          <Route path="/admin/billing" element={<SuperAdminRoute><Layout><SafeSuperAdminBilling /></Layout></SuperAdminRoute>} />
          <Route path="/admin/organizations/new" element={<SuperAdminRoute><Layout><SafeSuperAdminNewOrg /></Layout></SuperAdminRoute>} />
          <Route path="/admin/organizations/:id/edit" element={<SuperAdminRoute><Layout><SafeSuperAdminEditOrg /></Layout></SuperAdminRoute>} />
          <Route path="/admin/ai" element={<SuperAdminRoute><Layout><SafeSuperAdminAI /></Layout></SuperAdminRoute>} />
          <Route path="/admin/database" element={<SuperAdminRoute><Layout><SafeSuperAdminDatabase /></Layout></SuperAdminRoute>} />
          <Route path="/admin/api-keys" element={<SuperAdminRoute><Layout><SafeSuperAdminApiKeys /></Layout></SuperAdminRoute>} />

          {/* Fallback for unmatched routes to prevent blank screens */}
          <Route path="*" element={<Login />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
