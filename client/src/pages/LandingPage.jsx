import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { 
  Package, 
  TrendingUp, 
  Receipt, 
  Bell, 
  Users, 
  Shield, 
  ArrowRight, 
  Phone 
} from "lucide-react";
const orangeReceiptMachine = "/orange_receipt_machine.jpg";
import productDashboardScreenshot from "../assets/product_dashboard_screenshot.png";
import "./LandingPage.css";

/* ─── Star Rating ─── */
const Stars = () => (
  <div className="lp-testimonial-stars">
    {[...Array(5)].map((_, i) => <span key={i}>★</span>)}
  </div>
);

/* ─── Feature Data ─── */
const features = [
  {
    icon: <Package size={22} />,
    color: "orange",
    title: "Real-time stock tracking",
    desc: "Know exactly what you have, what's selling fast, and what needs restocking — updated the moment a sale happens."
  },
  {
    icon: <TrendingUp size={22} />,
    color: "green",
    title: "Automatic bookkeeping",
    desc: "Every sale, expense, and deposit is recorded with proper accounting entries. Your books balance themselves."
  },
  {
    icon: <Receipt size={22} />,
    color: "purple",
    title: "Instant receipts",
    desc: "Generate professional PDF receipts for your customers instantly, or share them directly via WhatsApp."
  },
  {
    icon: <Bell size={22} />,
    color: "amber",
    title: "Low stock alerts",
    desc: "Set custom thresholds for each product. You'll be notified before items run out, so you never lose a sale."
  },
  {
    icon: <Users size={22} />,
    color: "blue",
    title: "Team access control",
    desc: "Give your staff the access they need — storekeepers manage stock, managers see reports, you stay in control."
  },
  {
    icon: <Shield size={22} />,
    color: "teal",
    title: "Secure and reliable",
    desc: "Your data is protected, backed up, and isolated. Only your team can see your business information."
  }
];

/* ─── Testimonial Data ─── */
const testimonials = [
  {
    text: "Before StoreFlow, we used notebooks to track everything. Now I can check my stock levels from my phone while I'm away from the shop. It's changed how I run my business.",
    name: "Florence Yeboah",
    role: "Owner, FlorzyAngel Hardware, Sunyani",
    initials: "FY"
  },
  {
    text: "My accountant used to spend two full days sorting through receipts every month. Now the books are always up to date. StoreFlow has saved us serious time and money.",
    name: "Kwame Mensah",
    role: "Director, KM Building Supplies, Accra",
    initials: "KM"
  },
  {
    text: "The low stock alerts alone have paid for the system. I used to lose sales because I didn't know items had run out. That doesn't happen anymore.",
    name: "Adwoa Frimpong",
    role: "Manager, Frimpong Cosmetics, Takoradi",
    initials: "AF"
  }
];

/* ═══════════════════════════════════════
   LANDING PAGE COMPONENT
   ═══════════════════════════════════════ */
export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showPhone, setShowPhone] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedFeatures, setExpandedFeatures] = useState({});
  
  /* ─── Scroll Reappear Header & Chat State ─── */
  const [headerVisible, setHeaderVisible] = useState(true);
  const [chatVisible, setChatVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const [screenshotTransform, setScreenshotTransform] = useState({ y: 0, scale: 1, opacity: 1 });

  /* ─── WhatsApp Chat Bubble Expansion ─── */
  const [chatExpanded, setChatExpanded] = useState(true);
  const chatContractTimerRef = useRef(null);

  /* Contract WhatsApp label after 4s */
  useEffect(() => {
    chatContractTimerRef.current = setTimeout(() => {
      setChatExpanded(false);
    }, 4000);
    return () => {
      if (chatContractTimerRef.current) clearTimeout(chatContractTimerRef.current);
    };
  }, []);

  const handleWhatsAppClick = (e) => {
    if (!chatExpanded) {
      e.preventDefault(); // Don't open link on first tap, just expand!
      setChatExpanded(true);
      
      if (chatContractTimerRef.current) clearTimeout(chatContractTimerRef.current);
      chatContractTimerRef.current = setTimeout(() => {
        setChatExpanded(false);
      }, 5000);
    }
  };

  /* Scroll Listener */
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const lastScrollY = lastScrollYRef.current;
      
      // Always show at the top of the page
      if (currentScrollY <= 80) {
        setHeaderVisible(true);
        setChatVisible(true);
      } else {
        if (currentScrollY > lastScrollY) {
          // Scroll down -> hide
          setHeaderVisible(false);
          setChatVisible(false);
        } else {
          // Scroll up -> show
          setHeaderVisible(true);
          setChatVisible(true);
        }
      }
      
      // Parallax effect on the hero screenshot
      if (currentScrollY < 1200) {
        const factor = Math.min(currentScrollY / 900, 1);
        setScreenshotTransform({
          y: factor * -140, // Translate up by 140px
          scale: 1 - factor * 0.05, // Animate out slightly
          opacity: 1 - factor * 0.4 // Fade out slightly
        });
      }

      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* ─── Interactive Playground State ─── */
  const [activePlaygroundTab, setActivePlaygroundTab] = useState("pos");
  const [stockLevels, setStockLevels] = useState({
    cement: 14,
    ironRods: 8,
    pvcPipes: 3
  });
  const [salesHistory, setSalesHistory] = useState([
    { id: "INV-103", item: "Roofing Sheets", qty: 2, total: 450, time: "10 mins ago" }
  ]);
  const [ledgerEntries, setLedgerEntries] = useState([
    { account: "Cash", type: "debit", amount: 450, desc: "Sale #INV-103" },
    { account: "Revenue", type: "credit", amount: 450, desc: "Sale #INV-103" }
  ]);
  const [momoSuccess, setMomoSuccess] = useState(false);
  const [showSimAlert, setShowSimAlert] = useState(false);

  /* Scroll Fade-In Handler */
  const featuresRef = useRef(null);
  const showcaseRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1 }
    );

    const fEl = featuresRef.current;
    const sEl = showcaseRef.current;

    if (fEl) observer.observe(fEl);
    if (sEl) observer.observe(sEl);

    return () => {
      if (fEl) observer.unobserve(fEl);
      if (sEl) observer.unobserve(sEl);
    };
  }, []);

  const toggleFeature = (index) => {
    setExpandedFeatures(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  /* Simulate Selling an Item in the POS widget */
  const handleSimulateSale = (itemKey, name, price) => {
    if (stockLevels[itemKey] <= 0) return;
    
    // Decrement stock
    const newStock = stockLevels[itemKey] - 1;
    setStockLevels(prev => ({
      ...prev,
      [itemKey]: newStock
    }));

    // Add sale history
    const invId = `INV-${Math.floor(100 + Math.random() * 900)}`;
    const newSale = {
      id: invId,
      item: name,
      qty: 1,
      total: price,
      time: "Just now"
    };
    setSalesHistory(prev => [newSale, ...prev.slice(0, 3)]);

    // Add Ledger entries (Double-entry)
    const newLedger = [
      { account: "Momo Wallet / Cash", type: "debit", amount: price, desc: `Sale #${invId}` },
      { account: "Revenue", type: "credit", amount: price, desc: `Sale #${invId}` }
    ];
    setLedgerEntries(prev => [...newLedger, ...prev.slice(0, 4)]);

    // Show temporary simulator success alert
    setMomoSuccess(true);
    setTimeout(() => setMomoSuccess(false), 3000);

    // If stock gets low, trigger simulator stock alert
    if (newStock <= 5) {
      setShowSimAlert(true);
      setTimeout(() => setShowSimAlert(false), 5000);
    }
  };

  /* Simulate Restocking an Item */
  const handleSimulateRestock = (itemKey) => {
    setStockLevels(prev => ({
      ...prev,
      [itemKey]: prev[itemKey] + 15
    }));
  };

  return (
    <div className="lp">
      {/* ─── WHATSAPP FLOATING CHAT BUBBLE ─── */}
      <a 
        href="https://wa.me/233200645732?text=Hello%20StoreFlow%2C%20I%20would%20like%20to%20know%20more%20about%20setting%20up%20my%20store!" 
        target="_blank" 
        rel="noopener noreferrer" 
        className={`lp-whatsapp-chat ${chatVisible ? "visible" : "hidden"} ${chatExpanded ? "expanded" : "contracted"}`}
        onClick={handleWhatsAppClick}
      >
        <div className="lp-whatsapp-icon-bubble">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.504-5.731-1.464L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.725 1.45 5.58-.003 10.118-4.542 10.121-10.125.002-2.707-1.051-5.251-2.96-7.163C16.623 1.405 14.08 0.351 11.37 0.351c-5.58 0-10.119 4.54-10.122 10.126-.001 1.794.475 3.547 1.38 5.095L1.64 21.758l6.233-1.636c1.472.8 3.03 1.2 4.67 1.2h.104zM17.18 14.36c-.3-.15-1.782-.88-2.057-.98-.275-.1-.475-.15-.675.15-.2.3-.775.98-.95 1.18-.175.2-.35.225-.65.075-.3-.15-1.264-.467-2.41-1.49-1.055-.94-1.767-2.1-1.974-2.455-.207-.355-.022-.547.127-.696.135-.133.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.675-1.625-.925-2.225-.244-.588-.492-.51-.675-.52-.175-.008-.375-.01-.575-.01-.2 0-.525.075-.8.375-.275.3-1.05 1.025-1.05 2.5 0 1.475 1.075 2.9 1.225 3.1.15.2 2.11 3.22 5.11 4.52.714.31 1.27.496 1.703.633.714.227 1.365.195 1.88.118.574-.085 1.78-.727 2.03-1.43.25-.702.25-1.3.175-1.43-.075-.127-.275-.202-.575-.352z"/>
          </svg>
        </div>
        <span className="lp-whatsapp-text">Chat on WhatsApp</span>
      </a>

      {/* ─── HEADER ─── */}
      <header className={`lp-header ${headerVisible ? "visible" : "hidden"}`}>
        <div className="lp-header-inner">
          <Link to="/" className="lp-brand">
            <span className="lp-brand-name">
              Store<span className="lp-brand-accent">Flow</span>
            </span>
            <span className="lp-brand-sub">by Flywheel</span>
          </Link>

          <nav className="lp-nav">
            <a href="#features">Features</a>
            <a href="#playground">Try Live Demo</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#reviews">Reviews</a>
          </nav>

          <div className="lp-header-actions">
            {user ? (
              <button className="lp-btn lp-btn-primary" onClick={() => navigate("/dashboard")}>
                Dashboard <ArrowRight className="btn-arrow" />
              </button>
            ) : (
              <button className="lp-btn lp-btn-primary" onClick={() => navigate("/login")}>
                Sign In <ArrowRight className="btn-arrow" />
              </button>
            )}
          </div>

          <button 
            className="lp-mobile-toggle" 
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Toggle menu"
          >
            <span /><span /><span />
          </button>
        </div>
      </header>

      {/* ─── MOBILE NAV DRAWER ─── */}
      <div className={`lp-mobile-drawer ${mobileMenuOpen ? "open" : ""}`}>
        <div className="lp-mobile-drawer-overlay" onClick={() => setMobileMenuOpen(false)} />
        <div className="lp-mobile-drawer-content">
          <div className="lp-mobile-drawer-header">
            <Link to="/" className="lp-brand" onClick={() => setMobileMenuOpen(false)}>
              <span className="lp-brand-name">
                Store<span className="lp-brand-accent">Flow</span>
              </span>
            </Link>
            <button className="lp-mobile-drawer-close" onClick={() => setMobileMenuOpen(false)}>
              ✕
            </button>
          </div>
          <nav className="lp-mobile-nav-links">
            <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#playground" onClick={() => setMobileMenuOpen(false)}>Live Demo</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
            <a href="#reviews" onClick={() => setMobileMenuOpen(false)}>Reviews</a>
          </nav>
          <div className="lp-mobile-drawer-footer">
            {user ? (
              <button className="lp-btn lp-btn-primary lp-btn-full" onClick={() => { setMobileMenuOpen(false); navigate("/dashboard"); }}>
                Dashboard
              </button>
            ) : (
              <button className="lp-btn lp-btn-primary lp-btn-full" onClick={() => { setMobileMenuOpen(false); navigate("/login"); }}>
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── HERO WITH BACKGROUND IMAGE ─── */}
      <section className="lp-hero" style={{ backgroundImage: `linear-gradient(rgba(26, 26, 46, 0.75), rgba(26, 26, 46, 0.85)), url(${orangeReceiptMachine})` }}>
        <div className="lp-hero-inner">
          <div className="lp-hero-badge">
            <span className="lp-hero-badge-dot" />
            Built for modern Ghanaian businesses
          </div>

          <h1>
            Run your store with<br />
            <span className="lp-highlight">absolute clarity</span>
          </h1>

          <p className="lp-hero-desc">
            An elegant system to manage your stock, handle transactions, balance your accounts, and send receipts. Crafted to feel fast, secure, and professional.
          </p>

          <div className="lp-hero-ctas">
            <button 
              className="lp-btn lp-btn-primary lp-btn-lg" 
              onClick={() => navigate(user ? "/dashboard" : "/login")}
            >
              {user ? "Go to Dashboard" : "Enter Platform"} <ArrowRight className="btn-arrow" />
            </button>
            <a href="#playground" className="lp-btn lp-btn-secondary lp-btn-lg">
              Try the Interactive Demo
            </a>
          </div>
        </div>
      </section>

      {/* ─── PRODUCT SCREENSHOT ─── */}
      <section className="lp-product-screenshot-section">
        <div className="lp-container">
          <div 
            className="lp-hero-product"
            onClick={() => {
              const el = document.getElementById("playground");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
            style={{
              transform: `translateY(${screenshotTransform.y}px) scale(${screenshotTransform.scale})`,
              opacity: screenshotTransform.opacity,
              transition: 'transform 0.1s ease-out, opacity 0.15s ease-out'
            }}
          >
            <img 
              src={productDashboardScreenshot} 
              alt="StoreFlow premium product dashboard interface screenshot" 
              loading="eager"
            />
            <div className="lp-screenshot-overlay">
              Run your business from your phone. Click to play with our product.
            </div>
          </div>
        </div>
      </section>

      {/* ─── TRUST STRIP ─── */}
      <section className="lp-trust">
        <div className="lp-trust-inner">
          <div className="lp-trust-item">
            <div className="lp-trust-number">250+</div>
            <div className="lp-trust-label">Stores onboarded</div>
          </div>
          <div className="lp-trust-item">
            <div className="lp-trust-number">GHS 4.2M+</div>
            <div className="lp-trust-label">Sales processed</div>
          </div>
          <div className="lp-trust-item">
            <div className="lp-trust-number">99.99%</div>
            <div className="lp-trust-label">System uptime</div>
          </div>
          <div className="lp-trust-item">
            <div className="lp-trust-number">100%</div>
            <div className="lp-trust-label">Data segregation & privacy</div>
          </div>
        </div>
      </section>

      {/* ─── INTERACTIVE DASHBOARD SIMULATOR ─── */}
      <section id="playground" className="lp-playground-section" ref={showcaseRef}>
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-section-label">Live Interactive Simulator</span>
            <h2 className="lp-section-title">Experience the platform right now</h2>
            <p className="lp-section-desc">
              Click the buttons in our mock screen below to record a sale or restock items. Watch how the stock updates and the double-entry accounting journal posts automatically.
            </p>
          </div>

          <div className="lp-simulator-widget">
            <div className="lp-simulator-header">
              <div className="lp-simulator-dots">
                <span className="dot red" />
                <span className="dot yellow" />
                <span className="dot green" />
              </div>
              <div className="lp-simulator-title">StoreFlow — Interactive Live Preview</div>
              <div className="lp-simulator-status">
                <span className="live-pulse" /> SIMULATOR ACTIVE
              </div>
            </div>

            <div className="lp-simulator-body">
              {/* Simulator Navigation */}
              <div className="lp-simulator-sidebar">
                <button 
                  className={`lp-sim-nav-item ${activePlaygroundTab === "pos" ? "active" : ""}`}
                  onClick={() => setActivePlaygroundTab("pos")}
                >
                  <div className="lp-sim-icon-bubble pos"><Receipt size={16} /></div>
                  <span>1. Point of Sale</span>
                </button>
                <button 
                  className={`lp-sim-nav-item ${activePlaygroundTab === "stock" ? "active" : ""}`}
                  onClick={() => setActivePlaygroundTab("stock")}
                >
                  <div className="lp-sim-icon-bubble stock"><Package size={16} /></div>
                  <span>2. Stock Levels</span>
                </button>
                <button 
                  className={`lp-sim-nav-item ${activePlaygroundTab === "ledger" ? "active" : ""}`}
                  onClick={() => setActivePlaygroundTab("ledger")}
                >
                  <div className="lp-sim-icon-bubble ledger"><TrendingUp size={16} /></div>
                  <span>3. Ledger Books</span>
                </button>
              </div>

              {/* Simulator Content Area */}
              <div className="lp-simulator-content">
                {activePlaygroundTab === "pos" && (
                  <div className="lp-sim-tab-view animate-fade-in">
                    <h4>Sell Items instantly</h4>
                    <p className="sim-sub">Click an item below to simulate a live customer purchase at your checkout counter.</p>
                    
                    <div className="lp-sim-items-grid">
                      <div className="lp-sim-item-card">
                        <h5>Cement (50kg)</h5>
                        <p className="price">GHS 120.00</p>
                        <p className="stock">Stock: {stockLevels.cement} bags</p>
                        <button 
                          className="lp-btn lp-btn-primary lp-btn-full"
                          onClick={() => handleSimulateSale("cement", "Cement (50kg)", 120)}
                          disabled={stockLevels.cement <= 0}
                        >
                          {stockLevels.cement > 0 ? "Sell 1 Bag" : "Out of Stock"}
                        </button>
                      </div>

                      <div className="lp-sim-item-card">
                        <h5>Iron Rods (16mm)</h5>
                        <p className="price">GHS 85.00</p>
                        <p className="stock">Stock: {stockLevels.ironRods} rods</p>
                        <button 
                          className="lp-btn lp-btn-primary lp-btn-full"
                          onClick={() => handleSimulateSale("ironRods", "Iron Rods (16mm)", 85)}
                          disabled={stockLevels.ironRods <= 0}
                        >
                          {stockLevels.ironRods > 0 ? "Sell 1 Rod" : "Out of Stock"}
                        </button>
                      </div>

                      <div className="lp-sim-item-card">
                        <h5>PVC Pipes (10ft)</h5>
                        <p className="price">GHS 45.00</p>
                        <p className="stock">Stock: {stockLevels.pvcPipes} pipes</p>
                        <button 
                          className="lp-btn lp-btn-primary lp-btn-full"
                          onClick={() => handleSimulateSale("pvcPipes", "PVC Pipes (10ft)", 45)}
                          disabled={stockLevels.pvcPipes <= 0}
                        >
                          {stockLevels.pvcPipes > 0 ? "Sell 1 Pipe" : "Out of Stock"}
                        </button>
                      </div>
                    </div>

                    {momoSuccess && (
                      <div className="lp-sim-success-alert animate-fade-in">
                        <span>✓</span> Sale recorded! WhatsApp invoice sent & double-entry journal balance updated.
                      </div>
                    )}
                  </div>
                )}

                {activePlaygroundTab === "stock" && (
                  <div className="lp-sim-tab-view animate-fade-in">
                    <h4>Stock Levels & Threshold Alerts</h4>
                    <p className="sim-sub">Track stock count. When inventory falls below thresholds, automatic system alerts are triggered.</p>
                    
                    <div className="lp-sim-stock-list">
                      <div className="lp-sim-stock-row">
                        <div className="item-info">
                          <span className="name">Cement (50kg)</span>
                          <span className={`status-pill ${stockLevels.cement > 5 ? "healthy" : "low"}`}>
                            {stockLevels.cement > 5 ? "Healthy" : "Low Stock Alert"}
                          </span>
                        </div>
                        <div className="progress-container">
                          <div className={`progress-bar ${stockLevels.cement > 5 ? "green" : "red"}`} style={{ width: `${Math.min(stockLevels.cement * 6, 100)}%` }} />
                        </div>
                        <div className="actions">
                          <span>{stockLevels.cement} bags</span>
                          <button className="lp-btn lp-btn-secondary" onClick={() => handleSimulateRestock("cement")}>Restock</button>
                        </div>
                      </div>

                      <div className="lp-sim-stock-row">
                        <div className="item-info">
                          <span className="name">Iron Rods (16mm)</span>
                          <span className={`status-pill ${stockLevels.ironRods > 5 ? "healthy" : "low"}`}>
                            {stockLevels.ironRods > 5 ? "Healthy" : "Low Stock Alert"}
                          </span>
                        </div>
                        <div className="progress-container">
                          <div className={`progress-bar ${stockLevels.ironRods > 5 ? "green" : "red"}`} style={{ width: `${Math.min(stockLevels.ironRods * 10, 100)}%` }} />
                        </div>
                        <div className="actions">
                          <span>{stockLevels.ironRods} rods</span>
                          <button className="lp-btn lp-btn-secondary" onClick={() => handleSimulateRestock("ironRods")}>Restock</button>
                        </div>
                      </div>

                      <div className="lp-sim-stock-row">
                        <div className="item-info">
                          <span className="name">PVC Pipes (10ft)</span>
                          <span className={`status-pill ${stockLevels.pvcPipes > 5 ? "healthy" : "low"}`}>
                            {stockLevels.pvcPipes > 5 ? "Healthy" : "Low Stock Alert"}
                          </span>
                        </div>
                        <div className="progress-container">
                          <div className={`progress-bar ${stockLevels.pvcPipes > 5 ? "green" : "red"}`} style={{ width: `${Math.min(stockLevels.pvcPipes * 12, 100)}%` }} />
                        </div>
                        <div className="actions">
                          <span>{stockLevels.pvcPipes} pipes</span>
                          <button className="lp-btn lp-btn-secondary" onClick={() => handleSimulateRestock("pvcPipes")}>Restock</button>
                        </div>
                      </div>
                    </div>

                    {showSimAlert && (
                      <div className="lp-sim-danger-alert animate-fade-in">
                        ⚠️ Low stock email notification dispatched to Administrator!
                      </div>
                    )}
                  </div>
                )}

                {activePlaygroundTab === "ledger" && (
                  <div className="lp-sim-tab-view animate-fade-in">
                    <h4>Automated Balanced Bookkeeping</h4>
                    <p className="sim-sub">No manual entries. Every action triggers balancing credit/debit transactions instantly.</p>
                    
                    <div className="lp-sim-ledger-view">
                      <table className="lp-demo-table">
                        <thead>
                          <tr>
                            <th>Account</th>
                            <th>Entry Type</th>
                            <th>Amount</th>
                            <th>Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ledgerEntries.map((entry, index) => (
                            <tr key={index}>
                              <td className="mono">{entry.account}</td>
                              <td>
                                <span className={`entry-type-badge ${entry.type}`}>
                                  {entry.type.toUpperCase()}
                                </span>
                              </td>
                              <td className="mono">GHS {entry.amount.toFixed(2)}</td>
                              <td>{entry.desc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURES (ACCORDIONS) ─── */}
      <section id="features" className="lp-features" ref={featuresRef}>
        <div className="lp-section-header">
          <span className="lp-section-label">Core Capabilities</span>
          <h2 className="lp-section-title">Complete control of your operations</h2>
          <p className="lp-section-desc">
            StoreFlow brings speed, accuracy, and double-entry rigor to your shop without the complexity of traditional accounting software.
          </p>
        </div>

        <div className="lp-features-grid">
          {features.map((f, i) => {
            const isExpanded = !!expandedFeatures[i];
            return (
              <div 
                key={i} 
                className={`lp-feature-card lp-feature-accordion ${isExpanded ? "expanded" : ""}`}
                onClick={() => toggleFeature(i)}
                style={{ cursor: "pointer" }}
              >
                <div className="lp-feature-card-header">
                  <div className={`lp-feature-icon ${f.color}`}>{f.icon}</div>
                  <h3 className="lp-feature-title">{f.title}</h3>
                  <span className="lp-feature-chevron">
                    {isExpanded ? "−" : "+"}
                  </span>
                </div>
                <div className={`lp-feature-desc-container ${isExpanded ? "open" : ""}`}>
                  <p className="lp-feature-desc">{f.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" className="lp-how">
        <div className="lp-section-header">
          <span className="lp-section-label">How It Works</span>
          <h2 className="lp-section-title">Onboarding is quick and simple</h2>
          <p className="lp-section-desc">
            We handle the setup. You run the business.
          </p>
        </div>

        <div className="lp-how-grid">
          <div className="lp-how-step">
            <div className="lp-how-number">1</div>
            <h3 className="lp-how-title">1. Consult on your plan</h3>
            <p className="lp-how-desc">
              We determine your warehouse layout, item quantities, and access levels to map out the system to fit your workflow.
            </p>
          </div>
          <div className="lp-how-step">
            <div className="lp-how-number">2</div>
            <h3 className="lp-how-title">2. We import your inventory</h3>
            <p className="lp-how-desc">
              Our support team handles importing your existing stock sheets, staff accounts, and custom alerts. You don't configure anything.
            </p>
          </div>
          <div className="lp-how-step">
            <div className="lp-how-number">3</div>
            <h3 className="lp-how-title">3. Go Live & manage</h3>
            <p className="lp-how-desc">
              Monitor transactions, track cash flow, and dispatch invoices on the spot from any device with an internet connection.
            </p>
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section id="reviews" className="lp-testimonials">
        <div className="lp-section-header">
          <span className="lp-section-label">Success Stories</span>
          <h2 className="lp-section-title">Trusted by businesses like yours</h2>
        </div>

        <div className="lp-testimonials-grid">
          {testimonials.map((t, i) => (
            <div key={i} className="lp-testimonial-card">
              <Stars />
              <p className="lp-testimonial-text">"{t.text}"</p>
              <div className="lp-testimonial-author">
                <div className="lp-testimonial-avatar">{t.initials}</div>
                <div>
                  <div className="lp-testimonial-name">{t.name}</div>
                  <div className="lp-testimonial-role">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── CTA / CONTACT ─── */}
      <section id="contact" className="lp-cta">
        <div className="lp-cta-inner">
          <h2>Ready to streamline your business operations?</h2>
          <p>
            Schedule a conversation with our setup team. We can have your store live with custom stock tracking in less than 48 hours.
          </p>

          <div className="lp-cta-actions">
            <button 
              className="lp-btn lp-btn-primary lp-btn-lg"
              onClick={() => setShowPhone(true)}
            >
              <Phone size={18} /> Get Phone Number
            </button>
            <button 
              className="lp-btn lp-btn-secondary lp-btn-lg"
              onClick={() => navigate(user ? "/dashboard" : "/login")}
            >
              {user ? "Dashboard" : "Sign In"} <ArrowRight className="btn-arrow" />
            </button>
          </div>

          {showPhone && (
            <div className="lp-contact-reveal">
              <Phone size={18} />
              Call or WhatsApp:{" "}
              <a href="tel:0200645732">0200-645-732</a>
            </div>
          )}
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand">
            <div className="lp-footer-name">StoreFlow <span style={{ fontWeight: 400, color: 'var(--lp-text-muted)' }}>by Flywheel</span></div>
            <div className="lp-footer-copy">
              © {new Date().getFullYear()} Flywheel Technologies. All rights reserved.
              <div style={{ marginTop: "6px", fontSize: "13px" }}>
                Built by <a href="https://bookflywheel.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--lp-accent)", fontWeight: 600 }}>Flywheel</a>
              </div>
            </div>
          </div>
          <div className="lp-footer-links">
            <a href="#features">Features</a>
            <a href="#playground">Live Demo</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#reviews">Reviews</a>
            <Link to="/login">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
