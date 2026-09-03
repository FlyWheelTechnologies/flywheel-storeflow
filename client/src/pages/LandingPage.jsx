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
  Scale,
  Lock,
  FileCheck,
  Calculator,
  QrCode,
  CheckCircle2,
  Building2,
  Database,
  HelpCircle,
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
    title: "Automatic bookkeeping & GRA tax accounting",
    desc: "Every sale, expense, and deposit is recorded with double-entry precision. Automatically balances VAT, NHIL, and GETFund ledger accounts for frictionless monthly filing."
  },
  {
    icon: <Receipt size={22} />,
    color: "purple",
    title: "E-VAT compliant receipts & WhatsApp delivery",
    desc: "Generate professional digital receipts with QR clearance data and SDC identifiers, and dispatch them directly to customer WhatsApp numbers in one tap."
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
    title: "Role-Based Access Control (Act 843 compliant)",
    desc: "Enforce strict organizational boundaries. Storekeepers ring sales, accountants audit ledgers, and administrators hold master control with full accountability."
  },
  {
    icon: <Shield size={22} />,
    color: "teal",
    title: "Ghana Data Protection Act 843 & CSA certified isolation",
    desc: "Your business data is isolated at the database layer using PostgreSQL Row-Level Security (RLS) with end-to-end encryption compliant with Cyber Security Act 1038."
  }
];

/* ─── Testimonial Data ─── */
const testimonials = [
  {
    text: "StoreFlow took the headache out of the 2026 VAT changes. Our 15% VAT, NHIL, and GETFund calculations are calculated automatically on every receipt, saving our accountant hours every week.",
    name: "Florence Yeboah",
    role: "Owner, FlorzyAngel Hardware, Sunyani",
    initials: "FY"
  },
  {
    text: "Knowing our customer records and sales books comply fully with the Data Protection Act 843 gives me total peace of mind. Plus, our multi-branch inventory is always accurate down to the last pesewa.",
    name: "Kwame Mensah",
    role: "Director, KM Building Supplies, Accra",
    initials: "KM"
  },
  {
    text: "The instant WhatsApp receipt with full tax breakdown and low stock alerts made us look 10x more professional to our corporate clients. StoreFlow is essential for any modern Ghanaian business.",
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
  const [activeComplianceTab, setActiveComplianceTab] = useState("tax");
  
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
      
      // WhatsApp floating chat bubble visibility
      if (currentScrollY <= 80) {
        setChatVisible(true);
      } else {
        if (currentScrollY > lastScrollY) {
          setChatVisible(false);
        } else {
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
  const [simTaxEnabled, setSimTaxEnabled] = useState(true);
  const [stockLevels, setStockLevels] = useState({
    cement: 14,
    ironRods: 8,
    pvcPipes: 3
  });
  const [salesHistory, setSalesHistory] = useState([
    { id: "INV-103", item: "Roofing Sheets", qty: 2, total: 450, tax: 75.00, time: "10 mins ago" }
  ]);
  const [ledgerEntries, setLedgerEntries] = useState([
    { account: "Momo Wallet (Cash)", type: "debit", amount: 450, desc: "Sale #INV-103" },
    { account: "Sales Revenue", type: "credit", amount: 375, desc: "Net Revenue #INV-103" },
    { account: "GRA VAT Payable (15%)", type: "credit", amount: 56.25, desc: "Standard VAT (Act 1151)" },
    { account: "NHIL & GETFund Payable (5%)", type: "credit", amount: 18.75, desc: "Health & Education Levies" }
  ]);
  const [momoSuccess, setMomoSuccess] = useState(false);
  const [showSimAlert, setShowSimAlert] = useState(false);
  const [lastSaleReceipt, setLastSaleReceipt] = useState(null);

  /* Scroll Fade-In Handler */
  const featuresRef = useRef(null);
  const showcaseRef = useRef(null);
  const complianceRef = useRef(null);

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
    const cEl = complianceRef.current;

    if (fEl) observer.observe(fEl);
    if (sEl) observer.observe(sEl);
    if (cEl) observer.observe(cEl);

    return () => {
      if (fEl) observer.unobserve(fEl);
      if (sEl) observer.unobserve(sEl);
      if (cEl) observer.unobserve(cEl);
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

    // Ghana VAT Act 2025 (Act 1151 - Effective Jan 1, 2026):
    // Standard VAT: 15%, NHIL: 2.5%, GETFund: 2.5% on the same taxable value base.
    // Total combined indirect tax rate = 20%. COVID levy abolished. Flat rate scheme abolished.
    const combinedRate = 0.20;
    const vatRate = 0.15;
    const nhilRate = 0.025;
    const getfundRate = 0.025;

    let net = 0;
    let totalTax = 0;
    let gross = 0;

    if (inclusive) {
      gross = num;
      net = num / (1 + combinedRate);
      totalTax = gross - net;
    } else {
      net = num;
      totalTax = net * combinedRate;
      gross = net + totalTax;
    }

    const vat = net * vatRate;
    const nhil = net * nhilRate;
    const getfund = net * getfundRate;

    return {
      gross,
      net,
      vat,
      nhil,
      getfund,
      totalTax,
      effectiveRate: "20%"
    };
  };

  /* Simulate Selling an Item in the POS widget */
  const handleSimulateSale = (itemKey, name, basePrice) => {
    if (stockLevels[itemKey] <= 0) return;
    
    // Decrement stock
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

    // Add Ledger entries (Double-entry conforming to Act 1151)
    let newLedger = [];
    if (simTaxEnabled) {
      newLedger = [
        { account: "Momo / Bank Cash", type: "debit", amount: taxInfo.gross, desc: `Sale #${invId}` },
        { account: "Sales Revenue (Net)", type: "credit", amount: taxInfo.net, desc: `Revenue #${invId}` },
        { account: "GRA VAT Payable (15%)", type: "credit", amount: taxInfo.vat, desc: `Act 1151 VAT #${invId}` },
        { account: "NHIL & GETFund Payable (5%)", type: "credit", amount: taxInfo.nhil + taxInfo.getfund, desc: `Levies #${invId}` }
      ];
    } else {
      newLedger = [
        { account: "Momo / Bank Cash", type: "debit", amount: taxInfo.gross, desc: `Sale #${invId}` },
        { account: "Sales Revenue", type: "credit", amount: taxInfo.gross, desc: `Revenue #${invId}` }
      ];
    }
    setLedgerEntries(prev => [...newLedger, ...prev.slice(0, 4)]);

    // Generate simulator SDC & E-VAT validation receipt
    setLastSaleReceipt({
      invId,
      item: name,
      taxInfo,
      sdcCode: `SDC-GH-${Math.floor(100000 + Math.random() * 900000)}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    });

    // Show temporary simulator success alert
    setMomoSuccess(true);
    setTimeout(() => setMomoSuccess(false), 4000);

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

  const calculatedTax = calculateGhanaTax(calcAmount, calcIsInclusive, calcIsVatRegistered);

  return (
    <div className="lp">
      {/* ─── WHATSAPP FLOATING CHAT BUBBLE ─── */}
      <a 
        href="https://wa.me/233200645732?text=Hello%20StoreFlow%2C%20I%20would%20like%20to%20know%20more%20about%20setting%20up%20my%20store%20and%20GRA%20tax%20compliance!" 
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
            <a href="#compliance">Tax & Data Laws</a>
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
            <a href="#compliance" onClick={() => setMobileMenuOpen(false)}>Ghana Tax & Data Laws</a>
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
            <span>GRA VAT Act 1151 & Data Protection Act 843 Ready</span>
          </div>

          <h1>
            Run your Ghanaian store with<br />
            <span className="lp-highlight">absolute tax & data clarity</span>
          </h1>

          <p className="lp-hero-desc">
            A high-performance stock management and accounting platform built for Ghana. Automatically compute 2026 unified VAT, NHIL, and GETFund, issue compliant digital receipts, and protect customer records under Act 843.
          </p>

          <div className="lp-hero-ctas">
            <button 
              className="lp-btn lp-btn-primary lp-btn-lg" 
              onClick={() => navigate(user ? "/dashboard" : "/login")}
            >
              {user ? "Go to Dashboard" : "Enter Platform"} <ArrowRight className="btn-arrow" />
            </button>
            <a href="#compliance" className="lp-btn lp-btn-secondary lp-btn-lg">
              Explore Ghana Regulations
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
              alt="StoreFlow Ghanaian stock management and accounting dashboard" 
              loading="eager"
            />
            <div className="lp-screenshot-overlay">
              Run your business securely from phone or desktop. Click to test the live simulator.
            </div>
          </div>
        </div>
      </section>

      {/* ─── TRUST STRIP ─── */}
      <section className="lp-trust">
        <div className="lp-trust-inner">
          <div className="lp-trust-item">
            <div className="lp-trust-number">250+</div>
            <div className="lp-trust-label">Active Ghanaian stores</div>
          </div>
          <div className="lp-trust-item">
            <div className="lp-trust-number">GHS 4.2M+</div>
            <div className="lp-trust-label">Compliant sales processed</div>
          </div>
          <div className="lp-trust-item">
            <div className="lp-trust-number">Act 1151</div>
            <div className="lp-trust-label">2026 Unified VAT / GRA Ready</div>
          </div>
          <div className="lp-trust-item">
            <div className="lp-trust-number">Act 843</div>
            <div className="lp-trust-label">100% Data privacy & RLS isolation</div>
          </div>
        </div>
      </section>

      {/* ─── GHANA TAX & DATA LAWS COMPLIANCE HUB ─── */}
      <section id="compliance" className="lp-compliance-section" ref={complianceRef}>
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-section-label">Ghanaian Regulatory Framework</span>
            <h2 className="lp-section-title">Built from the ground up for Ghana's tax & data laws</h2>
            <p className="lp-section-desc">
              Operating in Ghana requires strict adherence to Ghana Revenue Authority (GRA) tax reforms and the Data Protection Commission (DPC) standards. StoreFlow automates compliance behind the scenes so you never face penalties or audit surprises.
            </p>
          </div>

          {/* Compliance Tabs Navigation */}
          <div className="lp-compliance-tabs-bar">
            <button 
              className={`lp-compliance-tab-btn ${activeComplianceTab === "tax" ? "active" : ""}`}
              onClick={() => setActiveComplianceTab("tax")}
            >
              <Scale size={18} />
              <span>1. Ghana Tax & GRA Laws (Act 1151 & Act 915)</span>
            </button>
            <button 
              className={`lp-compliance-tab-btn ${activeComplianceTab === "data" ? "active" : ""}`}
              onClick={() => setActiveComplianceTab("data")}
            >
              <Lock size={18} />
              <span>2. Data Privacy & Cyber Laws (Act 843 & Act 1038)</span>
            </button>
            <button 
              className={`lp-compliance-tab-btn ${activeComplianceTab === "calculator" ? "active" : ""}`}
              onClick={() => setActiveComplianceTab("calculator")}
            >
              <Calculator size={18} />
              <span>3. Live 2026 Tax Estimator</span>
            </button>
          </div>

          {/* Tab 1: Tax & GRA Laws */}
          {activeComplianceTab === "tax" && (
            <div className="lp-compliance-panel animate-fade-in">
              <div className="lp-compliance-grid">
                <div className="lp-compliance-card">
                  <div className="lp-compliance-card-header">
                    <div className="lp-law-badge gra">GRA • Act 1151</div>
                    <FileCheck className="lp-law-icon text-orange" size={24} />
                  </div>
                  <h3>Value Added Tax Act, 2025 (Act 1151)</h3>
                  <p className="lp-law-summary">
                    Standardized indirect tax structure effective January 1, 2026. Computes unified indirect taxes on a single taxable value without compounding:
                  </p>
                  <ul className="lp-law-list">
                    <li><strong>15.0% Standard VAT:</strong> Calculated on the net transaction value.</li>
                    <li><strong>2.5% NHIL:</strong> National Health Insurance Levy (now input-tax deductible).</li>
                    <li><strong>2.5% GETFund Levy:</strong> Ghana Education Trust Fund Levy (now input-tax deductible).</li>
                    <li><strong>20.0% Combined Effective Rate:</strong> Eliminates previous cascading flat-rate confusion.</li>
                    <li><strong>Abolished COVID-19 Levy:</strong> 1% COVID health levy is completely repealed.</li>
                  </ul>
                  <div className="lp-law-tag">Threshold: GHS 750,000 for standard goods registration</div>
                </div>

                <div className="lp-compliance-card">
                  <div className="lp-compliance-card-header">
                    <div className="lp-law-badge e-vat">GRA • E-VAT CIS</div>
                    <QrCode className="lp-law-icon text-green" size={24} />
                  </div>
                  <h3>GRA Certified Invoicing & E-VAT Compliance</h3>
                  <p className="lp-law-summary">
                    Meets GRA Electronic Invoicing System mandates for real-time transaction authentication and invoice clearance:
                  </p>
                  <ul className="lp-law-list">
                    <li><strong>Sales Data Controller (SDC) Readiness:</strong> Formats receipts with unique digital identifiers.</li>
                    <li><strong>Digital Verification QR Codes:</strong> Every invoice embeds verifiable authenticity data.</li>
                    <li><strong>Revenue Administration Act (Act 915):</strong> Guarantees 6-year tamper-evident digital record retention.</li>
                    <li><strong>Zero Government E-Levy Overhead:</strong> Clean MoMo & bank reconciliations reflecting official E-Levy abolition.</li>
                  </ul>
                  <div className="lp-law-tag">Automatic Double-Entry Tax Ledger Separation</div>
                </div>
              </div>

              {/* Tax Quick Reference Table */}
              <div className="lp-tax-table-container">
                <div className="lp-tax-table-title">
                  <Building2 size={18} />
                  <span>Ghana Indirect Tax Structure Breakdown (2026 Regime)</span>
                </div>
                <div className="lp-table-responsive">
                  <table className="lp-compliance-table">
                    <thead>
                      <tr>
                        <th>Tax Component</th>
                        <th>Legal Basis</th>
                        <th>Statutory Rate</th>
                        <th>Input Tax Deductible?</th>
                        <th>Application in StoreFlow</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Standard VAT</strong></td>
                        <td>VAT Act, 2025 (Act 1151)</td>
                        <td><span className="badge-highlight">15.0%</span></td>
                        <td><span className="badge-yes">Yes</span></td>
                        <td>Automated output liability tracking & invoice split</td>
                      </tr>
                      <tr>
                        <td><strong>NHIL</strong></td>
                        <td>National Health Insurance Act</td>
                        <td><span className="badge-highlight">2.5%</span></td>
                        <td><span className="badge-yes">Yes (Re-coupled)</span></td>
                        <td>Isolated ledger account for health levy remittances</td>
                      </tr>
                      <tr>
                        <td><strong>GETFund Levy</strong></td>
                        <td>Ghana Education Trust Fund Act</td>
                        <td><span className="badge-highlight">2.5%</span></td>
                        <td><span className="badge-yes">Yes (Re-coupled)</span></td>
                        <td>Dedicated tracking for education levy reporting</td>
                      </tr>
                      <tr>
                        <td><strong>COVID-19 Levy</strong></td>
                        <td>Act 1068 (Repealed)</td>
                        <td><span className="badge-no">0.0% (Abolished)</span></td>
                        <td>N/A</td>
                        <td>Excluded from tax engine computations</td>
                      </tr>
                      <tr>
                        <td><strong>Total Effective Rate</strong></td>
                        <td>Combined Indirect Base</td>
                        <td><span className="badge-total">20.0% Combined</span></td>
                        <td>Full Deductibility</td>
                        <td>One-click toggle between VAT and Non-VAT pricing</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Data Protection & Cybersecurity */}
          {activeComplianceTab === "data" && (
            <div className="lp-compliance-panel animate-fade-in">
              <div className="lp-compliance-grid">
                <div className="lp-compliance-card">
                  <div className="lp-compliance-card-header">
                    <div className="lp-law-badge dpc">DPC • Act 843</div>
                    <Shield className="lp-law-icon text-teal" size={24} />
                  </div>
                  <h3>Data Protection Act, 2012 (Act 843)</h3>
                  <p className="lp-law-summary">
                    Enforces the Data Protection Commission (DPC) standards across all 8 Core Principles for handling customer data:
                  </p>
                  <ul className="lp-law-list">
                    <li><strong>Accountability & Lawfulness:</strong> Structured data collection with explicit business purpose.</li>
                    <li><strong>Data Minimization & Quality:</strong> Stores only essential customer details (name, phone, debt logs).</li>
                    <li><strong>Openness & Subject Rights:</strong> Customers can request their ledger transaction summaries at any time.</li>
                    <li><strong>Strict Purpose Specification:</strong> Customer data is never shared, marketed, or monetized.</li>
                    <li><strong>Data Controller Segregation:</strong> Multi-tenant isolation prevents cross-organization leaks.</li>
                  </ul>
                  <div className="lp-law-tag">Zero Cross-Tenant Data Access Guarantee</div>
                </div>

                <div className="lp-compliance-card">
                  <div className="lp-compliance-card-header">
                    <div className="lp-law-badge csa">CSA • Act 1038 & 772</div>
                    <Database className="lp-law-icon text-purple" size={24} />
                  </div>
                  <h3>Cybersecurity Act (1038) & Electronic Transactions (772)</h3>
                  <p className="lp-law-summary">
                    Built to satisfy the Cyber Security Authority (CSA) and the Electronic Transactions Act, 2008:
                  </p>
                  <ul className="lp-law-list">
                    <li><strong>PostgreSQL Row-Level Security (RLS):</strong> Cryptographic database-level wall between stores.</li>
                    <li><strong>Electronic Transactions Act 772:</strong> Legally binding digital receipts & audit trails for court admissibility.</li>
                    <li><strong>TLS 1.3 / AES-256 Encryption:</strong> In-transit and at-rest protection against unauthorized breaches.</li>
                    <li><strong>Comprehensive Audit Logs:</strong> Tracks every stock adjustment, deletion attempt, and permission elevation.</li>
                  </ul>
                  <div className="lp-law-tag">Immutable Audit Logging & RBAC Access Protection</div>
                </div>
              </div>

              {/* 8 DPC Principles Matrix */}
              <div className="lp-dpc-matrix">
                <div className="lp-dpc-matrix-header">
                  <CheckCircle2 size={18} />
                  <span>How StoreFlow Satisfies the 8 Principles of Ghana Act 843</span>
                </div>
                <div className="lp-dpc-grid">
                  <div className="lp-dpc-item">
                    <span className="num">1</span>
                    <div>
                      <strong>Accountability</strong>
                      <p>Full administrator audit trails tracking user actions and timestamped ledger edits.</p>
                    </div>
                  </div>
                  <div className="lp-dpc-item">
                    <span className="num">2</span>
                    <div>
                      <strong>Lawfulness of Processing</strong>
                      <p>Data processed solely for legitimate commercial invoicing and stock recordkeeping.</p>
                    </div>
                  </div>
                  <div className="lp-dpc-item">
                    <span className="num">3</span>
                    <div>
                      <strong>Specification of Purpose</strong>
                      <p>Customer contact data is captured exclusively for digital receipt delivery and debt tracking.</p>
                    </div>
                  </div>
                  <div className="lp-dpc-item">
                    <span className="num">4</span>
                    <div>
                      <strong>Compatibility</strong>
                      <p>Prevents unexpected secondary processing or external tracking across vendors.</p>
                    </div>
                  </div>
                  <div className="lp-dpc-item">
                    <span className="num">5</span>
                    <div>
                      <strong>Quality of Information</strong>
                      <p>Instant phone number validation, receipt re-generation, and customer ledger sync.</p>
                    </div>
                  </div>
                  <div className="lp-dpc-item">
                    <span className="num">6</span>
                    <div>
                      <strong>Openness & Transparency</strong>
                      <p>Clear line-item breakdowns on all customer-facing receipts and PDF statements.</p>
                    </div>
                  </div>
                  <div className="lp-dpc-item">
                    <span className="num">7</span>
                    <div>
                      <strong>Security Safeguards</strong>
                      <p>Database Row-Level Security, SSL/TLS, and strict password hashing protocols.</p>
                    </div>
                  </div>
                  <div className="lp-dpc-item">
                    <span className="num">8</span>
                    <div>
                      <strong>Data Subject Participation</strong>
                      <p>Ability to rectify customer contact details and export transaction statements on demand.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Interactive Ghana Tax Calculator */}
          {activeComplianceTab === "calculator" && (
            <div className="lp-compliance-panel animate-fade-in">
              <div className="lp-tax-calc-card">
                <div className="lp-tax-calc-header">
                  <div className="badge-pulse">
                    <Sparkles size={14} /> 2026 GRA Tax Act 1151 Calculator
                  </div>
                  <h3>Interactive Ghanaian Tax & Indirect Levy Calculator</h3>
                  <p>Test how a sale is broken down under the new 2026 Value Added Tax Act (Act 1151) versus non-VAT registered retail mode.</p>
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
                      <label>VAT Registration Status</label>
                      <div className="lp-pill-selectors">
                        <button 
                          className={`pill-btn ${calcIsVatRegistered ? "active" : ""}`}
                          onClick={() => setCalcIsVatRegistered(true)}
                        >
                          VAT Registered (≥ GHS 750k)
                        </button>
                        <button 
                          className={`pill-btn ${!calcIsVatRegistered ? "active" : ""}`}
                          onClick={() => setCalcIsVatRegistered(false)}
                        >
                          Non-VAT / Small Biz
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
                            Tax-Inclusive (Price includes VAT)
                          </button>
                          <button 
                            className={`pill-btn ${!calcIsInclusive ? "active" : ""}`}
                            onClick={() => setCalcIsInclusive(false)}
                          >
                            Tax-Exclusive (Tax added on top)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="lp-tax-calc-results">
                    <div className="calc-result-header">
                      <span>Statutory Breakdown</span>
                      <span className="rate-badge">Rate: {calculatedTax.effectiveRate}</span>
                    </div>

                    <div className="calc-breakdown-list">
                      <div className="calc-row">
                        <span>Net Taxable Base</span>
                        <span className="mono bold">GHS {calculatedTax.net.toFixed(2)}</span>
                      </div>
                      <div className="calc-row sub">
                        <span>• Standard VAT (15.0%)</span>
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
                        <span>Total GRA Indirect Tax (20%)</span>
                        <span className="mono bold text-orange">GHS {calculatedTax.totalTax.toFixed(2)}</span>
                      </div>
                      <div className="calc-row gross-final">
                        <span>Total Customer Invoice</span>
                        <span className="mono grand-total">GHS {calculatedTax.gross.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="calc-compliance-note">
                      <CheckCircle2 size={16} />
                      <span>Ready for GRA monthly returns (Form 1) with input tax claim support.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ─── INTERACTIVE DASHBOARD SIMULATOR ─── */}
      <section id="playground" className="lp-playground-section" ref={showcaseRef}>
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-section-label">Live Interactive Simulator</span>
            <h2 className="lp-section-title">Experience Ghana-compliant sales right now</h2>
            <p className="lp-section-desc">
              Sell an item below to see the automated 2026 VAT Act calculation, digital receipt hash creation, stock deduction, and balanced double-entry ledger update in real time.
            </p>
          </div>

          <div className="lp-simulator-widget">
            <div className="lp-simulator-header">
              <div className="lp-simulator-dots">
                <span className="dot red" />
                <span className="dot yellow" />
                <span className="dot green" />
              </div>
              <div className="lp-simulator-title">StoreFlow — Ghana Point of Sale & Tax Engine</div>
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
                  <span>1. Point of Sale & E-VAT</span>
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
                  <span>3. Tax Ledgers (Act 1151)</span>
                </button>
              </div>

              {/* Simulator Content Area */}
              <div className="lp-simulator-content">
                {activePlaygroundTab === "pos" && (
                  <div className="lp-sim-tab-view animate-fade-in">
                    <div className="lp-sim-pos-header">
                      <div>
                        <h4>Sell Items with Instant Tax Breakdown</h4>
                        <p className="sim-sub">Click an item below to simulate a live customer purchase at your checkout counter.</p>
                      </div>
                      <div className="lp-sim-tax-toggle">
                        <label>
                          <input 
                            type="checkbox" 
                            checked={simTaxEnabled} 
                            onChange={(e) => setSimTaxEnabled(e.target.checked)} 
                          />
                          <span>20% GRA VAT/Levies Mode</span>
                        </label>
                      </div>
                    </div>
                    
                    <div className="lp-sim-items-grid">
                      <div className="lp-sim-item-card">
                        <h5>Cement (50kg)</h5>
                        <p className="price">GHS 120.00</p>
                        <p className="stock">Stock: {stockLevels.cement} bags</p>
                        <p className="tax-tag">{simTaxEnabled ? "Incl. GHS 20.00 VAT/Levies" : "No Tax"}</p>
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
                        <p className="tax-tag">{simTaxEnabled ? "Incl. GHS 14.17 VAT/Levies" : "No Tax"}</p>
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
                        <p className="tax-tag">{simTaxEnabled ? "Incl. GHS 7.50 VAT/Levies" : "No Tax"}</p>
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
                          <strong>Sale Recorded! Instant GRA E-Receipt Generated:</strong>
                        </div>
                        <div className="alert-details">
                          <span>Invoice: <strong>#{lastSaleReceipt.invId}</strong></span>
                          <span>Item: <strong>{lastSaleReceipt.item}</strong></span>
                          <span>Total Paid: <strong>GHS {lastSaleReceipt.taxInfo.gross.toFixed(2)}</strong></span>
                          {simTaxEnabled && (
                            <span>VAT/Levies (20%): <strong>GHS {lastSaleReceipt.taxInfo.totalTax.toFixed(2)}</strong></span>
                          )}
                          <span>Security Code: <strong>{lastSaleReceipt.sdcCode}</strong></span>
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
                        ⚠️ Low stock notification dispatched via Edge Function to Store Manager!
                      </div>
                    )}
                  </div>
                )}

                {activePlaygroundTab === "ledger" && (
                  <div className="lp-sim-tab-view animate-fade-in">
                    <h4>Automated Balanced Bookkeeping & Tax Ledgers</h4>
                    <p className="sim-sub">Every transaction posts balancing debits and credits conforming to Ghanaian financial recordkeeping (Act 915).</p>
                    
                    <div className="lp-sim-ledger-view">
                      <table className="lp-demo-table">
                        <thead>
                          <tr>
                            <th>Account Name</th>
                            <th>Entry Type</th>
                            <th>Amount</th>
                            <th>Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ledgerEntries.map((entry, index) => (
                            <tr key={index}>
                              <td className="mono font-semibold">{entry.account}</td>
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
          <h2 className="lp-section-title">Complete control over your retail operations</h2>
          <p className="lp-section-desc">
            StoreFlow brings speed, accuracy, and statutory rigor to your shop without the complexity of traditional accounting software.
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
          <h2 className="lp-section-title">Onboarding is fast, simple, and fully managed</h2>
          <p className="lp-section-desc">
            We handle the database setup, inventory import, and tax config. You run the business.
          </p>
        </div>

        <div className="lp-how-grid">
          <div className="lp-how-step">
            <div className="lp-how-number">1</div>
            <h3 className="lp-how-title">1. Consult on your plan</h3>
            <p className="lp-how-desc">
              We determine your branch locations, item catalog, tax registration status (VAT or non-VAT), and staff roles.
            </p>
          </div>
          <div className="lp-how-step">
            <div className="lp-how-number">2</div>
            <h3 className="lp-how-title">2. We import your stock</h3>
            <p className="lp-how-desc">
              Our engineering team imports your existing price lists, batches, threshold alerts, and customer balances securely.
            </p>
          </div>
          <div className="lp-how-step">
            <div className="lp-how-number">3</div>
            <h3 className="lp-how-title">3. Go Live & manage</h3>
            <p className="lp-how-desc">
              Record sales, print E-VAT receipts, track debt, and generate GRA-ready monthly audit summaries from any phone or computer.
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
          <h2>Ready to streamline your business & stay 100% compliant?</h2>
          <p>
            Schedule a quick consultation with our team. We can have your store live with custom stock tracking and GRA tax support in under 48 hours.
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
              <div style={{ marginTop: "6px", fontSize: "13px" }}>
                Built for Ghanaian enterprise • Compliant with <strong>GRA VAT Act 1151</strong> & <strong>Data Protection Act 843</strong>
              </div>
              <div style={{ marginTop: "4px", fontSize: "13px" }}>
                Crafted by <a href="https://bookflywheel.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--lp-accent)", fontWeight: 600 }}>Flywheel</a>
              </div>
            </div>
          </div>
          <div className="lp-footer-links">
            <a href="#features">Features</a>
            <a href="#compliance">Ghana Compliance</a>
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
