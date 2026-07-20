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
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import SuperAdminNewOrg from "./pages/SuperAdminNewOrg";
import SuperAdminRoute from "./components/SuperAdminRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute><Layout><Products /></Layout></ProtectedRoute>} />
        <Route path="/sales" element={<ProtectedRoute><Layout><Sales /></Layout></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute><Layout><Customers /></Layout></ProtectedRoute>} />
        <Route path="/deposits" element={<ProtectedRoute><Layout><Deposits /></Layout></ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute><Layout><Expenses /></Layout></ProtectedRoute>} />
        <Route path="/reports/daily" element={<ProtectedRoute><Layout><JournalEntries /></Layout></ProtectedRoute>} />
        <Route path="/logs" element={<ProtectedRoute><Layout><Logs /></Layout></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Layout><AdminSettings /></Layout></ProtectedRoute>} />
        <Route path="/guide" element={<ProtectedRoute><Layout><SystemGuide /></Layout></ProtectedRoute>} />
        
        {/* Super Admin Routes */}
        <Route path="/admin" element={<SuperAdminRoute><Layout><SuperAdminDashboard /></Layout></SuperAdminRoute>} />
        <Route path="/admin/organizations/new" element={<SuperAdminRoute><Layout><SuperAdminNewOrg /></Layout></SuperAdminRoute>} />
        
        {/* Fallback for unmatched routes to prevent blank screens */}
        <Route path="*" element={<Login />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
