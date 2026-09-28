import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  SquaresFour,
  Receipt,
  Package,
  BookOpen,
  Gear,
  CreditCard,
  Plus,
  Database,
  Key,
  ArrowsClockwise
} from "@phosphor-icons/react";
import { useAuth } from "../context/AuthContext";
import "./Sidebar.css";

const NAV_ITEMS = [
  {
    id: "dashboard", label: "Dashboard", path: "/dashboard",
    icon: <SquaresFour size={18} weight="duotone" />,
  },

  {
    id: "sales", label: "Sales",
    icon: <Receipt size={18} weight="duotone" />,
    children: [
      { id: "sales-list", label: "Sales Records", path: "/sales" },
      { id: "customers-list", label: "Customers", path: "/customers" },
    ],
  },
  {
    id: "stock", label: "Stock",
    icon: <Package size={18} weight="duotone" />,
    children: [
      { id: "products", label: "Products", path: "/products" },
    ],
  },
  {
    id: "accounting", label: "Accounting",
    icon: <BookOpen size={18} weight="duotone" />,
    children: [
      { id: "daily-report", label: "Entries", path: "/reports/daily", roles: ['admin', 'auditor'] },
      { id: "expenses", label: "Expenses", path: "/expenses", roles: ['admin', 'auditor'] },
      { id: "deposits", label: "Deposits", path: "/deposits" },
    ],
  },
  {
    id: "admin", label: "Admin", roles: ['admin', 'super_admin'],
    icon: <Gear size={18} weight="duotone" />,
    children: [
      { id: "staff-settings", label: "Users & Roles", path: "/settings?tab=staff" },
      { id: "org-settings", label: "Store & Tax Profile", path: "/settings?tab=organization" },
      { id: "logs", label: "System Logs", path: "/logs" },
    ],
  },
];

const SUPER_ADMIN_NAV_ITEMS = [
  {
    id: "super-dashboard", label: "Admin Console", path: "/admin",
    icon: <SquaresFour size={18} weight="duotone" />,
  },
  {
    id: "super-billing", label: "Billing & MRR", path: "/admin/billing",
    icon: <CreditCard size={18} weight="duotone" />,
  },
  {
    id: "super-new-org", label: "+ New Business", path: "/admin/organizations/new",
    icon: <Plus size={18} weight="bold" />,
  },

  {
    id: "super-database", label: "Database Health", path: "/admin/database",
    icon: <Database size={18} weight="duotone" />,
  },
  {
    id: "super-apikeys", label: "API Keys & Telemetry", path: "/admin/api-keys",
    icon: <Key size={18} weight="duotone" />,
  }
];

export default function Sidebar({ collapsed, onToggle }) {
  const { user, activeOrg, impersonatedOrg } = useAuth();
  const [openMenus, setOpenMenus] = useState(() => {
    const cached = localStorage.getItem("sidebar_open_menus");
    return cached ? JSON.parse(cached) : { sales: true, stock: true, accounting: true, admin: true };
  });
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const displayCollapsed = isMobile && collapsed;

  // Save menu state
  useEffect(() => {
    localStorage.setItem("sidebar_open_menus", JSON.stringify(openMenus));
  }, [openMenus]);

  // Smart Auto-expansion: Open parent menu of current active route
  useEffect(() => {
    if (!displayCollapsed) {
      const currentFull = location.pathname + (location.search || "");
      NAV_ITEMS.forEach(item => {
        if (item.children?.some(c => c.path.includes("?") ? currentFull === c.path : (location.pathname === c.path || (c.path !== "/" && location.pathname.startsWith(c.path + "/"))))) {
          setOpenMenus(prev => ({ ...prev, [item.id]: true }));
        }
      });
    }
  }, [location.pathname, location.search, displayCollapsed]);

  // Click outside closes sidebar on mobile
  useEffect(() => {
    const handleClickOutside = (event) => {
      const sidebar = document.querySelector('.sidebar');
      if (sidebar && !sidebar.contains(event.target)) {
        if (!sidebar.classList.contains('sidebar--collapsed') && window.innerWidth <= 768) {
          onToggle();
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [onToggle]);

  const handleNav = (path) => {
    navigate(path);
    if (window.innerWidth <= 768 && !collapsed) {
      onToggle();
    }
  };

  const toggleMenu = (id) => setOpenMenus(prev => ({ ...prev, [id]: !prev[id] }));
  const isActive = (path) => {
    if (!path) return false;
    const currentFull = location.pathname + (location.search || "");
    if (path.includes("?")) {
      return currentFull === path;
    }
    return location.pathname === path || (path !== "/" && location.pathname.startsWith(path + "/"));
  };

  const isParentActive = (item) => {
    // Parent is active if any of its children are active
    return item.children?.some(child => isActive(child.path));
  };

  const filteredItems = NAV_ITEMS.filter(item => {
    if (item.roles && !item.roles.includes(user?.role)) return false;
    return true;
  }).map(item => {
    if (item.children) {
      return {
        ...item,
        children: item.children.filter(child => !child.roles || child.roles.includes(user?.role))
      };
    }
    return item;
  });

  const itemsToRender = (user?.role === 'super_admin' && !impersonatedOrg)
    ? SUPER_ADMIN_NAV_ITEMS
    : filteredItems;

  return (
    <aside 
      className={`sidebar ${displayCollapsed ? "sidebar--collapsed" : ""}`}
      onClick={() => {
        if (displayCollapsed && window.innerWidth <= 768) {
          onToggle();
        }
      }}
    >

      <div className="sidebar__logo">
        <div className="sidebar__logo-icon">
          <img src={activeOrg?.logo_url || "/logo.png"} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        {!displayCollapsed && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: -4 }}>Powered by</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
              <span className="sidebar__logo-text">Flywheel </span>
              <button 
                onClick={() => window.location.reload()} 
                style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#6b7280', transition: 'color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#f97316'}
                onMouseLeave={e => e.currentTarget.style.color = '#6b7280'}
                title="Refresh Data"
              >
                <ArrowsClockwise size={13} weight="bold" />
              </button>
            </div>
          </div>
        )}
      </div>

      <nav className="sidebar__nav">
        {itemsToRender.map(item =>
          item.children ? (
            <div key={item.id} className="sidebar__group">
              <div
                className={`sidebar__item sidebar__item--parent ${isParentActive(item) ? "sidebar__item--active" : ""}`}
                title={displayCollapsed ? item.label : ""}
              >
                <span className="sidebar__icon">{item.icon}</span>
                {!displayCollapsed && (
                  <span className="sidebar__label">{item.label}</span>
                )}
              </div>
              {!displayCollapsed && (
                <div 
                  className="sidebar__children-wrapper sidebar__children-wrapper--open"
                  aria-hidden={false}
                >
                  <div className="sidebar__children">
                    {item.children.map(child => (
                      <button key={child.id} className={`sidebar__child ${isActive(child.path) ? "sidebar__child--active" : ""}`} onClick={() => handleNav(child.path)}>
                        {child.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button key={item.id} className={`sidebar__item ${isActive(item.path) ? "sidebar__item--active" : ""}`} onClick={() => handleNav(item.path)} title={displayCollapsed ? item.label : ""}>
              <span className="sidebar__icon">{item.icon}</span>
              {!displayCollapsed && <span className="sidebar__label">{item.label}</span>}
            </button>
          )
        )}
      </nav>
      {!displayCollapsed && (
        <div className="sidebar__footer">
          <button className="sidebar__footer-link" onClick={() => handleNav('/guide')}>
            System guide and Terms
          </button>
        </div>
      )}
    </aside>
  );
}
