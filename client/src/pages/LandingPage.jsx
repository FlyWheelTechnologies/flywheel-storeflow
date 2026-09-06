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
  Phone,
  Calculator,
  CheckCircle2,
  Sparkles
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
    desc: "Know exactly what you have, what's selling fast, and what needs restocking — updated the instant a sale happens across your branches."
  },
  {
    icon: <TrendingUp size={22} />,
    color: "green",
    title: "Automatic double-entry bookkeeping",
    desc: "Every sale, expense, and customer prepayment is recorded with double-entry precision. Easily track cash flow, profit margins, and sales taxes without manual ledger work."
  },
  {
    icon: <Receipt size={22} />,
    color: "purple",
    title: "Digital receipts & WhatsApp delivery",
    desc: "Generate professional digital receipts with optional tax breakdowns and dispatch them directly to customer WhatsApp numbers in one tap."
  },
  {
    icon: <Bell size={22} />,
    color: "amber",
    title: "Low stock & threshold alerts",
    desc: "Set custom reorder thresholds for every product. Receive automatic alerts before inventory runs dry so you never miss high-margin retail demand."
  },
  {
    icon: <Users size={22} />,
    color: "blue",
    title: "Role-based staff permissions",
    desc: "Keep your business secure. Cashiers ring sales, storekeepers update inventory, and owners hold master control over profits, cash, and reports."
  },
  {
    icon: <Shield size={22} />,
    color: "teal",
    title: "Reliable data security & daily backups",
    desc: "Your business data is strictly isolated and encrypted at the database level with automated daily backups, keeping your store safe and audit-ready."
  }
];

/* ─── Testimonial Data ─── */
const testimonials = [
  {
    text: "StoreFlow transformed how we run our hardware shop. Stock counts are always spot-on, sales take 5 seconds at the counter, and tax calculations at month-end are completely automated.",
    name: "Florence Yeboah",
    role: "Owner, FlorzyAngel Hardware, Sunyani",
    initials: "FY"
  },
  {
    text: "With branches across Accra, knowing what is sold and what needs restocking right from my phone has saved us thousands in lost sales and inventory shrinkage.",
    name: "Kwame Mensah",
    role: "Director, KM Building Supplies, Accra",
    initials: "KM"
  },
  {
    text: "Customers love getting instant receipts on WhatsApp. It makes our boutique look 10x more modern and professional, and our daily balancing is effortless.",
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
  
  /* ─── Tax Calculator State ─── */
  const [calcAmount, setCalcAmount] = useState("500");
  const [calcIsInclusive, setCalcIsInclusive] = useState(true);
  const [calcIsVatRegistered, setCalcIsVatRegistered] = useState(true);

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
      e.preventDefault();
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
      
      // Calculate hero screenshot 3D entry effect
      const heroSectionHeight = 550;
      const progress = Math.min(Math.max(currentScrollY / heroSectionHeight, 0), 1);
      
      setScreenshotTransform({
        y: (1 - progress) * 35,
        scale: 0.96 + (progress * 0.04),
        opacity: 0.85 + (progress * 0.15)
      });

      if (currentScrollY > lastScrollY && currentScrollY > 120) {
        setHeaderVisible(false);
        setChatVisible(false);
      } else {
        setHeaderVisible(true);
        setChatVisible(true);
      }
      
      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* ─── Interactive Playground / POS Simulator State ─── */
  const [activePlaygroundTab, setActivePlaygroundTab] = useState("pos");
  const [stockLevels, setStockLevels] = useState({
    cement: 34,
    ironRods: 18,
    pvcPipes: 42
  });
  const [simTaxEnabled, setSimTaxEnabled] = useState(true);
  const [salesHistory, setSalesHistory] = useState([
    { id: "INV-101", item: "Cement (50kg)", qty: 2, total: 240, tax: 40, time: "10 mins ago" },
    { id: "INV-100", item: "Iron Rods (16mm)", qty: 1, total: 85, tax: 14.17, time: "42 mins ago" }
  ]);
  const [ledgerEntries, setLedgerEntries] = useState([
    { account: "Momo / Cash Account", type: "debit", amount: 240, desc: "Sale #INV-101" },
    { account: "Sales Revenue", type: "credit", amount: 200, desc: "Revenue #INV-101" },
    { account: "VAT & Levies Payable", type: "credit", amount: 40, desc: "Tax #INV-101" }
  ]);
  const [showSimAlert, setShowSimAlert] = useState(false);
  const [momoSuccess, setMomoSuccess] = useState(false);
  const [lastSaleReceipt, setLastSaleReceipt] = useState(null);

  /* Scroll Fade-In Handler */
  const featuresRef = useRef(null);
  const showcaseRef = useRef(null);
  const taxToolsRef = useRef(null);

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
    const tEl = taxToolsRef.current;

    if (fEl) observer.observe(fEl);
    if (sEl) observer.observe(sEl);
    if (tEl) observer.observe(tEl);

    return () => {
      if (fEl) observer.unobserve(fEl);
      if (sEl) observer.unobserve(sEl);
      if (tEl) observer.unobserve(tEl);
    };
  }, []);

  const toggleFeature = (index) => {
    setExpandedFeatures(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  /* Compute Ghanaian Tax Breakdown for Playground & Calculator */
  const calculateGhanaTax = (rawAmount, inclusive = true, isVatReg = true) => {
    const num = parseFloat(rawAmount) || 0;
    if (num <= 0 || !isVatReg) {
      return {
        gross: num,
        net: num,
        vat: 0,
        nhil: 0,
        getfund: 0,
        totalTax: 0,
        effectiveRate: "0%"
      };
    }

    const combinedRate = 0.20;
    const vatRate = 0.15;
    const nhilRate = 0.025;
    const getfundRate = 0.025;

    if (inclusive) {
      const net = Math.round((num / (1 + combinedRate)) * 100) / 100;
      const vat = Math.round((net * vatRate) * 100) / 100;
      const nhil = Math.round((net * nhilRate) * 100) / 100;
      const getfund = Math.round((net * getfundRate) * 100) / 100;
      const totalTax = Math.round((num - net) * 100) / 100;

      return {
        gross: num,
        net,
        vat,
        nhil,
        getfund,
        totalTax,
        effectiveRate: "20% Unified"
      };
    } else {
      const net = num;
      const vat = Math.round((net * vatRate) * 100) / 100;
      const nhil = Math.round((net * nhilRate) * 100) / 100;
      const getfund = Math.round((net * getfundRate) * 100) / 100;
      const totalTax = Math.round((net * combinedRate) * 100) / 100;
      const gross = Math.round((net + totalTax) * 100) / 100;

      return {
        gross,
        net,
        vat,
        nhil,
        getfund,
        totalTax,
        effectiveRate: "20% Unified"
      };
    }
  };

  /* Simulate Selling an Item in POS Playground */
  const handleSimulateSale = (itemKey, name, basePrice) => {
    if (stockLevels[itemKey] <= 0) return;

    const newStock = stockLevels[itemKey] - 1;
    setStockLevels(prev => ({
      ...prev,
      [itemKey]: newStock
    }));

    const taxInfo = calculateGhanaTax(basePrice, true, simTaxEnabled);
    const invId = `INV-${Math.floor(100 + Math.random() * 900)}`;
    
    const newSale = {
      id: invId,
      item: name,
      qty: 1,
      total: taxInfo.gross,
      tax: taxInfo.totalTax,
      time: "Just now"
    };
    setSalesHistory(prev => [newSale, ...prev.slice(0, 3)]);

    let newLedger = [];
    if (simTaxEnabled) {
      newLedger = [
        { account: "Momo / Cash Account", type: "debit", amount: taxInfo.gross, desc: `Sale #${invId}` },
        { account: "Sales Revenue (Net)", type: "credit", amount: taxInfo.net, desc: `Revenue #${invId}` },
        { account: "VAT Payable (15%)", type: "credit", amount: taxInfo.vat, desc: `VAT #${invId}` },
        { account: "NHIL & GETFund Payable (5%)", type: "credit", amount: taxInfo.nhil + taxInfo.getfund, desc: `Levies #${invId}` }
      ];
    } else {
      newLedger = [
        { account: "Momo / Cash Account", type: "debit", amount: taxInfo.gross, desc: `Sale #${invId}` },
        { account: "Sales Revenue", type: "credit", amount: taxInfo.gross, desc: `Revenue #${invId}` }
      ];
    }
    setLedgerEntries(prev => [...newLedger, ...prev.slice(0, 4)]);

    setLastSaleReceipt({
      invId,
      item: name,
      taxInfo,
      sdcCode: `REC-GH-${Math.floor(100000 + Math.random() * 900000)}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    });

    setMomoSuccess(true);
    setTimeout(() => setMomoSuccess(false), 4000);

    if (newStock <= 5) {
      setShowSimAlert(true);
      setTimeout(() => setShowSimAlert(false), 5000);
    }
  };

  const handleSimulateRestock = (itemKey) => {
    setStockLevels(prev => ({
      ...prev,
      [itemKey]: prev[itemKey] + 15
    }));
  };

  const calculatedTax = calculateGhanaTax(calcAmount, calcIsInclusive, calcIsVatRegistered);

  return (
    <div className="lp">
      {/* ─── WHATSAPP FLOATING CHAT BUBBLE ─── */}
      <a 
        href="https://wa.me/233200645732?text=Hello%20StoreFlow%2C%20I%20would%20like%20to%20learn%20more%20about%20setting%20up%20my%20store%20with%20StoreFlow!" 
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
      <header className="lp-header">
        <div className="lp-header-inner">
          <Link to="/" className="lp-brand">
            <span className="lp-brand-name">
              Store<span className="lp-brand-accent">Flow</span>
            </span>
            <span className="lp-brand-sub">by Flywheel</span>
          </Link>

          <nav className="lp-nav">
            <a href="#features">Features</a>
            <a href="#tax-tools">Tax Calculator</a>
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
            <a href="#tax-tools" onClick={() => setMobileMenuOpen(false)}>Tax Calculator</a>
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
      <section className="lp-hero" style={{ backgroundImage: `linear-gradient(rgba(10, 10, 22, 0.78), rgba(10, 10, 22, 0.88)), url(${orangeReceiptMachine})` }}>
        <div className="lp-hero-inner">
          <div className="lp-hero-badge">
            <span className="lp-hero-badge-dot" />
            <span>Built for modern retail & wholesale in Ghana 🇬🇭</span>
          </div>

          <h1>
            Run your store with<br />
            <span className="lp-highlight">confidence, speed & complete control</span>
          </h1>

          <p className="lp-hero-desc">
            High-performance stock tracking, fast POS checkout, instant WhatsApp receipts, and automated bookkeeping tailored for Ghanaian businesses. Track inventory across branches, stop shrinkage, and know your daily numbers.
          </p>

          <div className="lp-hero-ctas">
            <button 
              className="lp-btn lp-btn-primary lp-btn-lg" 
              onClick={() => navigate(user ? "/dashboard" : "/login")}
            >
              {user ? "Go to Dashboard" : "Enter Platform"} <ArrowRight className="btn-arrow" />
            </button>
            <a href="#playground" className="lp-btn lp-btn-secondary lp-btn-lg">
              Try Interactive Demo
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
              alt="StoreFlow Ghanaian stock management and point of sale dashboard" 
              loading="eager"
            />
            <div className="lp-screenshot-overlay">
              Run your business smoothly from phone or desktop. Click to test the live simulator.
            </div>
          </div>
        </div>
      </section>

      {/* ─── TRUST STRIP ─── */}
      <section className="lp-trust">
        <div className="lp-trust-inner">
          <div className="lp-trust-item">
            <div className="lp-trust-number">10+</div>
            <div className="lp-trust-label">Active stores</div>
          </div>
          <div className="lp-trust-item">
            <div className="lp-trust-number">GHS 4.2M+</div>
            <div className="lp-trust-label">Sales recorded</div>
          </div>
          <div className="lp-trust-item">
            <div className="lp-trust-number">100%</div>
            <div className="lp-trust-label">Offline-ready & cloud sync</div>
          </div>
          <div className="lp-trust-item">
            <div className="lp-trust-number">Fast</div>
            <div className="lp-trust-label">WhatsApp & PDF receipts</div>
          </div>
        </div>
      </section>

      {/* ─── FEATURES (ACCORDIONS) ─── */}
      <section id="features" className="lp-features" ref={featuresRef}>
        <div className="lp-section-header">
          <span className="lp-section-label">Core Capabilities</span>
          <h2 className="lp-section-title">Complete control of your shop operations</h2>
          <p className="lp-section-desc">
            StoreFlow brings speed, accuracy, and double-entry rigor to your retail business without the complexity of traditional accounting software.
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

      {/* ─── LOCAL COMMERCE & TAX TOOLS ─── */}
      <section id="tax-tools" className="lp-compliance-section" ref={taxToolsRef}>
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-section-label">Local Commerce Ready</span>
            <h2 className="lp-section-title">Smart Ghana VAT & tax calculations, handled automatically</h2>
            <p className="lp-section-desc">
              Whether your store is VAT-registered or operating under threshold exemptions, StoreFlow takes the friction out of Ghanaian taxes. Ring up sales tax-inclusive or exclusive, separate VAT and levies in your ledger automatically, and stay audit-ready with zero guesswork.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginTop: 32 }}>
            {/* Left Box: Business Highlights */}
            <div style={{ background: '#fff', padding: 32, borderRadius: 20, border: '1px solid var(--lp-border, #e5e7eb)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: '#fef3c7', color: '#92400e', borderRadius: 20, fontSize: 12, fontWeight: 700, width: 'fit-content', marginBottom: 16 }}>
                🇬🇭 Built for Ghanaian Businesses
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 14 }}>
                No Manual Tax Math at Checkout
              </h3>
              <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
                StoreFlow handles Ghana's 2026 unified tax structure cleanly in the background so your cashiers can ring up sales in seconds without calculation errors.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ color: '#10b981', marginTop: 2 }}><CheckCircle2 size={18} /></div>
                  <div>
                    <strong style={{ fontSize: 14, color: '#1f2937' }}>20% Unified Tax Breakdown:</strong>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: '2px 0 0' }}>Automatically itemizes 15% VAT, 2.5% NHIL, and 2.5% GETFund for VAT-registered businesses.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ color: '#10b981', marginTop: 2 }}><CheckCircle2 size={18} /></div>
                  <div>
                    <strong style={{ fontSize: 14, color: '#1f2937' }}>Flexible Pricing Modes:</strong>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: '2px 0 0' }}>Sell tax-inclusive (common for retail shelves) or tax-exclusive (wholesale) with one toggle.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ color: '#10b981', marginTop: 2 }}><CheckCircle2 size={18} /></div>
                  <div>
                    <strong style={{ fontSize: 14, color: '#1f2937' }}>Small Business Friendly:</strong>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: '2px 0 0' }}>Operating under the GHS 750k threshold? Switch to 0% exempt rate anytime in Settings.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ color: '#10b981', marginTop: 2 }}><CheckCircle2 size={18} /></div>
                  <div>
                    <strong style={{ fontSize: 14, color: '#1f2937' }}>Official Receipts with TIN:</strong>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: '2px 0 0' }}>Your store TIN is neatly displayed on thermal PDF prints and WhatsApp receipts.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Box: Interactive Tax Calculator */}
            <div className="lp-tax-calc-card" style={{ margin: 0 }}>
              <div className="lp-tax-calc-header">
                <div className="badge-pulse">
                  <Sparkles size={14} /> Interactive Estimator
                </div>
                <h3>Ghana Tax & Pricing Calculator</h3>
                <p>Test how a sale breaks down between net revenue and indirect taxes.</p>
              </div>

              <div className="lp-tax-calc-body">
                <div className="lp-tax-calc-inputs">
                  <div className="lp-calc-field">
                    <label>Sale Amount (GHS)</label>
                    <div className="lp-input-currency">
                      <span>GHS</span>
                      <input 
                        type="number" 
                        min="1" 
                        step="any"
                        value={calcAmount} 
                        onChange={(e) => setCalcAmount(e.target.value)}
                        placeholder="e.g. 500"
                      />
                    </div>
                  </div>

                  <div className="lp-calc-toggle-group">
                    <label>Store Status</label>
                    <div className="lp-pill-selectors">
                      <button 
                        className={`pill-btn ${calcIsVatRegistered ? "active" : ""}`}
                        onClick={() => setCalcIsVatRegistered(true)}
                      >
                        VAT Registered
                      </button>
                      <button 
                        className={`pill-btn ${!calcIsVatRegistered ? "active" : ""}`}
                        onClick={() => setCalcIsVatRegistered(false)}
                      >
                        Exempt / Small Biz
                      </button>
                    </div>
                  </div>

                  {calcIsVatRegistered && (
                    <div className="lp-calc-toggle-group">
                      <label>Pricing Mode</label>
                      <div className="lp-pill-selectors">
                        <button 
                          className={`pill-btn ${calcIsInclusive ? "active" : ""}`}
                          onClick={() => setCalcIsInclusive(true)}
                        >
                          Tax-Inclusive
                        </button>
                        <button 
                          className={`pill-btn ${!calcIsInclusive ? "active" : ""}`}
                          onClick={() => setCalcIsInclusive(false)}
                        >
                          Tax-Exclusive
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="lp-tax-calc-results">
                  <div className="calc-result-header">
                    <span>Breakdown</span>
                    <span className="rate-badge">Rate: {calculatedTax.effectiveRate}</span>
                  </div>

                  <div className="calc-breakdown-list">
                    <div className="calc-row">
                      <span>Net Sales Value</span>
                      <span className="mono bold">GHS {calculatedTax.net.toFixed(2)}</span>
                    </div>
                    {calcIsVatRegistered && (
                      <>
                        <div className="calc-row sub">
                          <span>• VAT (15.0%)</span>
                          <span className="mono">GHS {calculatedTax.vat.toFixed(2)}</span>
                        </div>
                        <div className="calc-row sub">
                          <span>• NHIL (2.5%)</span>
                          <span className="mono">GHS {calculatedTax.nhil.toFixed(2)}</span>
                        </div>
                        <div className="calc-row sub">
                          <span>• GETFund Levy (2.5%)</span>
                          <span className="mono">GHS {calculatedTax.getfund.toFixed(2)}</span>
                        </div>
                        <div className="calc-row total-tax">
                          <span>Total Indirect Tax (20%)</span>
                          <span className="mono bold text-orange">GHS {calculatedTax.totalTax.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    <div className="calc-row gross-final">
                      <span>Total Customer Pays</span>
                      <span className="mono grand-total">GHS {calculatedTax.gross.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── INTERACTIVE DASHBOARD SIMULATOR ─── */}
      <section id="playground" className="lp-playground-section" ref={showcaseRef}>
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-section-label">Live Interactive Simulator</span>
            <h2 className="lp-section-title">Experience StoreFlow in real-time</h2>
            <p className="lp-section-desc">
              Sell an item below to see stock deduction, instant receipt generation, and balanced double-entry bookkeeping in action.
            </p>
          </div>

          <div className="lp-simulator-widget">
            <div className="lp-simulator-header">
              <div className="lp-simulator-dots">
                <span className="dot red" />
                <span className="dot yellow" />
                <span className="dot green" />
              </div>
              <div className="lp-simulator-title">StoreFlow — Point of Sale & Inventory Demo</div>
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
                  <span>3. Accounting Ledger</span>
                </button>
              </div>

              {/* Simulator Content Area */}
              <div className="lp-simulator-content">
                {activePlaygroundTab === "pos" && (
                  <div className="lp-sim-tab-view animate-fade-in">
                    <div className="lp-sim-pos-header">
                      <div>
                        <h4>Sell Items with Instant Receipts</h4>
                        <p className="sim-sub">Click an item below to simulate a live customer purchase at your checkout counter.</p>
                      </div>
                      <div className="lp-sim-tax-toggle">
                        <label>
                          <input 
                            type="checkbox" 
                            checked={simTaxEnabled} 
                            onChange={(e) => setSimTaxEnabled(e.target.checked)} 
                          />
                          <span>20% Tax Mode</span>
                        </label>
                      </div>
                    </div>
                    
                    <div className="lp-sim-items-grid">
                      <div className="lp-sim-item-card">
                        <h5>Cement (50kg)</h5>
                        <p className="price">GHS 120.00</p>
                        <p className="stock">Stock: {stockLevels.cement} bags</p>
                        <p className="tax-tag">{simTaxEnabled ? "Incl. GHS 20.00 Tax" : "Exempt / No Tax"}</p>
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
                        <p className="tax-tag">{simTaxEnabled ? "Incl. GHS 14.17 Tax" : "Exempt / No Tax"}</p>
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
                        <p className="tax-tag">{simTaxEnabled ? "Incl. GHS 7.50 Tax" : "Exempt / No Tax"}</p>
                        <button 
                          className="lp-btn lp-btn-primary lp-btn-full"
                          onClick={() => handleSimulateSale("pvcPipes", "PVC Pipes (10ft)", 45)}
                          disabled={stockLevels.pvcPipes <= 0}
                        >
                          {stockLevels.pvcPipes > 0 ? "Sell 1 Pipe" : "Out of Stock"}
                        </button>
                      </div>
                    </div>

                    {momoSuccess && lastSaleReceipt && (
                      <div className="lp-sim-success-alert animate-fade-in">
                        <div className="alert-head">
                          <CheckCircle2 size={16} /> 
                          <strong>Sale Recorded! Instant Digital Receipt Generated:</strong>
                        </div>
                        <div className="alert-details">
                          <span>Invoice: <strong>#{lastSaleReceipt.invId}</strong></span>
                          <span>Item: <strong>{lastSaleReceipt.item}</strong></span>
                          <span>Total Paid: <strong>GHS {lastSaleReceipt.taxInfo.gross.toFixed(2)}</strong></span>
                          {simTaxEnabled && (
                            <span>Tax (20%): <strong>GHS {lastSaleReceipt.taxInfo.totalTax.toFixed(2)}</strong></span>
                          )}
                          <span>Receipt ID: <strong>{lastSaleReceipt.sdcCode}</strong></span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activePlaygroundTab === "stock" && (
                  <div className="lp-sim-tab-view animate-fade-in">
                    <h4>Stock Levels & Threshold Alerts</h4>
                    <p className="sim-sub">Track inventory in real time. When stock falls below safe limits, automatic alert notifications are sent to the store admin.</p>
                    
                    <div className="lp-sim-stock-list">
                      <div className="lp-sim-stock-row">
                        <div className="item-info">
                          <span className="name">Cement (50kg)</span>
                          <span className={`status-pill ${stockLevels.cement > 5 ? "healthy" : "low"}`}>
                            {stockLevels.cement > 5 ? "Healthy Stock" : "Low Stock Alert"}
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
                            {stockLevels.ironRods > 5 ? "Healthy Stock" : "Low Stock Alert"}
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
                            {stockLevels.pvcPipes > 5 ? "Healthy Stock" : "Low Stock Alert"}
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
                        ⚠️ Low stock notification dispatched to Store Manager!
                      </div>
                    )}
                  </div>
                )}

                {activePlaygroundTab === "ledger" && (
                  <div className="lp-sim-tab-view animate-fade-in">
                    <h4>Automated Balanced Bookkeeping</h4>
                    <p className="sim-sub">Every transaction automatically posts balancing debits and credits, keeping your financial books clean and audit-ready.</p>
                    
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

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" className="lp-how">
        <div className="lp-section-header">
          <span className="lp-section-label">How It Works</span>
          <h2 className="lp-section-title">Onboarding is fast, simple, and fully managed</h2>
          <p className="lp-section-desc">
            We handle the setup and data import. You run the business.
          </p>
        </div>

        <div className="lp-how-grid">
          <div className="lp-how-step">
            <div className="lp-how-number">1</div>
            <h3 className="lp-how-title">1. Tell us about your store</h3>
            <p className="lp-how-desc">
              We determine your branch locations, item catalog, tax preferences (VAT or exempt), and staff roles.
            </p>
          </div>
          <div className="lp-how-step">
            <div className="lp-how-number">2</div>
            <h3 className="lp-how-title">2. We import your stock</h3>
            <p className="lp-how-desc">
              Our team imports your existing price lists, batches, threshold alerts, and customer balances securely.
            </p>
          </div>
          <div className="lp-how-step">
            <div className="lp-how-number">3</div>
            <h3 className="lp-how-title">3. Go live & grow</h3>
            <p className="lp-how-desc">
              Record sales, dispatch WhatsApp receipts, track debt, and view daily profits from any phone or computer.
            </p>
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section id="reviews" className="lp-testimonials">
        <div className="lp-section-header">
          <span className="lp-section-label">Success Stories</span>
          <h2 className="lp-section-title">Trusted by businesses across Ghana</h2>
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
          <h2>Ready to streamline your store operations?</h2>
          <p>
            Schedule a quick consultation with our team. We can have your store live with custom stock tracking and receipt generation in under 48 hours.
          </p>

          <div className="lp-cta-actions">
            <button 
              className="lp-btn lp-btn-primary lp-btn-lg"
              onClick={() => setShowPhone(true)}
            >
              <Phone size={18} /> Get Setup Phone Number
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
              <div style={{ marginTop: "4px", fontSize: "13px" }}>
                Built for Ghanaian retail & wholesale • Crafted by <a href="https://bookflywheel.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--lp-accent)", fontWeight: 600 }}>Flywheel</a>
              </div>
            </div>
          </div>
          <div className="lp-footer-links">
            <a href="#features">Features</a>
            <a href="#tax-tools">Tax Calculator</a>
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
