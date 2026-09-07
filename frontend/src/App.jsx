import { useEffect, useMemo, useState } from "react";

const API =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:8000"
    : `http://${window.location.hostname}:8000`);

async function apiFetch(path, options = {}) {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  const response = await window.fetch(url, {
    ...options,
    credentials: "include",
  });
  if (response.status === 401) {
    window.dispatchEvent(new Event("inshield-auth-expired"));
  }
  return response;
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    const cleanMobile = mobile.trim().replace(/[\s-]/g, "");
    if (!/^(?:\+91)?[6-9]\d{9}$/.test(cleanMobile)) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (mode === "register" && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const response = await window.fetch(`${API}/auth/${mode}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: cleanMobile, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Authentication failed");
      onAuthenticated(data.user);
    } catch (err) {
      setError(err.message || "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b12] text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-5 py-10">
        <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/90 shadow-2xl lg:grid-cols-2">
          <div className="hidden bg-gradient-to-br from-cyan-500/15 via-slate-950 to-violet-500/10 p-10 lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/15 text-xl font-bold text-cyan-300">I</div>
                <div><div className="text-xl font-bold">InShield</div><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Investment Intelligence</div></div>
              </div>
              <h2 className="mt-16 text-4xl font-bold leading-tight">One secure place for your investment intelligence.</h2>
              <p className="mt-5 max-w-md text-sm leading-6 text-slate-400">Track your portfolio, understand hidden fund exposure, monitor risk and connect supported brokers when you choose.</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs leading-5 text-slate-500">Your InShield account is separate from your broker account. Broker passwords are never entered into InShield.</div>
          </div>
          <div className="p-6 sm:p-10">
            <div className="mb-8 lg:hidden"><div className="text-xl font-bold">InShield</div><div className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">Investment Intelligence</div></div>
            <div className="mb-7">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">{mode === "login" ? "Welcome back" : "Create account"}</p>
              <h1 className="mt-2 text-3xl font-bold">{mode === "login" ? "Sign in to InShield" : "Start your InShield account"}</h1>
              <p className="mt-2 text-sm text-slate-500">Use your mobile number and InShield password.</p>
            </div>
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-slate-500">Mobile number</label>
                <input required inputMode="numeric" autoComplete="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="9876543210" className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3.5 text-sm outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-slate-500">Password</label>
                <input required type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 8 characters" className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3.5 text-sm outline-none focus:border-cyan-500" />
              </div>
              {mode === "register" && (
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-slate-500">Confirm password</label>
                  <input required type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat your password" className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3.5 text-sm outline-none focus:border-cyan-500" />
                </div>
              )}
              {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
              <button disabled={loading} className="w-full rounded-xl bg-cyan-500 px-5 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50">{loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}</button>
            </form>
            <div className="mt-6 text-center text-sm text-slate-500">
              {mode === "login" ? "Don't have an account?" : "Already have an account?"}
              <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} className="ml-2 font-semibold text-cyan-400 hover:text-cyan-300">{mode === "login" ? "Create one" : "Sign in"}</button>
            </div>
            <p className="mt-8 text-center text-[11px] leading-5 text-slate-600">Local development build. Production will add verified OTP delivery, stronger account recovery and managed secret storage.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: "⌂" },
  { id: "portfolio", label: "Portfolio", icon: "▣" },
  { id: "analytics", label: "Advanced Analytics", icon: "◒" },
  { id: "xray", label: "Portfolio X-Ray", icon: "◉" },
  { id: "risk", label: "Risk & Diversification", icon: "◆" },
  { id: "simulator", label: "What-If Simulator", icon: "◇" },
  { id: "markets", label: "Markets", icon: "↗" },
  { id: "alerts", label: "Alerts", icon: "⚠" },
  { id: "news", label: "News Intelligence", icon: "▤" },
  { id: "ai", label: "AI Intelligence", icon: "✦" },
  { id: "broker", label: "Broker Integration", icon: "⇄" },
];

const emptyForm = {
  asset_type: "STOCK",
  name: "",
  symbol: "",
  units: "",
  buy_price: "",
  invested_amount: "",
  buy_date: "",
};

function formatINR(value = 0) {
  return `₹${Number(value).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

function formatNumber(value = 0) {
  return Number(value).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}

function StatCard({ label, value, sub, tone = "blue" }) {
  const tones = {
    blue: "text-cyan-300",
    green: "text-emerald-400",
    orange: "text-amber-400",
    purple: "text-violet-400",
  };

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold ${tones[tone]}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function AssetBadge({ type }) {
  const labels = {
    STOCK: "Stock",
    MUTUAL_FUND: "Mutual Fund",
    ETF: "ETF",
  };

  return (
    <span className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-400">
      {labels[type] || type}
    </span>
  );
}

function BreakdownCard({ title, subtitle, entries, suffix = "%" }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>

      <div className="mt-5 space-y-4">
        {entries.length === 0 ? (
          <p className="text-sm text-slate-500">No data available yet.</p>
        ) : (
          entries
            .sort(([, a], [, b]) => Number(b) - Number(a))
            .map(([label, value]) => (
              <div key={label}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-slate-300">{label}</span>
                  <span className="font-semibold text-cyan-300">
                    {Number(value).toFixed(2)}{suffix}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-cyan-400"
                    style={{ width: `${Math.min(100, Math.max(0, Number(value)))}%` }}
                  />
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
}

function DashboardApp({ authUser, onLogout }) {
  const [activePage, setActivePage] = useState("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Real portfolio data from FastAPI + SQLite.
  const [holdings, setHoldings] = useState([]);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [portfolioError, setPortfolioError] = useState("");

  // Add/Edit modal.
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Phase 2: Real X-Ray data from FastAPI + SQLite.
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Add fund -> stock holding for X-Ray.
  const [showXrayAdd, setShowXrayAdd] = useState(false);
  const [xraySaving, setXraySaving] = useState(false);
  const [xrayForm, setXrayForm] = useState({
    fund_name: "",
    stock_name: "",
    stock_symbol: "",
    amount: "",
  });

  // Phase 9: professional portfolio alert engine from FastAPI.
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsData, setAlertsData] = useState(null);
  const [alertsError, setAlertsError] = useState("");

  // Phase 10: portfolio-aware news intelligence.
  const [newsData, setNewsData] = useState(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState("");
  const [newsFilter, setNewsFilter] = useState("all");

  // Phase 11: local AI/ML portfolio intelligence.
  const [aiData, setAiData] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  // Phase 12: safe read-only broker integration + explicit portfolio sync.
  const [brokerProviders, setBrokerProviders] = useState([]);
  const [brokerConnections, setBrokerConnections] = useState([]);
  const [brokerProvider, setBrokerProvider] = useState("mock");
  const [brokerPreview, setBrokerPreview] = useState(null);
  const [brokerHistory, setBrokerHistory] = useState([]);
  const [brokerLoading, setBrokerLoading] = useState(false);
  const [brokerError, setBrokerError] = useState("");
  const [brokerMessage, setBrokerMessage] = useState("");
  const [brokerMode, setBrokerMode] = useState("replace");
  const [upstoxProfile, setUpstoxProfile] = useState(null);

  // Phase 3: live market data.
  const [marketItems, setMarketItems] = useState([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState("");
  const [marketSearch, setMarketSearch] = useState("");
  const [marketSearchResults, setMarketSearchResults] = useState([]);
  const [marketSearchLoading, setMarketSearchLoading] = useState(false);
  // Phase 15: interactive historical price chart.
  const [chartSymbol, setChartSymbol] = useState("");
  const [chartRange, setChartRange] = useState("1y");
  const [chartData, setChartData] = useState(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState("");

  // Phase 3: Portfolio valuation and P&L.
  const [valuation, setValuation] = useState(null);
  const [valuationLoading, setValuationLoading] = useState(false);
  const [valuationError, setValuationError] = useState("");

  // Phase 16: portfolio performance and analytics.
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  // Phase 17: advanced portfolio analytics.
  const [advancedAnalytics, setAdvancedAnalytics] = useState(null);
  const [advancedAnalyticsLoading, setAdvancedAnalyticsLoading] = useState(false);
  const [advancedAnalyticsError, setAdvancedAnalyticsError] = useState("");
  const [advancedRange, setAdvancedRange] = useState("1y");

  // Phase 7: explainable risk and diversification engine.
  const [riskAnalysis, setRiskAnalysis] = useState(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskError, setRiskError] = useState("");

  // Phase 8: hypothetical portfolio simulator. Scenarios never write to SQLite.
  const [simulator, setSimulator] = useState(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState("");
  const [simAction, setSimAction] = useState("add");
  const [simForm, setSimForm] = useState({
    name: "", symbol: "", asset_type: "STOCK", amount: "", sector: "", market_cap: "", holding_id: "", reduce_amount: ""
  });


  const openXrayAdd = () => {
    setXrayForm({
      fund_name: "",
      stock_name: "",
      stock_symbol: "",
      amount: "",
    });
    setError("");
    setShowXrayAdd(true);
  };

  const closeXrayAdd = () => {
    if (xraySaving) return;
    setShowXrayAdd(false);
  };

  const handleXraySave = async (event) => {
    event.preventDefault();
    setXraySaving(true);
    setError("");

    const payload = {
      fund_name: xrayForm.fund_name.trim(),
      stock_name: xrayForm.stock_name.trim(),
      stock_symbol: xrayForm.stock_symbol.trim().toUpperCase(),
      amount: Number(xrayForm.amount || 0),
    };

    try {
      const response = await apiFetch(`${API}/xray/holding`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to add X-Ray holding");
      }

      setShowXrayAdd(false);
      await loadXray();
      setActivePage("xray");
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to add X-Ray holding.");
    } finally {
      setXraySaving(false);
    }
  };

  const loadValuation = async () => {
    setValuationLoading(true);
    setValuationError("");

    try {
      const response = await apiFetch(`${API}/portfolio/valuation`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to calculate portfolio valuation");
      }

      setValuation(data);
    } catch (err) {
      console.error(err);
      setValuationError(
        "Unable to calculate portfolio value. Make sure FastAPI and the market feed are running."
      );
    } finally {
      setValuationLoading(false);
    }
  };

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    setAnalyticsError("");
    try {
      const response = await apiFetch(`${API}/portfolio/analytics`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to load portfolio analytics");
      setAnalyticsData(data);
    } catch (err) {
      console.error(err);
      setAnalyticsError("Unable to load portfolio analytics right now.");
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loadAdvancedAnalytics = async (rangeValue = advancedRange) => {
    setAdvancedAnalyticsLoading(true);
    setAdvancedAnalyticsError("");
    try {
      const response = await apiFetch(`${API}/portfolio/advanced-analytics?range=${encodeURIComponent(rangeValue)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to load advanced analytics");
      setAdvancedAnalytics(data);
    } catch (err) {
      console.error(err);
      setAdvancedAnalyticsError("Unable to load advanced portfolio analytics right now.");
    } finally {
      setAdvancedAnalyticsLoading(false);
    }
  };

  const loadRisk = async () => {
    setRiskLoading(true);
    setRiskError("");
    try {
      const response = await apiFetch(`${API}/risk`);
      if (!response.ok) throw new Error("Failed to load risk analysis");
      const data = await response.json();
      setRiskAnalysis(data);
    } catch (err) {
      console.error(err);
      setRiskError("Unable to load risk analysis. Make sure FastAPI is running on port 8000.");
    } finally {
      setRiskLoading(false);
    }
  };

  const runSimulator = async () => {
    setSimLoading(true);
    setSimError("");
    try {
      let change;
      if (simAction === "add") {
        if (!simForm.amount || Number(simForm.amount) <= 0) throw new Error("Enter a scenario amount greater than 0");
        change = {
          action: "add", name: simForm.name.trim(), symbol: simForm.symbol.trim().toUpperCase(),
          asset_type: simForm.asset_type, amount: Number(simForm.amount),
          sector: simForm.sector || null, market_cap: simForm.market_cap || null
        };
      } else if (simAction === "remove") {
        if (!simForm.holding_id) throw new Error("Select a holding to remove");
        const selected = holdings.find((h) => String(h.id) === String(simForm.holding_id));
        change = { action: "remove", holding_id: Number(simForm.holding_id), symbol: selected?.symbol || "", amount: 0 };
      } else {
        if (!simForm.holding_id || !simForm.reduce_amount || Number(simForm.reduce_amount) <= 0) throw new Error("Select a holding and enter a reduction amount");
        const selected = holdings.find((h) => String(h.id) === String(simForm.holding_id));
        change = { action: "reduce", holding_id: Number(simForm.holding_id), symbol: selected?.symbol || "", amount: Number(simForm.reduce_amount) };
      }
      const response = await apiFetch(`${API}/simulate`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify([change])
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to run simulation");
      setSimulator(data);
    } catch (err) {
      console.error(err);
      setSimError(err.message || "Unable to run simulation.");
    } finally {
      setSimLoading(false);
    }
  };

  const resetSimulator = () => {
    setSimulator(null);
    setSimError("");
    setSimForm({ name: "", symbol: "", asset_type: "STOCK", amount: "", sector: "", market_cap: "", holding_id: "", reduce_amount: "" });
  };

  const loadPortfolio = async () => {
    setPortfolioLoading(true);
    setPortfolioError("");

    try {
      const response = await apiFetch(`${API}/portfolio`);

      if (!response.ok) {
        throw new Error("Failed to load portfolio");
      }

      const data = await response.json();
      setHoldings(data.holdings || []);
    } catch (err) {
      console.error(err);
      setPortfolioError(
        "Unable to load your portfolio. Make sure FastAPI is running on port 8000."
      );
    } finally {
      setPortfolioLoading(false);
    }
  };

  useEffect(() => {
    if (!authUser) return;
    loadPortfolio();
    loadXray();
    loadValuation();
    loadAnalytics();
    loadAdvancedAnalytics();
    loadRisk();
    loadAlerts();
    loadNews();
    loadAI();
    loadBroker();
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    if (activePage === "markets") {
      loadMarkets();
    }
    if (activePage === "analytics") {
      loadAdvancedAnalytics(advancedRange);
    }
    if (activePage === "risk") {
      loadRisk();
    }
    if (activePage === "alerts") {
      loadAlerts();
    }
    if (activePage === "news") {
      loadNews();
    }
    if (activePage === "ai") {
      loadAI();
    }
    if (activePage === "broker") {
      loadBroker();
    }
  }, [activePage, holdings, authUser]);

  const totalInvested = useMemo(
    () =>
      holdings.reduce(
        (sum, holding) => sum + Number(holding.invested_amount || 0),
        0
      ),
    [holdings]
  );

  const stockHoldings = holdings.filter(
    (item) => item.asset_type === "STOCK"
  );

  const fundHoldings = holdings.filter(
    (item) => item.asset_type === "MUTUAL_FUND"
  );

  const etfHoldings = holdings.filter((item) => item.asset_type === "ETF");

  const exposureEntries = Object.entries(
    result?.stock_exposure || {}
  ).sort(([, a], [, b]) => Number(b) - Number(a));

  const highestExposure = exposureEntries[0]?.[1] || 0;

  const effectiveExposureEntries = Object.entries(
    result?.effective_company_exposure || {}
  ).sort(([, a], [, b]) =>
    Number(b?.portfolio_percent || 0) - Number(a?.portfolio_percent || 0)
  );

  const fundExposureEntries = Object.entries(result?.fund_exposure || {}).sort(
    ([, a], [, b]) =>
      Number(b?.portfolio_percent || 0) - Number(a?.portfolio_percent || 0)
  );

  const fundOverlapEntries = Array.isArray(result?.fund_overlap)
    ? result.fund_overlap
    : [];

  const highConcentrationEntries = Object.entries(
    result?.high_concentration || {}
  ).sort(([, a], [, b]) => Number(b) - Number(a));

  const overlappingEntries = Object.entries(
    result?.overlapping_stocks || {}
  );

  const riskScore = Number(riskAnalysis?.risk_score ?? result?.risk_score ?? 0);
  const riskLevel = riskAnalysis?.risk_level || result?.risk_level || "Low";

  const riskTone =
    riskLevel === "High"
      ? "red"
      : riskLevel === "Moderate"
      ? "orange"
      : "green";

  const riskAlerts = alertsData?.alerts || [];

  const loadAlerts = async () => {
    setAlertsLoading(true);
    setAlertsError("");
    try {
      const response = await apiFetch(`${API}/alerts`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Unable to load alerts");
      }
      setAlertsData(data);
    } catch (err) {
      console.error(err);
      setAlertsError(
        "Unable to load alerts. Make sure FastAPI is running on port 8000."
      );
    } finally {
      setAlertsLoading(false);
    }
  };

  const loadNews = async () => {
    setNewsLoading(true);
    setNewsError("");
    try {
      const response = await apiFetch(`${API}/news?limit=40`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to load news");
      setNewsData(data);
    } catch (err) {
      console.error(err);
      setNewsError("Unable to load news. Check your internet connection and try Refresh.");
    } finally {
      setNewsLoading(false);
    }
  };

  const loadAI = async () => {
    setAiLoading(true);
    setAiError("");
    try {
      const response = await apiFetch(`${API}/ai`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to load AI intelligence");
      setAiData(data);
    } catch (err) {
      console.error(err);
      setAiError("Unable to load AI intelligence. Make sure FastAPI is running on port 8000.");
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (!authUser) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("broker") !== "upstox") return;
    const status = params.get("status");
    const message = params.get("message");
    if (status === "connected") {
      setBrokerMessage("Upstox connected successfully. You can now test and preview your holdings.");
      loadBroker();
    } else if (status === "error") {
      setBrokerError(message || "Upstox authorization failed. Please try again.");
    }
    window.history.replaceState({}, document.title, window.location.pathname);
  }, [authUser]);

  const connectUpstox = async () => {
    setBrokerLoading(true);
    setBrokerError("");
    setBrokerMessage("");
    try {
      const response = await apiFetch(`${API}/broker/upstox/authorize`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to start Upstox authorization");
      window.location.href = data.authorization_url;
    } catch (err) {
      console.error(err);
      setBrokerError(err.message || "Unable to start Upstox authorization.");
      setBrokerLoading(false);
    }
  };

  const disconnectUpstox = async () => {
    const data = await brokerAction("/broker/upstox/disconnect", {});
    if (data?.success) {
      setBrokerPreview(null);
      setUpstoxProfile(null);
      setBrokerMessage(data.message);
      await loadBroker();
    }
  };

  const loadUpstoxProfile = async () => {
    const data = await brokerAction("/broker/upstox/profile");
    if (data) setUpstoxProfile(data.profile || {});
  };

  const loadBroker = async () => {
    setBrokerLoading(true);
    setBrokerError("");
    try {
      const [providersRes, connectionsRes, historyRes] = await Promise.all([
        apiFetch(`${API}/broker/providers`),
        apiFetch(`${API}/broker/connections`),
        apiFetch(`${API}/broker/sync-history?limit=8`),
      ]);
      const providers = await providersRes.json();
      const connections = await connectionsRes.json();
      const history = await historyRes.json();
      if (!providersRes.ok) throw new Error(providers.detail || "Unable to load broker providers");
      if (!connectionsRes.ok) throw new Error(connections.detail || "Unable to load broker connections");
      setBrokerProviders(providers.providers || []);
      setBrokerConnections(connections.connections || []);
      setBrokerHistory(history.history || []);
    } catch (err) {
      console.error(err);
      setBrokerError(err.message || "Unable to load broker integration.");
    } finally {
      setBrokerLoading(false);
    }
  };

  const brokerAction = async (path, body = null) => {
    setBrokerLoading(true);
    setBrokerError("");
    setBrokerMessage("");
    try {
      const response = await apiFetch(`${API}${path}`, {
        method: body ? "POST" : "GET",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Broker request failed");
      return data;
    } catch (err) {
      console.error(err);
      setBrokerError(err.message || "Broker request failed");
      return null;
    } finally {
      setBrokerLoading(false);
    }
  };

  const testBroker = async () => {
    const data = await brokerAction("/broker/test", { provider: brokerProvider });
    if (data) {
      setBrokerMessage(`${data.message} ${data.holding_count} holdings detected.`);
      await loadBroker();
    }
  };

  const previewBroker = async () => {
    const data = await brokerAction(`/broker/preview?provider=${encodeURIComponent(brokerProvider)}`);
    if (data) setBrokerPreview(data);
  };

  const syncBroker = async () => {
    const data = await brokerAction("/broker/sync", { provider: brokerProvider, mode: brokerMode, confirm: true });
    if (data?.success) {
      setBrokerMessage(`${data.message} Imported ${data.imported_count} holdings.`);
      setBrokerPreview(null);
      await Promise.all([loadPortfolio(), loadXray(), loadValuation(), loadAnalytics(), loadRisk(), loadAlerts(), loadNews(), loadAI(), loadBroker()]);
    }
  };

  const filteredNews = (newsData?.items || []).filter((item) => {
    if (newsFilter === "portfolio") return item.is_portfolio_relevant;
    if (newsFilter === "positive") return item.impact === "Positive";
    if (newsFilter === "negative") return item.impact === "Negative";
    return true;
  });

  const loadXray = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiFetch(`${API}/xray`);

      if (!response.ok) {
        throw new Error("Failed to load X-Ray data");
      }

      const data = await response.json();
      setResult(data);
      loadRisk();
    } catch (err) {
      console.error(err);
      setError(
        "Unable to load X-Ray data. Make sure FastAPI is running on port 8000."
      );
    } finally {
      setLoading(false);
    }
  };

  const loadMarkets = async () => {
    setMarketLoading(true);
    setMarketError("");

    const portfolioSymbols = holdings
      .filter((holding) => holding.asset_type === "STOCK" && holding.symbol)
      .map((holding) => holding.symbol.trim().toUpperCase())
      .filter(Boolean);

    const uniqueSymbols = [...new Set(portfolioSymbols)];

    try {
      const query = uniqueSymbols.length
        ? `?symbols=${encodeURIComponent(uniqueSymbols.join(","))}`
        : "";
      const response = await apiFetch(`${API}/markets${query}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to load market data");
      }

      setMarketItems(data.items || []);
      if ((data.items || []).every((item) => item.price == null)) {
        setMarketError("Live market feed is unavailable right now. Try Refresh.");
      }
    } catch (err) {
      console.error(err);
      setMarketError(
        "Unable to load market data. Check your internet connection and try Refresh."
      );
    } finally {
      setMarketLoading(false);
    }
  };

  const searchMarket = async () => {
    const query = marketSearch.trim();
    if (!query) {
      setMarketSearchResults([]);
      return;
    }

    setMarketSearchLoading(true);
    try {
      const response = await apiFetch(
        `${API}/markets/search?q=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Search failed");
      }
      setMarketSearchResults(data.results || []);
    } catch (err) {
      console.error(err);
      setMarketSearchResults([]);
    } finally {
      setMarketSearchLoading(false);
    }
  };

  const loadMarketHistory = async (symbol = chartSymbol, rangeValue = chartRange) => {
    if (!symbol) return;
    setChartLoading(true);
    setChartError("");
    try {
      const response = await apiFetch(
        `${API}/markets/history?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(rangeValue)}`
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Unable to load price history");
      setChartData(data);
    } catch (err) {
      console.error(err);
      setChartData(null);
      setChartError(err.message || "Unable to load historical prices.");
    } finally {
      setChartLoading(false);
    }
  };

  const selectMarketChart = (symbol) => {
    setChartSymbol(symbol);
    setChartRange("1y");
    loadMarketHistory(symbol, "1y");
  };

  useEffect(() => {
    if (activePage !== "markets" || chartSymbol || marketItems.length === 0) return;
    const firstStock = marketItems.find((item) => item.type === "PORTFOLIO" && item.symbol);
    const firstIndex = marketItems.find((item) => item.type === "INDEX" && item.symbol);
    const first = firstStock || firstIndex;
    if (first) {
      const symbol = first.symbol || first.display_symbol;
      setChartSymbol(symbol);
      loadMarketHistory(symbol, "1y");
    }
  }, [activePage, marketItems, chartSymbol]);

  const marketIndexes = marketItems.filter((item) => item.type === "INDEX");
  const portfolioMarketItems = marketItems.filter(
    (item) => item.type === "PORTFOLIO"
  );

  const formatMarketPrice = (value) =>
    value == null
      ? "—"
      : `₹${Number(value).toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;

  const MarketChange = ({ item }) => {
    if (item.change_percent == null) {
      return <span className="text-xs text-slate-600">Unavailable</span>;
    }

    const positive = Number(item.change_percent) >= 0;
    return (
      <span
        className={`text-xs font-semibold ${
          positive ? "text-emerald-400" : "text-red-400"
        }`}
      >
        {positive ? "+" : ""}{item.change_percent}% ({positive ? "+" : ""}
        {Number(item.change).toFixed(2)})
      </span>
    );
  };

  const analyzePortfolio = async () => {
    await loadXray();
    setActivePage("xray");
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setPortfolioError("");
    setShowAdd(true);
  };

  const openEdit = (holding) => {
    setEditingId(holding.id);
    setForm({
      asset_type: holding.asset_type,
      name: holding.name,
      symbol: holding.symbol || "",
      units: holding.units ?? "",
      buy_price: holding.buy_price ?? "",
      invested_amount: holding.invested_amount ?? "",
      buy_date: holding.buy_date || "",
    });
    setPortfolioError("");
    setShowAdd(true);
  };

  const closeModal = () => {
    if (saving) return;

    setShowAdd(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSave = async (event) => {
    event.preventDefault();

    setSaving(true);
    setPortfolioError("");

    const payload = {
      asset_type: form.asset_type,
      name: form.name.trim(),
      symbol: form.symbol.trim() || null,
      units: Number(form.units || 0),
      buy_price: Number(form.buy_price || 0),
      invested_amount: Number(form.invested_amount || 0),
      buy_date: form.buy_date || null,
    };

    try {
      const url = editingId
        ? `${API}/portfolio/${editingId}`
        : `${API}/portfolio`;

      const response = await apiFetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to save investment");
      }

      await loadPortfolio();
      await loadValuation();
      closeModal();
      setActivePage("portfolio");
    } catch (err) {
      console.error(err);
      setPortfolioError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteHolding = async (id) => {
    const confirmed = window.confirm(
      "Remove this investment from your InShield portfolio?"
    );

    if (!confirmed) return;

    setPortfolioError("");

    try {
      const response = await apiFetch(`${API}/portfolio/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to delete investment");
      }

      await loadPortfolio();
      await loadValuation();
    } catch (err) {
      console.error(err);
      setPortfolioError(err.message || "Unable to remove the investment.");
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#070b12] text-white">
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#070b12]/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between px-4 lg:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-lg font-bold text-cyan-300">
              I
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">InShield</h1>
              <p className="hidden text-[10px] uppercase tracking-[0.18em] text-slate-500 sm:block">
                Investment Intelligence
              </p>
            </div>
          </div>

          <div className="hidden w-full max-w-md items-center rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-2.5 md:flex">
            <span className="mr-3 text-slate-500">⌕</span>
            <input
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-600"
              placeholder="Search stocks, mutual funds, ETFs..."
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Open navigation"
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:border-cyan-500 hover:text-cyan-300 lg:hidden"
            >
              <span className="text-lg">☰</span>
            </button>
            <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs text-emerald-400 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Portfolio connected
            </div>
            <div className="hidden text-right sm:block">
              <div className="text-[11px] font-medium text-slate-300">{authUser?.mobile ? `+91 ${authUser.mobile}` : "InShield user"}</div>
              <button type="button" onClick={onLogout} className="text-[10px] text-slate-500 hover:text-red-300">Sign out</button>
            </div>
            <button type="button" onClick={onLogout} aria-label="Sign out" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold text-slate-200 hover:bg-red-500/20 hover:text-red-300">{authUser?.mobile?.slice(-2) || "IS"}</button>
            </div>
          </div>
        </div>
      </header>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <aside className="relative flex h-full w-[min(86vw,340px)] flex-col border-r border-slate-800 bg-[#080c13] px-4 py-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-lg font-bold text-cyan-300">I</div>
                <div>
                  <p className="font-bold">InShield</p>
                  <p className="text-[9px] uppercase tracking-[0.18em] text-slate-600">Investment Intelligence</p>
                </div>
              </div>
              <button type="button" onClick={() => setMobileNavOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 text-slate-400 hover:text-white" aria-label="Close navigation">✕</button>
            </div>

            <div className="mb-5 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Portfolio value</p>
              <p className="mt-1 text-xl font-bold">{formatINR(totalInvested)}</p>
              <p className="mt-2 text-xs text-emerald-400">{holdings.length} positions tracked</p>
            </div>

            <nav className="space-y-1 overflow-y-auto">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setActivePage(item.id); setMobileNavOpen(false); }}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-sm transition ${activePage === item.id ? "bg-cyan-500/10 text-cyan-300" : "text-slate-400 hover:bg-slate-900 hover:text-white"}`}
                >
                  <span className="w-5 text-center text-base">{item.icon}</span>
                  {item.label}
                  {item.id === "alerts" && alertsData?.active_alerts > 0 && (
                    <span className="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-400">{alertsData.active_alerts}</span>
                  )}
                </button>
              ))}
            </nav>

            <div className="mt-auto rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-sm font-semibold">Your portfolio, your data</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Tracked positions stay in your InShield application database.</p>
            </div>
          </aside>
        </div>
      )}

      <div className="flex">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 border-r border-slate-800/80 bg-[#080c13] lg:block">
          <div className="flex h-full flex-col px-3 py-5">
            <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-xs text-slate-500">PORTFOLIO VALUE</p>
              <p className="mt-1 text-xl font-bold">{formatINR(totalInvested)}</p>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-emerald-400">
                  {holdings.length} positions
                </span>
                <span className="text-slate-500">Tracked</span>
              </div>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setActivePage(item.id); setMobileNavOpen(false); }}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition ${
                    activePage === item.id
                      ? "bg-cyan-500/10 text-cyan-300"
                      : "text-slate-400 hover:bg-slate-900 hover:text-white"
                  }`}
                >
                  <span className="w-5 text-center text-base">{item.icon}</span>
                  {item.label}
                  {item.id === "alerts" && alertsData?.active_alerts > 0 && (
                    <span className="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-400">
                      {alertsData.active_alerts}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            <div className="mt-auto rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-sm font-semibold">Your portfolio, your data</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                InShield stores your tracked positions locally in the application
                database.
              </p>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1500px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
            <div className="mb-5 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3 lg:hidden">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-slate-600">Current section</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-slate-200">{navItems.find((item) => item.id === activePage)?.label}</p>
              </div>
              <button type="button" onClick={() => setMobileNavOpen(true)} className="rounded-xl bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300">Menu</button>
            </div>

            {activePage === "dashboard" && (
              <>
                <div className="mb-7 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
                  <div>
                    <p className="text-sm text-slate-500">Overview</p>
                    <h2 className="mt-1 text-3xl font-bold tracking-tight">
                      Your investment dashboard
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm text-slate-400">
                      Track what you own today. InShield will progressively add
                      live valuation, X-Ray exposure and risk intelligence.
                    </p>
                  </div>

                  <button
                    onClick={openAdd}
                    className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/10 transition hover:bg-cyan-400"
                  >
                    + Add Investment
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    label="Current value"
                    value={valuation ? formatINR(valuation.current_value) : "—"}
                    sub={valuation ? `${valuation.valuation_coverage_percent}% valued` : "Calculating..."}
                    tone="blue"
                  />
                  <StatCard
                    label="Invested"
                    value={formatINR(totalInvested)}
                    sub={`${holdings.length} positions`}
                    tone="purple"
                  />
                  <StatCard
                    label="Overall P&L"
                    value={valuation ? `${valuation.overall_pnl >= 0 ? "+" : ""}${formatINR(valuation.overall_pnl)}` : "—"}
                    sub={valuation ? `${valuation.overall_pnl_percent >= 0 ? "+" : ""}${valuation.overall_pnl_percent}%` : "Calculating..."}
                    tone={valuation?.overall_pnl >= 0 ? "green" : "orange"}
                  />
                  <StatCard
                    label="Today's P&L"
                    value={valuation ? `${valuation.day_pnl >= 0 ? "+" : ""}${formatINR(valuation.day_pnl)}` : "—"}
                    sub={valuation ? `${valuation.day_pnl_percent >= 0 ? "+" : ""}${valuation.day_pnl_percent}%` : "Calculating..."}
                    tone={valuation?.day_pnl >= 0 ? "green" : "orange"}
                  />
                </div>

                {analyticsError && (
                  <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
                    {analyticsError}
                  </div>
                )}

                {analyticsLoading ? (
                  <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center text-sm text-slate-500">Loading portfolio analytics...</div>
                ) : analyticsData ? (
                  <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div><h3 className="font-semibold">Portfolio performance</h3><p className="mt-1 text-xs text-slate-500">Track your portfolio value over time from InShield snapshots.</p></div>
                        <button onClick={loadAnalytics} disabled={analyticsLoading} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-400 hover:border-cyan-500 disabled:opacity-50">↻ Refresh</button>
                      </div>
                      {analyticsData.history?.length ? <PortfolioPerformanceChart history={analyticsData.history} /> : <div className="mt-5 rounded-xl border border-dashed border-slate-700 p-8 text-center"><p className="font-medium">Your performance history is starting</p><p className="mt-2 text-sm text-slate-500">InShield creates a daily snapshot whenever your portfolio is valued. Come back after additional trading days to see the curve.</p></div>}
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                      <h3 className="font-semibold">Current allocation</h3><p className="mt-1 text-xs text-slate-500">Where your current portfolio value is concentrated.</p>
                      <div className="mt-5 space-y-4">
                        {(analyticsData.allocation || []).length ? analyticsData.allocation.map((item) => <div key={item.asset_type}><div className="mb-2 flex justify-between text-sm"><span>{item.asset_type === "MUTUAL_FUND" ? "Mutual Funds" : item.asset_type === "STOCK" ? "Stocks" : item.asset_type === "ETF" ? "ETFs" : item.asset_type}</span><span className="font-semibold text-cyan-300">{Number(item.percent).toFixed(1)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.min(100, Math.max(0, Number(item.percent)))}%` }} /></div><p className="mt-1 text-[11px] text-slate-600">{formatINR(item.value)}</p></div>) : <p className="text-sm text-slate-500">No allocation data yet.</p>}
                      </div>
                    </div>
                  </div>
                ) : null}

                {analyticsData && (analyticsData.top_performers?.length || analyticsData.bottom_performers?.length) ? (
                  <div className="mt-5 grid gap-5 lg:grid-cols-2">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><h3 className="font-semibold">Top performers</h3><p className="mt-1 text-xs text-slate-500">Largest current P&L by holding.</p><div className="mt-4 space-y-2">{analyticsData.top_performers.slice(0,3).map((item) => <div key={`top-${item.id}`} className="flex items-center justify-between rounded-xl bg-slate-950/60 px-4 py-3"><div><p className="text-sm font-medium">{item.name}</p><p className="text-[11px] text-slate-600">{item.symbol || item.asset_type}</p></div><div className="text-right"><p className={`text-sm font-semibold ${item.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>{item.pnl >= 0 ? "+" : ""}{formatINR(item.pnl)}</p><p className="text-[11px] text-slate-500">{item.pnl >= 0 ? "+" : ""}{item.pnl_percent}%</p></div></div>)}</div></div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><h3 className="font-semibold">Needs attention</h3><p className="mt-1 text-xs text-slate-500">Holdings with the weakest current P&L.</p><div className="mt-4 space-y-2">{analyticsData.bottom_performers.slice(0,3).map((item) => <div key={`bottom-${item.id}`} className="flex items-center justify-between rounded-xl bg-slate-950/60 px-4 py-3"><div><p className="text-sm font-medium">{item.name}</p><p className="text-[11px] text-slate-600">{item.symbol || item.asset_type}</p></div><div className="text-right"><p className={`text-sm font-semibold ${item.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>{item.pnl >= 0 ? "+" : ""}{formatINR(item.pnl)}</p><p className="text-[11px] text-slate-500">{item.pnl >= 0 ? "+" : ""}{item.pnl_percent}%</p></div></div>)}</div></div>
                  </div>
                ) : null}

                {valuationError && (
                  <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                    {valuationError}
                  </div>
                )}

                <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">Your holdings</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Your saved investments from the Portfolio page.
                      </p>
                    </div>
                    <button
                      onClick={() => setActivePage("portfolio")}
                      className="text-xs text-cyan-300"
                    >
                      View portfolio →
                    </button>
                  </div>

                  {portfolioLoading ? (
                    <div className="mt-6 p-6 text-center text-sm text-slate-500">
                      Loading portfolio...
                    </div>
                  ) : holdings.length === 0 ? (
                    <div className="mt-6 rounded-xl border border-dashed border-slate-700 p-8 text-center">
                      <p className="font-medium">Your portfolio is empty</p>
                      <p className="mt-2 text-sm text-slate-500">
                        Add your first stock, mutual fund or ETF.
                      </p>
                      <button
                        onClick={openAdd}
                        className="mt-5 rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950"
                      >
                        Add first investment
                      </button>
                    </div>
                  ) : (
                    <div className="mt-5 space-y-2">
                      {holdings.slice(0, 5).map((holding) => (
                        <div
                          key={holding.id}
                          className="flex items-center justify-between rounded-xl bg-slate-950/70 px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold text-cyan-300">
                              {holding.asset_type === "STOCK"
                                ? "S"
                                : holding.asset_type === "ETF"
                                ? "E"
                                : "MF"}
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {holding.name}
                              </p>
                              <p className="text-[11px] text-slate-600">
                                {holding.symbol || "Investment"}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold">
                              {formatINR(
                                valuation?.holdings?.find((item) => item.id === holding.id)?.current_value ?? holding.invested_amount
                              )}
                            </span>
                            {(() => {
                              const valued = valuation?.holdings?.find((item) => item.id === holding.id);
                              return valued?.overall_pnl != null ? (
                                <p className={`text-[11px] ${valued.overall_pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                  {valued.overall_pnl >= 0 ? "+" : ""}{formatINR(valued.overall_pnl)}
                                </p>
                              ) : null;
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {activePage === "analytics" && (
              <section>
                <div className="mb-7 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
                  <div>
                    <p className="text-sm text-slate-500">Analytics</p>
                    <h2 className="mt-1 text-3xl font-bold tracking-tight">Advanced portfolio analytics</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                      A deeper view of performance, drawdowns, consistency and NIFTY 50-relative behaviour using your actual InShield valuation snapshots.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[['1m','1M'],['3m','3M'],['6m','6M'],['1y','1Y'],['all','All']].map(([id,label]) => (
                      <button key={id} onClick={() => { setAdvancedRange(id); loadAdvancedAnalytics(id); }} disabled={advancedAnalyticsLoading}
                        className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold ${advancedRange === id ? 'bg-cyan-500 text-slate-950' : 'border border-slate-700 bg-slate-900 text-slate-400 hover:border-cyan-500'} disabled:opacity-50`}>
                        {label}
                      </button>
                    ))}
                    <button onClick={() => loadAdvancedAnalytics(advancedRange)} disabled={advancedAnalyticsLoading}
                      className="rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-slate-400 hover:border-cyan-500 disabled:opacity-50">↻</button>
                  </div>
                </div>

                {advancedAnalyticsError && <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">{advancedAnalyticsError}</div>}

                {advancedAnalyticsLoading && !advancedAnalytics ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center text-sm text-slate-500">Calculating advanced analytics...</div>
                ) : advancedAnalytics ? (
                  <>
                    <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <StatCard label="Snapshot return" value={advancedAnalytics.metrics?.snapshot_return != null ? `${advancedAnalytics.metrics.snapshot_return >= 0 ? '+' : ''}${advancedAnalytics.metrics.snapshot_return}%` : '—'} sub={`${advancedAnalytics.snapshot_count || 0} snapshots`} tone={Number(advancedAnalytics.metrics?.snapshot_return) >= 0 ? 'green' : 'orange'} />
                      <StatCard label="Annualized return" value={advancedAnalytics.metrics?.annualized_return != null ? `${advancedAnalytics.metrics.annualized_return >= 0 ? '+' : ''}${advancedAnalytics.metrics.annualized_return}%` : '—'} sub="Needs sufficient history" tone="blue" />
                      <StatCard label="Max drawdown" value={advancedAnalytics.metrics?.max_drawdown != null ? `${advancedAnalytics.metrics.max_drawdown}%` : '—'} sub="Peak-to-trough" tone="orange" />
                      <StatCard label="Volatility" value={advancedAnalytics.metrics?.volatility != null ? `${advancedAnalytics.metrics.volatility}%` : '—'} sub="Annualized snapshot volatility" tone="purple" />
                    </div>

                    <div className="mb-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div><h3 className="font-semibold">Portfolio vs NIFTY 50</h3><p className="mt-1 text-xs text-slate-500">Indexed performance from the first overlapping observation.</p></div>
                          <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-[10px] uppercase tracking-wider text-slate-500">{advancedAnalytics.range}</span>
                        </div>
                        {advancedAnalytics.history?.length >= 2 ? <AdvancedPerformanceChart history={advancedAnalytics.history} benchmark={advancedAnalytics.benchmark} /> : <div className="mt-5 rounded-xl border border-dashed border-slate-700 p-8 text-center"><p className="font-medium">Build your performance history</p><p className="mt-2 text-sm leading-6 text-slate-500">InShield currently has {advancedAnalytics.snapshot_count || 0} usable snapshot. Keep valuing your portfolio on different days to unlock trend analytics.</p></div>}
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                        <h3 className="font-semibold">Risk-adjusted view</h3><p className="mt-1 text-xs text-slate-500">Statistics derived from available snapshot returns.</p>
                        <div className="mt-5 space-y-3">
                          {[
                            ['Sharpe ratio', advancedAnalytics.metrics?.sharpe != null ? advancedAnalytics.metrics.sharpe : '—', 'Higher can indicate better return per unit of observed volatility.'],
                            ['Best day', advancedAnalytics.metrics?.best_day != null ? `+${advancedAnalytics.metrics.best_day}%` : '—', 'Largest positive snapshot-to-snapshot move.'],
                            ['Worst day', advancedAnalytics.metrics?.worst_day != null ? `${advancedAnalytics.metrics.worst_day}%` : '—', 'Largest negative snapshot-to-snapshot move.'],
                            ['Positive days', advancedAnalytics.metrics?.hit_rate != null ? `${advancedAnalytics.metrics.hit_rate}%` : '—', `${advancedAnalytics.metrics?.positive_days || 0} positive observations.`],
                            ['NIFTY correlation', advancedAnalytics.metrics?.correlation_to_nifty != null ? advancedAnalytics.metrics.correlation_to_nifty : '—', 'Only available with enough aligned observations.'],
                            ['NIFTY beta', advancedAnalytics.metrics?.beta_to_nifty != null ? advancedAnalytics.metrics.beta_to_nifty : '—', 'Sensitivity estimate from aligned observations.'],
                          ].map(([label,value,sub]) => <div key={label} className="rounded-xl bg-slate-950/60 px-4 py-3"><div className="flex items-center justify-between gap-3"><span className="text-sm text-slate-300">{label}</span><span className="font-semibold text-cyan-300">{value}</span></div><p className="mt-1 text-[10px] leading-4 text-slate-600">{sub}</p></div>)}
                        </div>
                      </div>
                    </div>

                    <div className="mb-5 grid gap-5 lg:grid-cols-3">
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><p className="text-xs uppercase tracking-wider text-slate-500">NIFTY comparison</p><p className={`mt-2 text-2xl font-bold ${Number(advancedAnalytics.metrics?.relative_performance) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{advancedAnalytics.metrics?.relative_performance != null ? `${advancedAnalytics.metrics.relative_performance >= 0 ? '+' : ''}${advancedAnalytics.metrics.relative_performance}%` : '—'}</p><p className="mt-1 text-xs text-slate-500">Portfolio minus NIFTY over overlapping period.</p></div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><p className="text-xs uppercase tracking-wider text-slate-500">Current P&L</p><p className={`mt-2 text-2xl font-bold ${Number(advancedAnalytics.current?.overall_pnl) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{advancedAnalytics.current ? `${advancedAnalytics.current.overall_pnl >= 0 ? '+' : ''}${formatINR(advancedAnalytics.current.overall_pnl)}` : '—'}</p><p className="mt-1 text-xs text-slate-500">Current unrealized portfolio P&L from valuation.</p></div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><p className="text-xs uppercase tracking-wider text-slate-500">Data health</p><p className="mt-2 text-2xl font-bold text-cyan-300">{advancedAnalytics.data_status === 'strong' ? 'Strong' : advancedAnalytics.data_status === 'developing' ? 'Developing' : advancedAnalytics.data_status === 'starting' ? 'Starting' : 'No history'}</p><p className="mt-1 text-xs text-slate-500">{advancedAnalytics.snapshot_count || 0} snapshots · {advancedAnalytics.date_start || '—'} to {advancedAnalytics.date_end || '—'}</p></div>
                    </div>

                    <div className="grid gap-5 xl:grid-cols-2">
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                        <h3 className="font-semibold">Holding contribution</h3><p className="mt-1 text-xs text-slate-500">Current holding P&L and portfolio weight.</p>
                        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-600"><tr><th className="px-3 py-3">Holding</th><th className="px-3 py-3">Weight</th><th className="px-3 py-3">P&L</th><th className="px-3 py-3">Return</th></tr></thead><tbody>{(advancedAnalytics.performers || []).map(item => <tr key={`adv-${item.id}`} className="border-b border-slate-900"><td className="px-3 py-3"><p className="font-medium">{item.name}</p><p className="text-[10px] text-slate-600">{item.symbol || item.asset_type}</p></td><td className="px-3 py-3 text-slate-400">{item.portfolio_weight}%</td><td className={`px-3 py-3 font-semibold ${item.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{item.pnl >= 0 ? '+' : ''}{formatINR(item.pnl)}</td><td className={`px-3 py-3 ${item.pnl_percent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{item.pnl_percent >= 0 ? '+' : ''}{item.pnl_percent}%</td></tr>)}</tbody></table></div>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                        <h3 className="font-semibold">Allocation & concentration</h3><p className="mt-1 text-xs text-slate-500">Current value by asset type.</p>
                        <div className="mt-5 space-y-4">{(advancedAnalytics.allocation || []).map(item => <div key={item.asset_type}><div className="mb-2 flex justify-between text-sm"><span>{item.asset_type === 'MUTUAL_FUND' ? 'Mutual Funds' : item.asset_type === 'STOCK' ? 'Stocks' : item.asset_type === 'ETF' ? 'ETFs' : item.asset_type}</span><span className="font-semibold text-cyan-300">{item.percent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-400" style={{width:`${Math.min(100,Math.max(0,Number(item.percent)))}%`}} /></div><p className="mt-1 text-[11px] text-slate-600">{formatINR(item.value)}</p></div>)}</div>
                        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/50 p-4"><p className="text-xs font-semibold text-slate-300">Methodology</p>{(advancedAnalytics.notes || []).map((note,i) => <p key={i} className="mt-2 text-[11px] leading-5 text-slate-600">• {note}</p>)}</div>
                      </div>
                    </div>
                  </>
                ) : null}
              </section>
            )}

            {activePage === "portfolio" && (
              <section>
                <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                  <div>
                    <p className="text-sm text-slate-500">Portfolio</p>
                    <h2 className="mt-1 text-3xl font-bold">Your investments</h2>
                    <p className="mt-2 text-sm text-slate-400">
                      Add and manage the investments you actually own.
                    </p>
                  </div>

                  <button
                    onClick={openAdd}
                    className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/10 hover:bg-cyan-400"
                  >
                    + Add Investment
                  </button>
                </div>

                <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    label="Current value"
                    value={valuation ? formatINR(valuation.current_value) : "—"}
                    sub={valuation ? `${valuation.valuation_coverage_percent}% valued` : "Calculating..."}
                    tone="blue"
                  />
                  <StatCard
                    label="Invested"
                    value={formatINR(totalInvested)}
                    sub="Across all positions"
                    tone="purple"
                  />
                  <StatCard
                    label="Overall P&L"
                    value={valuation ? `${valuation.overall_pnl >= 0 ? "+" : ""}${formatINR(valuation.overall_pnl)}` : "—"}
                    sub={valuation ? `${valuation.overall_pnl_percent >= 0 ? "+" : ""}${valuation.overall_pnl_percent}%` : "Calculating..."}
                    tone={valuation?.overall_pnl >= 0 ? "green" : "orange"}
                  />
                  <StatCard
                    label="Today's P&L"
                    value={valuation ? `${valuation.day_pnl >= 0 ? "+" : ""}${formatINR(valuation.day_pnl)}` : "—"}
                    sub={valuation ? `${valuation.day_pnl_percent >= 0 ? "+" : ""}${valuation.day_pnl_percent}%` : "Calculating..."}
                    tone={valuation?.day_pnl >= 0 ? "green" : "orange"}
                  />
                </div>

                <div className="mb-5 flex justify-end">
                  <button
                    onClick={loadValuation}
                    disabled={valuationLoading}
                    className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold hover:border-cyan-500 disabled:opacity-50"
                  >
                    {valuationLoading ? "Updating valuation..." : "Refresh valuation"}
                  </button>
                </div>

                {valuationError && (
                  <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                    {valuationError}
                  </div>
                )}

                {portfolioError && (
                  <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                    {portfolioError}
                  </div>
                )}

                <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
                  <div className="hidden grid-cols-[2fr_0.9fr_0.8fr_1fr_1fr_150px] gap-4 border-b border-slate-800 px-5 py-4 text-[11px] uppercase tracking-wider text-slate-500 md:grid">
                    <span>Investment</span>
                    <span>Type</span>
                    <span>Units</span>
                    <span>Invested</span>
                    <span>Current / P&L</span>
                    <span>Actions</span>
                  </div>

                  {portfolioLoading ? (
                    <div className="p-10 text-center text-sm text-slate-500">
                      Loading portfolio...
                    </div>
                  ) : holdings.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-2xl text-cyan-300">
                        +
                      </div>
                      <h3 className="mt-4 text-lg font-semibold">
                        No investments yet
                      </h3>
                      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                        Add your first stock, mutual fund or ETF. It will be
                        saved by the InShield backend.
                      </p>
                      <button
                        onClick={openAdd}
                        className="mt-6 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950"
                      >
                        Add Investment
                      </button>
                    </div>
                  ) : (
                    holdings.map((holding) => (
                      <div
                        key={holding.id}
                        className="grid gap-4 border-b border-slate-800/70 px-5 py-4 last:border-0 md:grid-cols-[2fr_0.9fr_0.8fr_1fr_1fr_150px] md:items-center"
                      >
                        <div>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-xs font-bold text-cyan-300">
                              {holding.asset_type === "STOCK"
                                ? "S"
                                : holding.asset_type === "ETF"
                                ? "E"
                                : "MF"}
                            </div>
                            <div>
                              <p className="font-medium">{holding.name}</p>
                              <p className="text-xs text-slate-600">
                                {holding.symbol || "No symbol"}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] uppercase text-slate-600 md:hidden">
                            Type
                          </p>
                          <AssetBadge type={holding.asset_type} />
                        </div>

                        <div>
                          <p className="text-[10px] uppercase text-slate-600 md:hidden">
                            Units
                          </p>
                          <p className="text-sm text-slate-300">
                            {formatNumber(holding.units)}
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] uppercase text-slate-600 md:hidden">
                            Invested
                          </p>
                          <p className="text-sm font-semibold">
                            {formatINR(holding.invested_amount)}
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] uppercase text-slate-600 md:hidden">
                            Current / P&L
                          </p>
                          {(() => {
                            const valued = valuation?.holdings?.find((item) => item.id === holding.id);
                            if (!valued || valued.current_value == null) {
                              return <p className="text-xs text-slate-600">NAV / price unavailable</p>;
                            }
                            return (
                              <>
                                <p className="text-sm font-semibold">{formatINR(valued.current_value)}</p>
                                <p className={`text-xs ${valued.overall_pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                  {valued.overall_pnl >= 0 ? "+" : ""}{formatINR(valued.overall_pnl)} ({valued.pnl_percent ?? valued.pnl_percent}%)
                                </p>
                              </>
                            );
                          })()}
                        </div>

                        <div className="flex gap-2 md:justify-end">
                          <button
                            onClick={() => openEdit(holding)}
                            className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 hover:border-cyan-500 hover:text-cyan-300"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteHolding(holding.id)}
                            className="rounded-lg border border-slate-800 px-2.5 py-1.5 text-xs text-slate-500 hover:border-red-500/50 hover:text-red-400"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            )}

            {activePage === "xray" && (
              <section>
                <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                  <div>
                    <p className="text-sm text-slate-500">Portfolio intelligence</p>
                    <h2 className="mt-1 text-3xl font-bold">Portfolio X-Ray</h2>
                    <p className="mt-2 text-sm text-slate-400">
                      See effective exposure after looking through your mutual funds.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={openXrayAdd}
                      className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/10 hover:bg-cyan-400"
                    >
                      + Add Fund Holding
                    </button>
                    <button
                      onClick={analyzePortfolio}
                      disabled={loading}
                      className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold hover:border-cyan-500 disabled:opacity-50"
                    >
                      {loading ? "Refreshing..." : "Refresh analysis"}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                    {error}
                  </div>
                )}

                {!result || result.message === "No X-Ray data available" ? (
                  <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-2xl text-cyan-300">
                      ◉
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">
                      No X-Ray data yet
                    </h3>
                    <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
                      Add the stocks held inside your mutual funds to calculate
                      concentration and overlapping holdings.
                    </p>
                    <button
                      onClick={openXrayAdd}
                      className="mt-6 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950"
                    >
                      Add first fund holding
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <StatCard
                        label="Total exposure"
                        value={formatINR(result.total_exposure)}
                        sub="Across X-Ray holdings"
                        tone="blue"
                      />
                      <StatCard
                        label="Stocks analyzed"
                        value={exposureEntries.length}
                        sub="Underlying companies"
                        tone="green"
                      />
                      <StatCard
                        label="Overlapping stocks"
                        value={Object.keys(result.overlapping_stocks || {}).length}
                        sub="Present in multiple funds"
                        tone="purple"
                      />
                    </div>

                    <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                        <h3 className="font-semibold">Effective company exposure</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Percentage of total X-Ray exposure represented by each company.
                        </p>

                        <div className="mt-6 space-y-5">
                          {exposureEntries.length === 0 ? (
                            <p className="text-sm text-slate-500">No exposure data available.</p>
                          ) : (
                            exposureEntries.map(([stock, percentage]) => (
                              <div key={stock}>
                                <div className="mb-2 flex justify-between text-sm">
                                  <span>{stock}</span>
                                  <span className="font-semibold text-cyan-300">
                                    {percentage}%
                                  </span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                                  <div
                                    className="h-full rounded-full bg-cyan-400"
                                    style={{
                                      width: `${Math.min(100, Number(percentage))}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400">⚠</span>
                          <h3 className="font-semibold text-amber-300">Concentration</h3>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-500">
                          Holdings at or above 10% of total X-Ray exposure. These are
                          analytics signals, not investment advice.
                        </p>

                        <div className="mt-5 space-y-2">
                          {Object.entries(result.high_concentration || {}).length === 0 ? (
                            <p className="rounded-xl bg-slate-950/50 p-4 text-sm text-slate-500">
                              No high-concentration holdings detected.
                            </p>
                          ) : (
                            Object.entries(result.high_concentration).map(
                              ([stock, percentage]) => (
                                <div
                                  key={stock}
                                  className="flex justify-between rounded-xl bg-slate-950/70 px-4 py-3"
                                >
                                  <span>{stock}</span>
                                  <span className="text-amber-400">{percentage}%</span>
                                </div>
                              )
                            )
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-cyan-300">◉</span>
                            <h3 className="font-semibold text-cyan-200">Hidden exposure engine</h3>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Looks through your tracked funds and combines each underlying company across funds.
                          </p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-[10px] uppercase tracking-wider text-slate-600">Hidden exposure</p>
                          <p className="mt-1 text-lg font-bold text-cyan-300">
                            {formatINR(result.hidden_exposure_total || 0)}
                          </p>
                        </div>
                      </div>

                      {effectiveExposureEntries.length === 0 ? (
                        <div className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-6 text-center">
                          <p className="font-medium">No hidden exposure calculated</p>
                          <p className="mt-1 text-xs text-slate-500">Add fund → stock relationships above to build the X-Ray.</p>
                        </div>
                      ) : (
                        <div className="mt-5 overflow-x-auto">
                          <table className="w-full min-w-[650px] text-left text-sm">
                            <thead className="text-xs uppercase tracking-wider text-slate-600">
                              <tr className="border-b border-slate-800">
                                <th className="px-3 py-3">Company</th>
                                <th className="px-3 py-3">Effective exposure</th>
                                <th className="px-3 py-3">Portfolio %</th>
                                <th className="px-3 py-3">Funds</th>
                              </tr>
                            </thead>
                            <tbody>
                              {effectiveExposureEntries.map(([stock, item]) => (
                                <tr key={stock} className="border-b border-slate-900">
                                  <td className="px-3 py-3 font-medium text-slate-200">{stock}</td>
                                  <td className="px-3 py-3 font-semibold text-cyan-300">{formatINR(item.exposure_amount)}</td>
                                  <td className="px-3 py-3">
                                    <span className={Number(item.portfolio_percent) >= 10 ? "text-amber-400" : "text-slate-300"}>
                                      {Number(item.portfolio_percent).toFixed(2)}%
                                    </span>
                                  </td>
                                  <td className="px-3 py-3 text-xs text-slate-500">{item.funds.join(", ")}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {fundExposureEntries.length > 0 && (
                      <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                        <h3 className="font-semibold">Fund contribution</h3>
                        <p className="mt-1 text-xs text-slate-500">How much effective exposure each tracked fund contributes to the X-Ray.</p>
                        <div className="mt-5 grid gap-3 md:grid-cols-2">
                          {fundExposureEntries.map(([fund, item]) => (
                            <div key={fund} className="rounded-xl bg-slate-950/60 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-medium">{fund}</span>
                                <span className="text-cyan-300">{Number(item.portfolio_percent).toFixed(2)}%</span>
                              </div>
                              <div className="mt-2 flex justify-between text-xs text-slate-500">
                                <span>{formatINR(item.exposure_amount)} exposure</span>
                                <span>{item.companies} companies</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {fundOverlapEntries.length > 0 && (
                      <div className="mt-5 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-violet-300">↔</span>
                              <h3 className="font-semibold text-violet-200">
                                Fund overlap engine
                              </h3>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              Compares common underlying companies between every tracked fund pair.
                            </p>
                          </div>
                          <span className="text-xs text-slate-500">
                            {fundOverlapEntries.length} overlapping fund pair{fundOverlapEntries.length === 1 ? "" : "s"}
                          </span>
                        </div>

                        <div className="mt-5 grid gap-3 md:grid-cols-2">
                          {fundOverlapEntries.map((item) => {
                            const levelTone =
                              item.overlap_level === "High"
                                ? "text-red-400 bg-red-500/10"
                                : item.overlap_level === "Moderate"
                                ? "text-amber-400 bg-amber-500/10"
                                : "text-cyan-300 bg-cyan-500/10";

                            return (
                              <div
                                key={`${item.fund_a}-${item.fund_b}`}
                                className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="font-semibold text-slate-200">
                                      {item.fund_a} ↔ {item.fund_b}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      {item.common_companies} common compan{item.common_companies === 1 ? "y" : "ies"}
                                    </p>
                                  </div>
                                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${levelTone}`}>
                                    {item.overlap_level}
                                  </span>
                                </div>

                                <div className="mt-4 flex items-end justify-between">
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-600">
                                      Overlap
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-violet-300">
                                      {Number(item.overlap_percent).toFixed(2)}%
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[10px] uppercase tracking-wider text-slate-600">
                                      Shared exposure
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-slate-300">
                                      {formatINR(item.overlap_amount)}
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
                                  <div
                                    className="h-full rounded-full bg-violet-400"
                                    style={{
                                      width: `${Math.min(
                                        100,
                                        Math.max(0, Number(item.overlap_percent))
                                      )}%`,
                                    }}
                                  />
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2">
                                  {(item.common_holdings || []).slice(0, 6).map((holding) => (
                                    <span
                                      key={holding.company}
                                      className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-400"
                                    >
                                      {holding.company}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="mt-5 grid gap-5 xl:grid-cols-3">
                      <BreakdownCard
                        title="Asset allocation"
                        subtitle="Based on your persisted portfolio investments."
                        entries={Object.entries(result.asset_allocation || {})}
                        suffix="%"
                      />
                      <BreakdownCard
                        title="Sector exposure"
                        subtitle="Underlying exposure from X-Ray data and direct stocks."
                        entries={Object.entries(result.sector_exposure || {})}
                        suffix="%"
                      />
                      <BreakdownCard
                        title="Market-cap exposure"
                        subtitle="Classification available for known securities."
                        entries={Object.entries(result.market_cap_exposure || {})}
                        suffix="%"
                      />
                    </div>

                    <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                      <h3 className="font-semibold">Overlapping holdings</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Company-level overlap details. Fund-to-fund overlap is summarized above.
                      </p>

                      <div className="mt-5 grid gap-3 md:grid-cols-2">
                        {Object.entries(result.overlapping_stocks || {}).length === 0 ? (
                          <p className="text-sm text-slate-500">
                            No overlapping holdings detected.
                          </p>
                        ) : (
                          Object.entries(result.overlapping_stocks).map(
                            ([stock, fundList]) => (
                              <div
                                key={stock}
                                className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-cyan-300">{stock}</span>
                                  <span className="rounded-full bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-300">
                                    {fundList.length} funds
                                  </span>
                                </div>
                                <p className="mt-2 text-xs text-slate-500">
                                  Present in: {fundList.join(", ")}
                                </p>
                              </div>
                            )
                          )
                        )}
                      </div>
                    </div>
                  </>
                )}
              </section>
            )}

            {activePage === "risk" && (
              <section>
                <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                  <div>
                    <p className="text-sm text-slate-500">Portfolio intelligence</p>
                    <h2 className="mt-1 text-3xl font-bold">Risk & Diversification</h2>
                    <p className="mt-2 text-sm text-slate-400">
                      An explainable view of concentration, overlap and diversification across your portfolio.
                    </p>
                  </div>
                  <button
                    onClick={loadRisk}
                    disabled={riskLoading}
                    className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold hover:border-cyan-500 disabled:opacity-50"
                  >
                    {riskLoading ? "Analyzing..." : "Refresh risk analysis"}
                  </button>
                </div>

                {riskError ? (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-300">{riskError}</div>
                ) : riskLoading && !riskAnalysis ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center text-sm text-slate-500">Calculating portfolio risk...</div>
                ) : !riskAnalysis || !riskAnalysis.metrics?.portfolio_invested ? (
                  <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center">
                    <h3 className="text-lg font-semibold">No portfolio risk data yet</h3>
                    <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">Add investments and run Portfolio X-Ray to unlock risk and diversification analysis.</p>
                    <button onClick={() => setActivePage("portfolio")} className="mt-6 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950">Open Portfolio</button>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                        <p className="text-xs uppercase tracking-wider text-slate-500">Risk score</p>
                        <p className={`mt-3 text-4xl font-bold ${riskScore >= 70 ? "text-red-400" : riskScore >= 50 ? "text-amber-400" : riskScore >= 30 ? "text-yellow-300" : "text-emerald-400"}`}>{riskScore}<span className="text-sm text-slate-600"> / 100</span></p>
                        <p className="mt-2 text-xs text-slate-500">{riskLevel} structural risk</p>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                        <p className="text-xs uppercase tracking-wider text-slate-500">Diversification</p>
                        <p className="mt-3 text-4xl font-bold text-cyan-300">{riskAnalysis.diversification_score}<span className="text-sm text-slate-600"> / 100</span></p>
                        <p className="mt-2 text-xs text-slate-500">{riskAnalysis.diversification_label}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                        <p className="text-xs uppercase tracking-wider text-slate-500">Top company</p>
                        <p className="mt-3 text-3xl font-bold text-amber-300">{Number(riskAnalysis.metrics.top_company_percent).toFixed(2)}%</p>
                        <p className="mt-2 text-xs text-slate-500">of invested portfolio</p>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                        <p className="text-xs uppercase tracking-wider text-slate-500">Fund overlap</p>
                        <p className="mt-3 text-3xl font-bold text-violet-300">{Number(riskAnalysis.metrics.max_fund_overlap_percent).toFixed(2)}%</p>
                        <p className="mt-2 text-xs text-slate-500">highest overlapping pair</p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-5 xl:grid-cols-2">
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                        <div className="flex items-center justify-between">
                          <div><h3 className="font-semibold">Risk components</h3><p className="mt-1 text-xs text-slate-500">Contribution to the 100-point risk score.</p></div>
                          <span className="text-xs text-slate-600">Max 100</span>
                        </div>
                        <div className="mt-5 space-y-4">
                          {[
                            ["Company concentration", riskAnalysis.components.company_concentration, 50],
                            ["Sector concentration", riskAnalysis.components.sector_concentration, 20],
                            ["Fund overlap", riskAnalysis.components.fund_overlap, 20],
                            ["Market-cap concentration", riskAnalysis.components.market_cap_concentration, 10],
                          ].map(([label, value, max]) => (
                            <div key={label}>
                              <div className="mb-2 flex justify-between text-sm"><span className="text-slate-300">{label}</span><span className="text-slate-400">{Number(value).toFixed(1)} / {max}</span></div>
                              <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-400" style={{width:`${Math.min(100, Math.max(0, Number(value)/Number(max)*100))}%`}} /></div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                        <h3 className="font-semibold">Concentration metrics</h3>
                        <p className="mt-1 text-xs text-slate-500">HHI measures how concentrated the exposure is; lower is generally more diversified.</p>
                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          {[
                            ["Companies analyzed", riskAnalysis.metrics.companies_analyzed],
                            ["Top 3 companies", `${Number(riskAnalysis.metrics.top_3_company_percent).toFixed(2)}%`],
                            ["Company HHI", riskAnalysis.metrics.company_hhi],
                            ["Sector HHI", riskAnalysis.metrics.sector_hhi],
                            ["Top sector", `${Number(riskAnalysis.metrics.top_sector_percent).toFixed(2)}%`],
                            ["Top market-cap bucket", `${Number(riskAnalysis.metrics.top_market_cap_percent).toFixed(2)}%`],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-xl bg-slate-950/60 p-4"><p className="text-[10px] uppercase tracking-wider text-slate-600">{label}</p><p className="mt-2 text-lg font-semibold text-slate-200">{value}</p></div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-5 xl:grid-cols-2">
                      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                        <h3 className="font-semibold text-amber-300">Why InShield scored this portfolio</h3>
                        <div className="mt-4 space-y-3">
                          {riskAnalysis.reasons.map((reason, index) => <div key={index} className="flex gap-3 text-sm leading-6 text-slate-400"><span className="text-amber-300">•</span><span>{reason}</span></div>)}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
                        <h3 className="font-semibold text-cyan-300">Diversification actions</h3>
                        <div className="mt-4 space-y-3">
                          {riskAnalysis.recommendations.map((item, index) => <div key={index} className="flex gap-3 text-sm leading-6 text-slate-400"><span className="text-cyan-300">→</span><span>{item}</span></div>)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div><h3 className="font-semibold">Methodology</h3><p className="mt-1 text-xs text-slate-500">{riskAnalysis.methodology}</p></div>
                        <button onClick={() => setActivePage("xray")} className="text-xs text-cyan-300">View full X-Ray →</button>
                      </div>
                    </div>

                    <p className="mt-5 text-xs leading-5 text-slate-600">Risk and diversification scores are analytical indicators based on the data available in InShield. They are not investment advice.</p>
                  </>
                )}
              </section>
            )}

            {activePage === "simulator" && (
              <section>
                <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                  <div>
                    <p className="text-sm text-slate-500">Portfolio intelligence</p>
                    <h2 className="mt-1 text-3xl font-bold">What-If Simulator</h2>
                    <p className="mt-2 max-w-2xl text-sm text-slate-400">
                      Test a hypothetical investment, reduction or exit before changing your real portfolio.
                    </p>
                  </div>
                  {simulator && <button onClick={resetSimulator} className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold hover:border-cyan-500">Clear scenario</button>}
                </div>

                <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                    <div className="flex gap-2 rounded-xl bg-slate-950/70 p-1">
                      {[['add','Add holding'],['reduce','Reduce holding'],['remove','Remove holding']].map(([id,label]) => (
                        <button key={id} onClick={() => { setSimAction(id); setSimError(""); }} className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${simAction === id ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}>{label}</button>
                      ))}
                    </div>

                    {simAction === 'add' ? (
                      <div className="mt-5 space-y-4">
                        <div><label className="text-xs text-slate-500">Company / asset name</label><input value={simForm.name} onChange={e=>setSimForm({...simForm,name:e.target.value})} placeholder="e.g. HDFC Bank" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm outline-none focus:border-cyan-500" /></div>
                        <div><label className="text-xs text-slate-500">Symbol</label><input value={simForm.symbol} onChange={e=>setSimForm({...simForm,symbol:e.target.value.toUpperCase()})} placeholder="HDFCBANK" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm outline-none focus:border-cyan-500" /></div>
                        <div><label className="text-xs text-slate-500">Investment amount</label><input type="number" min="1" value={simForm.amount} onChange={e=>setSimForm({...simForm,amount:e.target.value})} placeholder="50000" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm outline-none focus:border-cyan-500" /></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="text-xs text-slate-500">Sector</label><select value={simForm.sector} onChange={e=>setSimForm({...simForm,sector:e.target.value})} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm"><option value="">Auto / Other</option><option>IT</option><option>Financials</option><option>Energy</option><option>Consumer</option><option>Industrials</option><option>Telecom</option><option>Healthcare</option><option>Auto</option></select></div>
                          <div><label className="text-xs text-slate-500">Market cap</label><select value={simForm.market_cap} onChange={e=>setSimForm({...simForm,market_cap:e.target.value})} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm"><option value="">Auto / Other</option><option>Large Cap</option><option>Mid Cap</option><option>Small Cap</option></select></div>
                        </div>
                        <p className="text-xs leading-5 text-slate-600">For a direct stock/ETF, InShield uses the supplied or known sector and market-cap metadata. The scenario is never saved.</p>
                      </div>
                    ) : (
                      <div className="mt-5 space-y-4">
                        <div><label className="text-xs text-slate-500">Portfolio holding</label><select value={simForm.holding_id} onChange={e=>setSimForm({...simForm,holding_id:e.target.value})} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm"><option value="">Select a holding</option>{holdings.map(h=><option key={h.id} value={h.id}>{h.name} — {formatINR(h.invested_amount)}</option>)}</select></div>
                        {simAction === 'reduce' && <div><label className="text-xs text-slate-500">Amount to reduce</label><input type="number" min="1" value={simForm.reduce_amount} onChange={e=>setSimForm({...simForm,reduce_amount:e.target.value})} placeholder="25000" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm outline-none focus:border-cyan-500" /></div>}
                        <p className="text-xs leading-5 text-slate-600">This only changes the in-memory scenario. Your saved portfolio is untouched.</p>
                      </div>
                    )}

                    {simError && <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">{simError}</div>}
                    <button onClick={runSimulator} disabled={simLoading} className="mt-5 w-full rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50">{simLoading ? 'Simulating...' : 'Run scenario'}</button>
                  </div>

                  <div className="space-y-5">
                    {!simulator ? (
                      <div className="flex min-h-[430px] items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center">
                        <div><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-2xl text-cyan-300">◇</div><h3 className="mt-5 text-lg font-semibold">Build a hypothetical scenario</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">See how one portfolio change affects risk, diversification and concentration before you commit it.</p></div>
                      </div>
                    ) : (
                      <>
                        <div className="grid gap-4 md:grid-cols-4">
                          <StatCard label="Risk now" value={`${simulator.current.risk_score}/100`} sub={simulator.current.risk_level} tone="orange" />
                          <StatCard label="Scenario risk" value={`${simulator.scenario.risk_score}/100`} sub={simulator.scenario.risk_level} tone={simulator.scenario.risk_score < simulator.current.risk_score ? 'green' : 'orange'} />
                          <StatCard label="Risk change" value={`${simulator.delta.risk_score > 0 ? '+' : ''}${simulator.delta.risk_score}`} sub={simulator.delta.risk_direction} tone={simulator.delta.risk_score < 0 ? 'green' : 'orange'} />
                          <StatCard label="Diversification" value={`${simulator.scenario.diversification_score}/100`} sub={`${simulator.delta.diversification_score > 0 ? '+' : ''}${simulator.delta.diversification_score} vs now`} tone="blue" />
                        </div>

                        <div className="grid gap-5 md:grid-cols-2">
                          {[
                            ['Top company', simulator.current.metrics.top_company_percent, simulator.scenario.metrics.top_company_percent],
                            ['Top 3 companies', simulator.current.metrics.top_3_company_percent, simulator.scenario.metrics.top_3_company_percent],
                            ['Top sector', simulator.current.metrics.top_sector_percent, simulator.scenario.metrics.top_sector_percent],
                            ['Top market-cap bucket', simulator.current.metrics.top_market_cap_percent, simulator.scenario.metrics.top_market_cap_percent],
                          ].map(([label, before, after]) => {
                            const delta = Number(after)-Number(before);
                            return <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><div className="flex justify-between"><h3 className="font-semibold">{label}</h3><span className={delta < 0 ? 'text-emerald-400' : delta > 0 ? 'text-amber-400' : 'text-slate-500'}>{delta > 0 ? '+' : ''}{delta.toFixed(2)}%</span></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-950/60 p-4"><p className="text-[10px] uppercase text-slate-600">Current</p><p className="mt-2 text-xl font-semibold">{Number(before).toFixed(2)}%</p></div><div className="rounded-xl bg-cyan-500/5 p-4"><p className="text-[10px] uppercase text-cyan-700">Scenario</p><p className="mt-2 text-xl font-semibold text-cyan-300">{Number(after).toFixed(2)}%</p></div></div></div>
                          })}
                        </div>

                        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
                          <h3 className="font-semibold text-cyan-300">Scenario interpretation</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-400">
                            {simulator.delta.risk_score < 0 ? 'This scenario reduces structural portfolio risk.' : simulator.delta.risk_score > 0 ? 'This scenario increases structural portfolio risk.' : 'This scenario leaves the structural risk score unchanged.'}
                            {' '}{simulator.delta.diversification_score > 0 ? 'Diversification improves.' : simulator.delta.diversification_score < 0 ? 'Diversification decreases.' : 'Diversification is unchanged.'}
                          </p>
                          <p className="mt-3 text-xs text-slate-600">{simulator.note}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <p className="mt-5 text-xs leading-5 text-slate-600">What-If results are analytical estimates based on the data available in InShield. They do not execute trades or constitute investment advice.</p>
              </section>
            )}

            {activePage === "markets" && (
              <section>
                <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                  <div>
                    <p className="text-sm text-slate-500">Market intelligence</p>
                    <h2 className="mt-1 text-3xl font-bold">Markets</h2>
                    <p className="mt-2 text-sm text-slate-400">
                      Track major Indian indices and stocks in your portfolio.
                    </p>
                  </div>
                  <button
                    onClick={loadMarkets}
                    disabled={marketLoading}
                    className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold hover:border-cyan-500 disabled:opacity-50"
                  >
                    {marketLoading ? "Refreshing..." : "Refresh markets"}
                  </button>
                </div>

                {marketError && (
                  <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
                    {marketError}
                  </div>
                )}

                <div className="mb-5 grid gap-4 md:grid-cols-3">
                  {(marketIndexes.length ? marketIndexes : [
                    { name: "NIFTY 50", display_symbol: "^NSEI", price: null },
                    { name: "SENSEX", display_symbol: "^BSESN", price: null },
                    { name: "NIFTY IT", display_symbol: "^CNXIT", price: null },
                  ]).map((item) => (
                    <div
                      key={item.display_symbol || item.name}
                      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-slate-500">{item.name}</p>
                          <p className="mt-2 text-2xl font-bold">
                            {item.price == null ? "—" : Number(item.price).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        <span className="rounded-full bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-300">
                          INDEX
                        </span>
                      </div>
                      <div className="mt-3">
                        <MarketChange item={item} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mb-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-semibold">Search market</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Search stocks and listed securities.
                      </p>
                    </div>
                    <div className="flex w-full max-w-xl gap-2">
                      <input
                        value={marketSearch}
                        onChange={(e) => setMarketSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") searchMarket();
                        }}
                        placeholder="e.g. Reliance, TCS, Infosys"
                        className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm outline-none placeholder:text-slate-700 focus:border-cyan-500"
                      />
                      <button
                        onClick={searchMarket}
                        disabled={marketSearchLoading}
                        className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
                      >
                        {marketSearchLoading ? "..." : "Search"}
                      </button>
                    </div>
                  </div>

                  {marketSearchResults.length > 0 && (
                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      {marketSearchResults.map((item) => (
                        <button
                          key={`${item.symbol}-${item.exchange}`}
                          onClick={() => {
                            setMarketSearch(item.symbol);
                            selectMarketChart(item.symbol);
                          }}
                          className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-left hover:border-cyan-500/50"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium">{item.name}</span>
                            <span className="text-xs text-cyan-300">{item.symbol}</span>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-600">
                            {item.exchange || "Market"} · {item.type || "Security"}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mb-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-cyan-400">Price history</p>
                      <h3 className="mt-1 text-xl font-semibold">Stock ups & downs</h3>
                      <p className="mt-1 text-xs text-slate-500">Interactive historical closing-price movement.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {["1d", "1w", "1m", "1y", "5y"].map((rangeValue) => (
                        <button
                          key={rangeValue}
                          onClick={() => {
                            setChartRange(rangeValue);
                            loadMarketHistory(chartSymbol, rangeValue);
                          }}
                          disabled={!chartSymbol || chartLoading}
                          className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase ${chartRange === rangeValue ? "bg-cyan-500 text-slate-950" : "border border-slate-700 bg-slate-950 text-slate-400 hover:border-cyan-500/60"} disabled:opacity-50`}
                        >
                          {rangeValue}
                        </button>
                      ))}
                      <button
                        onClick={() => loadMarketHistory(chartSymbol, chartRange)}
                        disabled={!chartSymbol || chartLoading}
                        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-400 hover:border-cyan-500 disabled:opacity-50"
                      >
                        ↻
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {marketIndexes.map((item) => (
                      <button key={`chart-index-${item.display_symbol}`} onClick={() => selectMarketChart(item.symbol || item.display_symbol)} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${chartSymbol === (item.symbol || item.display_symbol) ? "border-cyan-500 bg-cyan-500/10 text-cyan-300" : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-600"}`}>
                        {item.name}
                      </button>
                    ))}
                    {portfolioMarketItems.map((item) => (
                      <button key={`chart-stock-${item.symbol}`} onClick={() => selectMarketChart(item.symbol || item.display_symbol)} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${chartSymbol === (item.symbol || item.display_symbol) ? "border-cyan-500 bg-cyan-500/10 text-cyan-300" : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-600"}`}>
                        {item.display_symbol}
                      </button>
                    ))}
                  </div>

                  {chartError && <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">{chartError}</div>}

                  {chartLoading ? (
                    <div className="mt-5 flex h-72 items-center justify-center rounded-2xl bg-slate-950/60 text-sm text-slate-500">Loading price history...</div>
                  ) : chartData?.points?.length ? (
                    <PriceChart data={chartData.points} symbol={chartSymbol} range={chartRange} />
                  ) : (
                    <div className="mt-5 flex h-72 items-center justify-center rounded-2xl bg-slate-950/60 text-sm text-slate-500">Select a market to view its price chart.</div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">Your portfolio stocks</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Market prices for stock positions with a symbol.
                      </p>
                    </div>
                    <span className="text-xs text-slate-600">
                      {portfolioMarketItems.length} tracked
                    </span>
                  </div>

                  {portfolioMarketItems.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
                      <p className="font-medium">No stock symbols found</p>
                      <p className="mt-2 text-sm text-slate-500">
                        Add a stock with a symbol such as RELIANCE or TCS in Portfolio.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {portfolioMarketItems.map((item) => (
                        <div
                          key={`${item.symbol}-${item.display_symbol}`}
                          className="flex flex-col gap-3 rounded-xl bg-slate-950/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-medium">{item.display_symbol}</p>
                            <p className="text-xs text-slate-600">{item.symbol}</p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="font-semibold">{formatMarketPrice(item.price)}</p>
                            <MarketChange item={item} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-xs leading-5 text-slate-600">
                  Market data is fetched by the InShield backend. Prices can be delayed and
                  should not be treated as investment advice.
                </div>
              </section>
            )}

            {activePage === "ai" && (
              <section>
                <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                  <div>
                    <p className="text-sm text-slate-500">Phase 11 · Machine intelligence</p>
                    <h2 className="mt-1 text-3xl font-bold">AI Intelligence</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                      A local intelligence layer combining portfolio risk, exposure anomalies and live portfolio-aware news signals.
                    </p>
                  </div>
                  <button onClick={loadAI} disabled={aiLoading} className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold hover:border-cyan-500 disabled:opacity-50">
                    {aiLoading ? "Analyzing..." : "Run AI analysis"}
                  </button>
                </div>

                {aiError && <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">{aiError}</div>}

                <div className="grid gap-4 md:grid-cols-4">
                  <StatCard label="Intelligence score" value={`${Number(aiData?.intelligence_score || 0).toFixed(0)}/100`} sub={aiData?.status || "Waiting for data"} tone="blue" />
                  <StatCard label="Risk score" value={`${Number(aiData?.risk_score || 0).toFixed(0)}/100`} sub="Explainable risk engine" tone="orange" />
                  <StatCard label="News sentiment" value={`${Number(aiData?.news_sentiment_score || 0).toFixed(0)}`} sub="-100 negative · +100 positive" tone="green" />
                  <StatCard label="Anomalies" value={aiData?.anomaly_count || 0} sub="Unusual exposure patterns" tone="purple" />
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
                  <div className="space-y-5">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="font-semibold">AI findings</h3>
                          <p className="mt-1 text-xs text-slate-500">Prioritized signals generated from your current portfolio state.</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${aiData?.status === 'Healthy' ? 'bg-emerald-500/10 text-emerald-400' : aiData?.status === 'Watch' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>{aiData?.status || 'Waiting'}</span>
                      </div>
                      <div className="mt-5 space-y-3">
                        {(aiData?.insights || []).map((item, index) => (
                          <div key={`${item.title}-${index}`} className="rounded-xl bg-slate-950/60 p-4">
                            <div className="flex items-start gap-3">
                              <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs ${item.severity === 'high' ? 'bg-red-500/10 text-red-400' : item.severity === 'medium' ? 'bg-amber-500/10 text-amber-400' : 'bg-cyan-500/10 text-cyan-300'}`}>✦</span>
                              <div>
                                <p className="text-sm font-semibold text-slate-200">{item.title}</p>
                                <p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                      <h3 className="font-semibold">Exposure anomaly detection</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Isolation Forest looks for unusual combinations of portfolio weight, X-Ray exposure and fund count. It does not forecast returns.</p>
                      <div className="mt-4 space-y-2">
                        {(aiData?.anomalies?.anomalies || []).length === 0 ? (
                          <p className="rounded-xl bg-slate-950/60 p-4 text-sm text-slate-500">No unusual exposure patterns were flagged.</p>
                        ) : (aiData?.anomalies?.anomalies || []).map((item, index) => (
                          <div key={`${item.name}-${index}`} className="flex flex-col gap-2 rounded-xl bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div><p className="text-sm font-medium text-slate-200">{item.name}</p><p className="text-[10px] text-slate-600">{item.reason}</p></div>
                            <div className="text-left sm:text-right"><p className="text-sm font-bold text-violet-300">{(Number(item.anomaly_score || 0) * 100).toFixed(0)}%</p><p className="text-[9px] uppercase tracking-wider text-slate-600">anomaly strength</p></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                      <h3 className="font-semibold">AI recommendations</h3>
                      <div className="mt-4 space-y-3">
                        {(aiData?.recommendations || []).length === 0 ? <p className="text-sm text-slate-500">No recommendations yet.</p> : (aiData?.recommendations || []).map((text, index) => (
                          <div key={index} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-xs leading-5 text-slate-400"><span className="mr-2 text-cyan-300">{index + 1}.</span>{text}</div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                      <h3 className="font-semibold">News signal</h3>
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-emerald-500/5 p-3 text-center"><p className="text-lg font-bold text-emerald-400">{aiData?.news?.positive || 0}</p><p className="text-[9px] uppercase text-slate-600">Positive</p></div>
                        <div className="rounded-xl bg-red-500/5 p-3 text-center"><p className="text-lg font-bold text-red-400">{aiData?.news?.negative || 0}</p><p className="text-[9px] uppercase text-slate-600">Negative</p></div>
                        <div className="rounded-xl bg-slate-800/60 p-3 text-center"><p className="text-lg font-bold text-slate-400">{aiData?.news?.neutral || 0}</p><p className="text-[9px] uppercase text-slate-600">Neutral</p></div>
                      </div>
                      <div className="mt-4 space-y-2">{(aiData?.news?.company_signals || []).slice(0, 6).map((item, index) => <div key={`${item.company}-${index}`} className="flex items-center justify-between rounded-lg bg-slate-950/50 px-3 py-2"><span className="truncate pr-3 text-xs text-slate-400">{item.company}</span><span className={`text-xs font-semibold ${Number(item.sentiment_score) < 0 ? 'text-red-400' : Number(item.sentiment_score) > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>{Number(item.sentiment_score) > 0 ? '+' : ''}{Number(item.sentiment_score).toFixed(0)}</span></div>)}</div>
                    </div>

                    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
                      <h3 className="font-semibold text-cyan-300">How this AI layer works</h3>
                      <p className="mt-2 text-xs leading-5 text-slate-500">InShield uses an unsupervised Isolation Forest for unusual exposure patterns, combines the existing explainable risk engine with live portfolio-aware news signals, and produces traceable findings rather than pretending to predict future returns.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-[11px] leading-5 text-slate-600">
                  {aiData?.disclaimer || 'AI Intelligence is a monitoring layer and not investment advice.'}
                </div>
              </section>
            )}

            {activePage === "broker" && (
              <section>
                <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                  <div>
                    <p className="text-sm text-slate-500">Phase 12 · Secure connectivity</p>
                    <h2 className="mt-1 text-3xl font-bold">Broker Integration</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                      Connect a read-only broker source, preview the holdings InShield can import, then explicitly synchronize them into your local portfolio.
                    </p>
                  </div>
                  <button onClick={loadBroker} disabled={brokerLoading} className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold hover:border-cyan-500 disabled:opacity-50">
                    {brokerLoading ? "Refreshing..." : "Refresh connections"}
                  </button>
                </div>

                {brokerError && <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm leading-6 text-red-300">{brokerError}</div>}
                {brokerMessage && <div className="mb-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm leading-6 text-emerald-300">{brokerMessage}</div>}

                <div className="grid gap-4 md:grid-cols-3">
                  <StatCard label="Integration mode" value="Read-only" sub="No order placement" tone="blue" />
                  <StatCard label="Connected sources" value={brokerConnections.filter((x) => x.connection?.status === "connected" || x.runtime?.connected).length} sub="Broker connectors" tone="green" />
                  <StatCard label="Last import" value={brokerConnections.find((x) => x.connection?.last_sync_at)?.connection?.last_sync_at ? new Date(brokerConnections.find((x) => x.connection?.last_sync_at).connection.last_sync_at).toLocaleTimeString() : "Not yet"} sub="Local portfolio sync" tone="purple" />
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
                  <div className="space-y-5">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <h3 className="font-semibold">Choose a broker connector</h3>
                          <p className="mt-1 text-xs leading-5 text-slate-500">Phase 12 is intentionally read-only. Trading and order placement are not exposed by this integration.</p>
                        </div>
                        <select value={brokerProvider} onChange={(e) => { setBrokerProvider(e.target.value); setBrokerPreview(null); setBrokerError(""); setBrokerMessage(""); }} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-cyan-500">
                          {brokerProviders.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}{provider.availability === "planned" ? " · Coming soon" : provider.availability === "sandbox" ? " · Sandbox" : " · Live API"}</option>)}
                        </select>
                      </div>

                      {brokerProviders.filter((p) => p.id === brokerProvider).map((provider) => (
                        <div key={provider.id} className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2"><h4 className="font-semibold">{provider.name}</h4><span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider ${provider.runtime?.connected ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>{provider.runtime?.status || "unknown"}</span></div>
                              <p className="mt-2 text-sm leading-6 text-slate-500">{provider.description}</p>
                            </div>
                          </div>
                          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs leading-5 text-slate-500">
                            {provider.id === "upstox" ? (provider.oauth_ready ? "OAuth is configured on the FastAPI server. Click Connect Upstox to sign in on upstox.com. Your password and OTP never enter InShield." : "Configure UPSTOX_CLIENT_ID and UPSTOX_CLIENT_SECRET on the FastAPI server first. The redirect URI must exactly match the one registered in your Upstox developer app.") : provider.availability === "planned" ? provider.message : "Sandbox mode uses synthetic holdings and is safe for testing the full import workflow."}
                          </div>
                          {provider.capabilities && <div className="mt-4 flex flex-wrap gap-2">{provider.capabilities.map((cap) => <span key={cap} className="rounded-full bg-slate-900 px-2.5 py-1 text-[9px] uppercase tracking-wider text-slate-500">{cap.replaceAll("_", " ")}</span>)}</div>}
                          <div className="mt-5 flex flex-wrap gap-3">
                            {provider.id === "upstox" && !provider.runtime?.connected && (
                              <button onClick={connectUpstox} disabled={brokerLoading || !provider.oauth_ready} className="rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50">Connect Upstox</button>
                            )}
                            {provider.id === "upstox" && provider.runtime?.connected && (
                              <button onClick={disconnectUpstox} disabled={brokerLoading} className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm font-semibold text-red-300 hover:border-red-400 disabled:opacity-50">Disconnect</button>
                            )}
                            {provider.availability !== "planned" && <button onClick={testBroker} disabled={brokerLoading} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold hover:border-cyan-500 disabled:opacity-50">Test connection</button>}
                            {provider.availability !== "planned" && <button onClick={previewBroker} disabled={brokerLoading} className="rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50">Preview holdings</button>}
                            {provider.availability === "planned" && <span className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm font-semibold text-amber-300">Connector coming soon</span>}
                            {provider.id === "upstox" && provider.runtime?.connected && <button onClick={loadUpstoxProfile} disabled={brokerLoading} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold hover:border-cyan-500 disabled:opacity-50">Account details</button>}
                          </div>
                          {provider.id === "upstox" && provider.runtime?.connected && upstoxProfile && (
                            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                              <div className="rounded-xl bg-slate-900 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-600">Name</p><p className="mt-1 text-sm text-slate-300">{upstoxProfile.user_name || "—"}</p></div>
                              <div className="rounded-xl bg-slate-900 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-600">Broker</p><p className="mt-1 text-sm text-slate-300">{upstoxProfile.broker || "UPSTOX"}</p></div>
                              <div className="rounded-xl bg-slate-900 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-600">User ID</p><p className="mt-1 text-sm text-slate-300">{upstoxProfile.user_id || "—"}</p></div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {brokerPreview && (
                      <div className="rounded-2xl border border-cyan-500/20 bg-slate-900/60 p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div><h3 className="font-semibold">Import preview</h3><p className="mt-1 text-xs text-slate-500">Nothing has been changed yet.</p></div>
                          <div className="text-right"><p className="text-lg font-bold text-cyan-300">{formatINR(brokerPreview.invested_value)}</p><p className="text-xs text-slate-500">{brokerPreview.count} holdings</p></div>
                        </div>
                        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
                          <table className="w-full min-w-[620px] text-left text-xs">
                            <thead className="bg-slate-950/70 text-slate-500"><tr><th className="px-4 py-3">Asset</th><th className="px-4 py-3">Symbol</th><th className="px-4 py-3">Units</th><th className="px-4 py-3">Avg. price</th><th className="px-4 py-3 text-right">Invested</th></tr></thead>
                            <tbody>{(brokerPreview.holdings || []).map((row, i) => <tr key={`${row.symbol}-${i}`} className="border-t border-slate-800"><td className="px-4 py-3"><div className="font-medium text-slate-300">{row.name}</div><div className="mt-1 text-[10px] text-slate-600">{row.asset_type}</div></td><td className="px-4 py-3 text-slate-500">{row.symbol || "—"}</td><td className="px-4 py-3 text-slate-400">{formatNumber(row.units)}</td><td className="px-4 py-3 text-slate-400">₹{formatNumber(row.buy_price)}</td><td className="px-4 py-3 text-right font-semibold text-slate-300">{formatINR(row.invested_amount)}</td></tr>)}</tbody>
                          </table>
                        </div>
                        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                          <div><label className="text-xs uppercase tracking-wider text-slate-500">Sync mode</label><select value={brokerMode} onChange={(e) => setBrokerMode(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-cyan-500"><option value="replace">Replace local portfolio</option><option value="merge">Merge into local portfolio</option></select><p className="mt-2 text-[11px] leading-5 text-slate-600">Replace is safest when the broker is the source of truth. Merge keeps your current rows but can create duplicates.</p></div>
                          <button onClick={syncBroker} disabled={brokerLoading} className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50">{brokerLoading ? "Syncing..." : "Confirm & sync"}</button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-5">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                      <h3 className="font-semibold">Security model</h3>
                      <div className="mt-4 space-y-3 text-xs leading-5 text-slate-500">
                        <div className="rounded-xl bg-slate-950/60 p-3"><span className="font-semibold text-slate-300">1. Read-only</span><br />InShield only imports holdings in Phase 12. No buy, sell or order endpoints are exposed.</div>
                        <div className="rounded-xl bg-slate-950/60 p-3"><span className="font-semibold text-slate-300">2. OAuth login</span><br />Upstox handles your login and OTP. InShield receives only the authorization result; client secrets stay on FastAPI.</div>
                        <div className="rounded-xl bg-slate-950/60 p-3"><span className="font-semibold text-slate-300">3. Preview first</span><br />The broker response is shown before any local portfolio rows are changed.</div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-cyan-500/10 bg-slate-900/60 p-5">
                      <h3 className="font-semibold">Multi-broker architecture</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Every broker adapter is normalized into the same InShield holding model, so X-Ray, risk, alerts, news and AI do not need broker-specific logic.</p>
                      <div className="mt-4 grid gap-2">
                        {brokerProviders.map((provider) => <div key={provider.id} className="flex items-center justify-between rounded-xl bg-slate-950/60 px-3 py-2.5"><span className="text-xs text-slate-300">{provider.name}</span><span className={`text-[9px] font-semibold uppercase tracking-wider ${provider.availability === "planned" ? "text-amber-400" : provider.runtime?.connected ? "text-emerald-400" : "text-slate-500"}`}>{provider.availability === "planned" ? "Coming soon" : provider.runtime?.connected ? "Connected" : provider.availability === "sandbox" ? "Sandbox" : "Ready"}</span></div>)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                      <h3 className="font-semibold">Sync history</h3>
                      <div className="mt-4 space-y-2">
                        {brokerHistory.length === 0 ? <p className="text-xs text-slate-600">No broker syncs yet.</p> : brokerHistory.map((item, i) => <div key={`${item.created_at}-${i}`} className="rounded-xl bg-slate-950/60 p-3"><div className="flex justify-between gap-3"><span className="text-xs font-medium text-slate-400">{String(item.provider).toUpperCase()}</span><span className="text-[10px] text-slate-600">{new Date(item.created_at + (item.created_at.endsWith('Z') ? '' : 'Z')).toLocaleString()}</span></div><p className="mt-1 text-xs text-slate-500">{item.imported_count} holdings · {formatINR(item.imported_value)} · {item.mode}</p></div>)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-5 text-amber-200/70">
                  Phase 17 advanced analytics · Phase 12.2 multi-broker architecture is designed for read-only portfolio connectivity. For production, use encrypted secret storage, HTTPS, strict redirect URLs, secure sessions, token rotation/expiry handling and broker-specific compliance controls.
                </div>
              </section>
            )}

            {activePage === "news" && (
              <section>
                <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                  <div>
                    <p className="text-sm text-slate-500">Portfolio intelligence</p>
                    <h2 className="mt-1 text-3xl font-bold">News Intelligence</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                      Live market and company headlines matched against the companies in your portfolio.
                    </p>
                  </div>
                  <button onClick={loadNews} disabled={newsLoading} className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold hover:border-cyan-500 disabled:opacity-50">
                    {newsLoading ? "Refreshing..." : "Refresh news"}
                  </button>
                </div>

                {newsError && <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">{newsError}</div>}

                <div className="grid gap-4 md:grid-cols-3">
                  <StatCard label="News items" value={newsData?.items?.length || 0} sub="Latest fetched headlines" tone="blue" />
                  <StatCard label="Portfolio relevant" value={(newsData?.items || []).filter(x => x.is_portfolio_relevant).length} sub="Matched to holdings" tone="green" />
                  <StatCard label="Negative signals" value={(newsData?.items || []).filter(x => x.impact === "Negative").length} sub="Requires review" tone="orange" />
                </div>

                <div className="mt-5 flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
                  {[['all','All'],['portfolio','My portfolio'],['positive','Positive'],['negative','Negative']].map(([id,label]) => (
                    <button key={id} onClick={() => setNewsFilter(id)} className={`rounded-xl px-4 py-2 text-xs font-semibold ${newsFilter === id ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>{label}</button>
                  ))}
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_330px]">
                  <div className="space-y-3">
                    {!newsData && newsLoading ? (
                      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center text-sm text-slate-500">Loading news intelligence…</div>
                    ) : filteredNews.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center">
                        <h3 className="text-lg font-semibold">No matching news</h3>
                        <p className="mt-2 text-sm text-slate-500">Try another filter or refresh the live news feed.</p>
                      </div>
                    ) : filteredNews.map((item, index) => (
                      <article key={`${item.title}-${index}`} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 hover:border-slate-700">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              {item.is_portfolio_relevant && <span className="rounded-full bg-cyan-500/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-cyan-300">Portfolio</span>}
                              <span className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-wider ${item.impact === 'Negative' ? 'bg-red-500/10 text-red-400' : item.impact === 'Positive' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>{item.impact}</span>
                              <span className="text-[10px] uppercase tracking-wider text-slate-600">{item.source}</span>
                            </div>
                            <a href={item.url} target="_blank" rel="noreferrer" className="mt-3 block text-base font-semibold leading-6 text-slate-100 hover:text-cyan-300">{item.title}</a>
                            {item.summary && <p className="mt-2 text-sm leading-6 text-slate-500">{item.summary}</p>}
                            {item.portfolio_matches?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{item.portfolio_matches.map(name => <span key={name} className="rounded-lg bg-slate-950/70 px-2.5 py-1 text-[10px] text-slate-400">{name}</span>)}</div>}
                          </div>
                          <div className="shrink-0 rounded-xl bg-slate-950/70 p-3 text-right">
                            <p className="text-[9px] uppercase tracking-wider text-slate-600">Relevance</p>
                            <p className="mt-1 text-lg font-bold text-cyan-300">{item.relevance_score}</p>
                            <p className="mt-1 text-[9px] text-slate-600">/ 100</p>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3 text-[10px] text-slate-600">
                          <span>{item.published || 'Recent'}</span>
                          <a href={item.url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-300">Read source →</a>
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="space-y-5">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                      <h3 className="font-semibold">Portfolio coverage</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Companies currently used for portfolio-aware news matching.</p>
                      <div className="mt-4 space-y-2">{(newsData?.portfolio_companies || []).slice(0, 12).map((item, i) => <div key={`${item.name}-${i}`} className="flex items-center justify-between rounded-xl bg-slate-950/60 p-3"><span className="text-sm text-slate-300">{item.name}</span><span className="text-[10px] text-slate-600">{item.symbol || item.asset_type}</span></div>)}</div>
                    </div>
                    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
                      <h3 className="font-semibold text-cyan-300">How InShield reads news</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500">Headlines are matched to your holdings, scored for relevance, and classified as positive, negative or neutral using transparent keyword signals. This is an intelligence layer, not an investment recommendation.</p>
                    </div>
                  </div>
                </div>

                <p className="mt-5 text-xs leading-5 text-slate-600">News is fetched from live RSS sources and may be delayed. Always open the original publisher for full context.</p>
              </section>
            )}

            {activePage === "alerts" && (
              <section>
                <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                  <div>
                    <p className="text-sm text-slate-500">Risk monitoring</p>
                    <h2 className="mt-1 text-3xl font-bold">Alerts</h2>
                    <p className="mt-2 max-w-2xl text-sm text-slate-400">
                      Real-time portfolio warnings from concentration, fund overlap,
                      market-cap exposure and live market movements.
                    </p>
                  </div>
                  <button
                    onClick={loadAlerts}
                    disabled={alertsLoading}
                    className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold hover:border-cyan-500 disabled:opacity-50"
                  >
                    {alertsLoading ? "Refreshing..." : "Refresh alerts"}
                  </button>
                </div>

                {alertsError && (
                  <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
                    {alertsError}
                  </div>
                )}

                {!alertsData || alertsData.message === "No X-Ray data available" ? (
                  <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-2xl text-cyan-300">⚠</div>
                    <h3 className="mt-4 text-lg font-semibold">No alert data yet</h3>
                    <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
                      Add portfolio and X-Ray data first. InShield will then evaluate
                      concentration, overlap and live market risk.
                    </p>
                    <button onClick={() => setActivePage("xray")} className="mt-6 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950">
                      Open Portfolio X-Ray
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <StatCard
                        label="Alert risk score"
                        value={`${alertsData.risk_score}/100`}
                        sub={`Structural ${alertsData.structural_risk_score}/100`}
                        tone={alertsData.risk_level === "High" ? "orange" : "blue"}
                      />
                      <StatCard
                        label="Portfolio health"
                        value={alertsData.health}
                        sub={alertsData.risk_level}
                        tone={alertsData.health === "Needs attention" ? "orange" : "green"}
                      />
                      <StatCard
                        label="Active alerts"
                        value={alertsData.active_alerts}
                        sub={`${alertsData.summary?.high || 0} high · ${alertsData.summary?.medium || 0} medium · ${alertsData.summary?.low || 0} low`}
                        tone="blue"
                      />
                      <StatCard
                        label="Market signals"
                        value={(alertsData.market_signals || []).filter((item) => item.change_percent !== null).length}
                        sub="Live quotes checked"
                        tone="purple"
                      />
                    </div>

                    <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_330px]">
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h3 className="font-semibold">Current risk alerts</h3>
                            <p className="mt-1 text-xs text-slate-500">Deduplicated signals from the latest portfolio analysis.</p>
                          </div>
                          <span className="text-xs text-slate-600">
                            {alertsData.generated_at ? new Date(alertsData.generated_at).toLocaleTimeString() : ""}
                          </span>
                        </div>

                        <div className="space-y-3">
                          {riskAlerts.length === 0 ? (
                            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
                              <p className="font-semibold text-emerald-300">No active risk alerts</p>
                              <p className="mt-1 text-sm leading-6 text-slate-500">
                                No configured concentration, overlap or market-risk threshold is currently breached.
                              </p>
                            </div>
                          ) : (
                            riskAlerts.map((alert) => (
                              <div key={alert.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="flex gap-3">
                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                      alert.severity === "High"
                                        ? "bg-red-500/10 text-red-400"
                                        : alert.severity === "Medium"
                                        ? "bg-amber-500/10 text-amber-400"
                                        : "bg-emerald-500/10 text-emerald-400"
                                    }`}>
                                      {alert.severity === "High" ? "!" : alert.severity === "Medium" ? "⚠" : "•"}
                                    </div>
                                    <div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-semibold">{alert.title}</p>
                                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[9px] uppercase tracking-wider text-slate-500">
                                          {String(alert.type || "").replaceAll("_", " ")}
                                        </span>
                                      </div>
                                      <p className="mt-1 text-sm leading-6 text-slate-500">{alert.description}</p>
                                      {alert.action && (
                                        <p className="mt-2 text-xs leading-5 text-cyan-300/80">
                                          Suggested action: {alert.action}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                                    alert.severity === "High"
                                      ? "bg-red-500/10 text-red-400"
                                      : alert.severity === "Medium"
                                      ? "bg-amber-500/10 text-amber-400"
                                      : "bg-emerald-500/10 text-emerald-400"
                                  }`}>
                                    {alert.severity}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="space-y-5">
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                          <h3 className="font-semibold">Signal coverage</h3>
                          <div className="mt-4 space-y-3 text-sm">
                            {[
                              ["Company concentration", "CONCENTRATION"],
                              ["Sector concentration", "SECTOR_CONCENTRATION"],
                              ["Fund overlap", "FUND_OVERLAP"],
                              ["Market-cap concentration", "MARKET_CAP_CONCENTRATION"],
                              ["Live market movement", "MARKET_MOVEMENT"],
                              ["Combined downside", "COMBINED_RISK"],
                            ].map(([label, type]) => {
                              const count = riskAlerts.filter((item) => item.type === type).length;
                              return (
                                <div key={type} className="flex items-center justify-between rounded-xl bg-slate-950/60 p-3">
                                  <span className="text-slate-400">{label}</span>
                                  <span className={count ? "font-semibold text-amber-300" : "text-slate-600"}>{count}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
                          <h3 className="font-semibold text-cyan-300">How to use alerts</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-500">
                            Alerts highlight structural concentration and unusually large market moves.
                            They are signals for review, not automatic trade instructions.
                          </p>
                          <button onClick={() => setActivePage("risk")} className="mt-4 text-xs font-semibold text-cyan-300">
                            Open Risk & Diversification →
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                      <h3 className="font-semibold">Live market watch</h3>
                      <p className="mt-1 text-xs text-slate-500">Prices are fetched by the InShield backend and may be delayed.</p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {(alertsData.market_signals || []).slice(0, 12).map((signal) => (
                          <div key={`${signal.stock}-${signal.symbol}`} className="rounded-xl bg-slate-950/60 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-medium">{signal.stock}</p>
                                <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">{signal.symbol}</p>
                              </div>
                              <span className={`text-sm font-semibold ${
                                Number(signal.change_percent) < 0 ? "text-red-400" : "text-emerald-400"
                              }`}>
                                {signal.change_percent == null ? "—" : `${Number(signal.change_percent).toFixed(2)}%`}
                              </span>
                            </div>
                            <p className="mt-3 text-sm text-slate-400">
                              {signal.price == null ? "Price unavailable" : formatINR(signal.price)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <p className="mt-5 text-xs leading-5 text-slate-600">
                      Alerts are analytical indicators based on InShield portfolio data and live market quotes.
                      They do not execute trades or constitute investment advice.
                    </p>
                  </>
                )}
              </section>
            )}

            <footer className="mt-10 border-t border-slate-800/70 py-6 text-center text-xs text-slate-600">
              InShield · Portfolio analytics & risk intelligence · Not
              investment advice
            </footer>
          </div>
        </main>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-800 bg-[#0b111b] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-wider text-cyan-400">
                  Portfolio
                </p>
                <h3 className="mt-1 text-xl font-bold">
                  {editingId ? "Edit investment" : "Add investment"}
                </h3>
              </div>

              <button
                onClick={closeModal}
                className="rounded-xl border border-slate-800 px-3 py-2 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5 p-6">
              <div>
                <label className="text-xs uppercase tracking-wider text-slate-500">
                  Investment type
                </label>

                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    ["STOCK", "Stock"],
                    ["MUTUAL_FUND", "Mutual Fund"],
                    ["ETF", "ETF"],
                  ].map(([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          asset_type: value,
                        }))
                      }
                      className={`rounded-xl border px-3 py-3 text-sm ${
                        form.asset_type === value
                          ? "border-cyan-500 bg-cyan-500/10 text-cyan-300"
                          : "border-slate-800 bg-slate-950 text-slate-400"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-xs uppercase tracking-wider text-slate-500">
                    Investment name
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder={
                      form.asset_type === "STOCK"
                        ? "e.g. Tata Consultancy Services"
                        : form.asset_type === "ETF"
                        ? "e.g. NIFTY 50 ETF"
                        : "e.g. HDFC Flexi Cap Fund"
                    }
                    className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm outline-none placeholder:text-slate-700 focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-500">
                    Symbol / Scheme code
                  </label>
                  <input
                    value={form.symbol}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        symbol: e.target.value,
                      }))
                    }
                    placeholder={
                      form.asset_type === "MUTUAL_FUND"
                        ? "Optional scheme code"
                        : "e.g. TCS"
                    }
                    className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm outline-none placeholder:text-slate-700 focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-500">
                    Units / Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.units}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        units: e.target.value,
                      }))
                    }
                    placeholder="e.g. 10"
                    className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm outline-none placeholder:text-slate-700 focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-500">
                    Buy price / NAV
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.buy_price}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        buy_price: e.target.value,
                      }))
                    }
                    placeholder="e.g. 3420"
                    className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm outline-none placeholder:text-slate-700 focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-500">
                    Invested amount
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="any"
                    value={form.invested_amount}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        invested_amount: e.target.value,
                      }))
                    }
                    placeholder="₹ 50,000"
                    className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm outline-none placeholder:text-slate-700 focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-500">
                    Purchase date
                  </label>
                  <input
                    type="date"
                    value={form.buy_date}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        buy_date: e.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300 outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-800 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingId
                    ? "Save changes"
                    : "Add investment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showXrayAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-[#0b111b] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-wider text-cyan-400">Portfolio X-Ray</p>
                <h3 className="mt-1 text-xl font-bold">Add fund holding</h3>
              </div>
              <button
                onClick={closeXrayAdd}
                className="rounded-xl border border-slate-800 px-3 py-2 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleXraySave} className="space-y-5 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-500">Fund name</label>
                  <input
                    required
                    value={xrayForm.fund_name}
                    onChange={(e) => setXrayForm((prev) => ({ ...prev, fund_name: e.target.value }))}
                    placeholder="e.g. Fund A"
                    className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm outline-none placeholder:text-slate-700 focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-500">Stock name</label>
                  <input
                    required
                    value={xrayForm.stock_name}
                    onChange={(e) => setXrayForm((prev) => ({ ...prev, stock_name: e.target.value }))}
                    placeholder="e.g. Reliance Industries"
                    className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm outline-none placeholder:text-slate-700 focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-500">Stock symbol</label>
                  <input
                    required
                    value={xrayForm.stock_symbol}
                    onChange={(e) => setXrayForm((prev) => ({ ...prev, stock_symbol: e.target.value }))}
                    placeholder="e.g. RELIANCE"
                    className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm uppercase outline-none placeholder:text-slate-700 focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-slate-500">Exposure amount</label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="any"
                    value={xrayForm.amount}
                    onChange={(e) => setXrayForm((prev) => ({ ...prev, amount: e.target.value }))}
                    placeholder="e.g. 15000"
                    className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm outline-none placeholder:text-slate-700 focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs leading-5 text-slate-500">
                Enter the amount of the fund invested in this underlying stock. Add one entry for each fund → stock relationship.
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-800 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeXrayAdd}
                  className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={xraySaving}
                  className="rounded-xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
                >
                  {xraySaving ? "Saving..." : "Add holding"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PortfolioPerformanceChart({ history }) {
  const points = (history || []).filter((p) => Number.isFinite(Number(p.current_value)));
  if (!points.length) return null;
  const width = 1000;
  const height = 300;
  const pad = { left: 72, right: 18, top: 24, bottom: 44 };
  const values = points.flatMap((p) => [Number(p.current_value), Number(p.invested_value)]).filter(Number.isFinite);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || Math.max(max * 0.02, 1);
  const low = Math.max(0, min - spread * 0.12);
  const high = max + spread * 0.12;
  const x = (i) => pad.left + (i / Math.max(points.length - 1, 1)) * (width - pad.left - pad.right);
  const y = (v) => pad.top + ((high - v) / (high - low)) * (height - pad.top - pad.bottom);
  const pathFor = (key) => points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(Number(p[key])).toFixed(2)}`).join(" ");
  const labels = points.length <= 6 ? points : [points[0], points[Math.floor((points.length - 1) / 2)], points[points.length - 1]];
  return (
    <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">Portfolio history</p>
          <p className="mt-1 text-lg font-semibold">Current value vs invested</p>
        </div>
        <div className="flex gap-4 text-[11px] text-slate-500"><span>━ Current</span><span>┄ Invested</span></div>
      </div>
      <div className="overflow-hidden rounded-xl bg-slate-950">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full" role="img" aria-label="Portfolio current value and invested value history">
          {[0,1,2,3].map((r) => { const yy = pad.top + r * (height-pad.top-pad.bottom)/3; const value = high - r*(high-low)/3; return <g key={r}><line x1={pad.left} x2={width-pad.right} y1={yy} y2={yy} stroke="currentColor" className="text-slate-800" /><text x="8" y={yy+4} className="fill-slate-600" fontSize="12">{formatINR(value)}</text></g>; })}
          <path d={pathFor("invested_value")} fill="none" stroke="currentColor" className="text-slate-600" strokeWidth="2" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" />
          <path d={pathFor("current_value")} fill="none" stroke="currentColor" className="text-cyan-400" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {labels.map((p, i) => { const idx = points.indexOf(p); return <text key={`${p.snapshot_date}-${i}`} x={x(idx)} y={height-14} textAnchor="middle" className="fill-slate-600" fontSize="11">{new Date(`${p.snapshot_date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</text>; })}
        </svg>
      </div>
      <p className="mt-3 text-[11px] text-slate-600">{points.length} daily snapshot{points.length === 1 ? "" : "s"}. Snapshots build automatically as InShield values your portfolio.</p>
    </div>
  );
}

function AdvancedPerformanceChart({ history, benchmark }) {
  const portfolio = (history || []).filter(p => Number.isFinite(Number(p.current_value)));
  const benchMap = Object.fromEntries((benchmark?.points || []).map(p => [p.date, Number(p.value)]));
  const rows = portfolio.map(p => ({ date: p.snapshot_date, portfolio: Number(p.current_value), benchmark: benchMap[p.snapshot_date] })).filter(p => Number.isFinite(p.portfolio));
  const firstBench = rows.find(p => Number.isFinite(p.benchmark))?.benchmark;
  const firstPortfolio = rows[0]?.portfolio;
  const indexed = rows.map(p => ({ ...p, pIndex: firstPortfolio > 0 ? p.portfolio / firstPortfolio * 100 : null, bIndex: firstBench > 0 && Number.isFinite(p.benchmark) ? p.benchmark / firstBench * 100 : null }));
  if (!indexed.length) return null;
  const width=1000, height=310, pad={left:58,right:18,top:24,bottom:44};
  const vals=indexed.flatMap(p=>[p.pIndex,p.bIndex]).filter(Number.isFinite);
  const min=Math.min(...vals,98), max=Math.max(...vals,102), spread=Math.max(max-min,4);
  const low=min-spread*.12, high=max+spread*.12;
  const x=i=>pad.left+(i/Math.max(indexed.length-1,1))*(width-pad.left-pad.right);
  const y=v=>pad.top+((high-v)/(high-low))*(height-pad.top-pad.bottom);
  const path=key=>indexed.filter(p=>Number.isFinite(p[key])).map((p,i,a)=>{ const original=indexed.indexOf(p); return `${i?'L':'M'} ${x(original).toFixed(2)} ${y(p[key]).toFixed(2)}`; }).join(' ');
  const labels=indexed.length<=5?indexed:[indexed[0],indexed[Math.floor((indexed.length-1)/2)],indexed[indexed.length-1]];
  return <div className="mt-5 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60 p-4"><div className="mb-3 flex flex-wrap gap-4 text-[11px] text-slate-500"><span>━ Portfolio</span><span>┄ NIFTY 50</span><span className="ml-auto">Base = 100</span></div><svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full"><line x1={pad.left} x2={width-pad.right} y1={y(100)} y2={y(100)} stroke="currentColor" className="text-slate-800" strokeDasharray="4 6" />{[0,1,2,3].map(r=>{const yy=pad.top+r*(height-pad.top-pad.bottom)/3; const v=high-r*(high-low)/3; return <g key={r}><line x1={pad.left} x2={width-pad.right} y1={yy} y2={yy} stroke="currentColor" className="text-slate-900"/><text x="5" y={yy+4} className="fill-slate-600" fontSize="11">{v.toFixed(0)}</text></g>})}<path d={path('bIndex')} fill="none" stroke="currentColor" className="text-slate-600" strokeWidth="2" strokeDasharray="6 6" vectorEffect="non-scaling-stroke"/><path d={path('pIndex')} fill="none" stroke="currentColor" className="text-cyan-400" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>{labels.map((p,i)=>{const idx=indexed.indexOf(p);return <text key={`${p.date}-${i}`} x={x(idx)} y={height-13} textAnchor="middle" className="fill-slate-600" fontSize="11">{new Date(`${p.date}T00:00:00`).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</text>})}</svg><p className="mt-3 text-[11px] text-slate-600">{indexed.length} portfolio observations. NIFTY is shown only where benchmark data overlaps your snapshot dates.</p></div>;
}

function PriceChart({ data, symbol, range }) {
  const width = 1000;
  const height = 320;
  const pad = { left: 58, right: 18, top: 22, bottom: 42 };
  const closes = data.map((point) => Number(point.close)).filter(Number.isFinite);
  if (!closes.length) return null;
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const spread = max - min || Math.max(max * 0.01, 1);
  const low = min - spread * 0.08;
  const high = max + spread * 0.08;
  const x = (index) => pad.left + (index / Math.max(data.length - 1, 1)) * (width - pad.left - pad.right);
  const y = (value) => pad.top + ((high - value) / (high - low)) * (height - pad.top - pad.bottom);
  const path = data.map((point, index) => `${index === 0 ? "M" : "L"} ${x(index).toFixed(2)} ${y(Number(point.close)).toFixed(2)}`).join(" ");
  const first = closes[0];
  const last = closes[closes.length - 1];
  const change = last - first;
  const changePct = first ? (change / first) * 100 : 0;
  const positive = change >= 0;
  const dateLabel = (ts, includeYear = false) => {
    const date = new Date(ts * 1000);
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", ...(includeYear ? { year: "numeric" } : {}) });
  };
  const labelCount = Math.min(6, data.length);
  const labelIndexes = Array.from({ length: labelCount }, (_, i) => Math.round(i * (data.length - 1) / Math.max(labelCount - 1, 1)));

  return (
    <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">{symbol} · {range.toUpperCase()}</p>
          <p className="mt-1 text-2xl font-bold">₹{last.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p>
        </div>
        <div className={`text-right ${positive ? "text-emerald-400" : "text-red-400"}`}>
          <p className="text-sm font-semibold">{positive ? "+" : ""}₹{change.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p>
          <p className="text-xs">{positive ? "+" : ""}{changePct.toFixed(2)}% over selected period</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl bg-slate-950">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-72 w-full" role="img" aria-label={`${symbol} price chart`}>
          {[0, 1, 2, 3].map((row) => {
            const yy = pad.top + row * (height - pad.top - pad.bottom) / 3;
            const value = high - row * (high - low) / 3;
            return <g key={row}><line x1={pad.left} x2={width - pad.right} y1={yy} y2={yy} stroke="currentColor" className="text-slate-800" strokeWidth="1" /><text x="8" y={yy + 4} className="fill-slate-600" fontSize="12">₹{value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</text></g>;
          })}
          <path d={path} fill="none" stroke="currentColor" className={positive ? "text-emerald-400" : "text-red-400"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {labelIndexes.map((index) => <text key={index} x={x(index)} y={height - 14} textAnchor="middle" className="fill-slate-600" fontSize="11">{dateLabel(data[index].timestamp, range === "5y")}</text>)}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-[11px] text-slate-600">
        <span>Low ₹{min.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
        <span>{data.length} data points · {dateLabel(data[0].timestamp, true)} – {dateLabel(data[data.length - 1].timestamp, true)}</span>
        <span>High ₹{max.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
      </div>
    </div>
  );
}

function App() {
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const checkSession = async () => {
      try {
        const response = await window.fetch(`${API}/auth/me`, { credentials: "include" });
        if (!response.ok) {
          if (mounted) setAuthUser(null);
          return;
        }
        const data = await response.json();
        if (mounted) setAuthUser(data.user || null);
      } catch (err) {
        console.error(err);
        if (mounted) setAuthUser(null);
      } finally {
        if (mounted) setAuthLoading(false);
      }
    };
    checkSession();
    const onExpired = () => setAuthUser(null);
    window.addEventListener("inshield-auth-expired", onExpired);
    return () => {
      mounted = false;
      window.removeEventListener("inshield-auth-expired", onExpired);
    };
  }, []);

  const logout = async () => {
    try {
      await window.fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" });
    } catch (err) {
      console.error(err);
    }
    setAuthUser(null);
  };

  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#070b12] text-sm text-slate-500">Loading InShield...</div>;
  }
  if (!authUser) {
    return <AuthScreen onAuthenticated={setAuthUser} />;
  }
  return <DashboardApp authUser={authUser} onLogout={logout} />;
}

export default App;
