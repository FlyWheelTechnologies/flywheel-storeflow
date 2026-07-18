# Flywheel Stock Management System — Knowledge Base

## 🏗️ Architecture Overview (Full Serverless)

The system has been migrated from a Node/SQLite prototype to a pure serverless SaaS architecture using **Supabase** and **GitHub Actions**.

- **Frontend**: React (Vite) hosted on GitHub Pages (`ims.bookflywheel.com`).
- **Backend**: Logic is contained within Supabase SQL Functions (RPC) and PostgreSQL triggers.
- **Database**: Supabase PostgreSQL with Row-Level Security (RLS).
- **Authentication**: Supabase Auth (Email/Password).

## 📊 Core Business Logic (Database Layer)

To ensure atomic transactions and data integrity, all critical business rules are handled by the database:

### 1. `record_sale_transaction` (RPC)

- Deducts stock from `products`.
- Records sale in `sales`.
- Adds line items to `sale_items`.
- Generates double-entry accounting records in `journal_entries`.

### 2. `get_daily_report` (RPC)

- Calculates high-performance financial KPIs for the dashboard (Revenue, Cash In, Expenses, Net Balance).

### 3. `handle_new_user` (Trigger)

- Automatically creates a row in the `profiles` table for every new user added to Supabase Auth.
- Defaults all new users to the `storekeeper` role for security.

## 🔑 Role-Based Access Control (RBAC)

User permissions are managed via the `profiles` table in the `role` column:

- **admin**: Full access (CRUD, User Management, Financial Reports).
- **storekeeper**: Daily operations (Stock entry, Sales recording). Cannot delete records or view high-level financial reports.
- **auditor**: Read-only access to all modules.

## 🚀 Deployment Pipeline

- **Automatic**: Pushing to the `main` branch triggers a GitHub Action.
- **Secrets**: Uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from GitHub Repository Secrets.
- **SPA Fix**: The CI build automatically copies `index.html` to `404.html` to support React Router on GitHub Pages.

## 🛠️ Maintenance & Scaling

- **Add Staff**: Add user in Supabase Auth Dashboard -> Update role in `profiles` table.
- **New Features**: Implement as SQL functions where possible to keep the frontend "dumb" and fast.
