import { useEffect, useState } from "react";

const API = "http://127.0.0.1:8000";

function XRay() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    fund_name: "",
    stock_name: "",
    stock_symbol: "",
    amount: "",
  });

  // ---------------------------------------
  // Load X-Ray data
  // ---------------------------------------

  const loadXRay = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API}/xray`);

      if (!response.ok) {
        throw new Error("Failed to load X-Ray data");
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err.message || "Unable to connect to backend");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadXRay();
  }, []);

  // ---------------------------------------
  // Form handling
  // ---------------------------------------

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleAddHolding = async (e) => {
    e.preventDefault();

    if (
      !form.fund_name.trim() ||
      !form.stock_name.trim() ||
      !form.stock_symbol.trim() ||
      !form.amount
    ) {
      alert("Please fill all fields.");
      return;
    }

    if (Number(form.amount) <= 0) {
      alert("Amount must be greater than 0.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(`${API}/xray/holding`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fund_name: form.fund_name.trim(),
          stock_name: form.stock_name.trim(),
          stock_symbol: form.stock_symbol.trim().toUpperCase(),
          amount: Number(form.amount),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Failed to add holding");
      }

      setForm({
        fund_name: "",
        stock_name: "",
        stock_symbol: "",
        amount: "",
      });

      setShowAdd(false);

      await loadXRay();
    } catch (err) {
      alert(err.message || "Failed to add fund holding");
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------
  // Loading
  // ---------------------------------------

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingBox}>
          <div style={styles.loadingCircle}>↻</div>
          <h2>Analyzing Portfolio...</h2>
          <p>Loading your X-Ray data</p>
        </div>
      </div>
    );
  }

  // ---------------------------------------
  // Error
  // ---------------------------------------

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.errorBox}>
          <h2>Unable to load Portfolio X-Ray</h2>
          <p>{error}</p>

          <button style={styles.primaryButton} onClick={loadXRay}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------
  // Data
  // ---------------------------------------

  const stockExposure = data?.stock_exposure || {};
  const highConcentration = data?.high_concentration || {};
  const overlappingStocks = data?.overlapping_stocks || {};

  const stockEntries = Object.entries(stockExposure);
  const concentrationEntries = Object.entries(highConcentration);
  const overlappingEntries = Object.entries(overlappingStocks);

  const totalExposure = Number(data?.total_exposure || 0);
  const riskScore = Number(data?.risk_score || 0);
  const riskLevel = data?.risk_level || "Low";
  const riskReasons = data?.risk_reasons || [];

  const getRiskClass = () => {
    const level = riskLevel.toLowerCase();

    if (level === "high") return "high";
    if (level === "moderate") return "moderate";
    return "low";
  };

  const formatMoney = (value) => {
    return new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div style={styles.page}>

      {/* =========================================
          HEADER
      ========================================= */}

      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>PORTFOLIO INTELLIGENCE</div>

          <h1 style={styles.title}>Portfolio X-Ray</h1>

          <p style={styles.subtitle}>
            See your hidden exposure, concentration and overlapping holdings.
          </p>
        </div>

        <button
          style={styles.primaryButton}
          onClick={() => setShowAdd(true)}
        >
          + Add Fund Holding
        </button>
      </div>

      {/* =========================================
          SUMMARY CARDS
      ========================================= */}

      <div style={styles.cards}>

        <div style={styles.card}>
          <div style={styles.cardLabel}>TOTAL EXPOSURE</div>

          <div style={styles.cardValue}>
            ₹{formatMoney(totalExposure)}
          </div>

          <div style={styles.cardDescription}>
            Analyzed fund exposure
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardLabel}>STOCKS ANALYZED</div>

          <div style={styles.cardValue}>
            {stockEntries.length}
          </div>

          <div style={styles.cardDescription}>
            Underlying stocks
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardLabel}>HIGH CONCENTRATION</div>

          <div style={styles.cardValue}>
            {concentrationEntries.length}
          </div>

          <div style={styles.cardDescription}>
            Stocks above 10% exposure
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardLabel}>OVERLAPPING STOCKS</div>

          <div style={styles.cardValue}>
            {overlappingEntries.length}
          </div>

          <div style={styles.cardDescription}>
            Stocks held by multiple funds
          </div>
        </div>

      </div>

      {/* =========================================
          RISK ANALYSIS
      ========================================= */}

      <div style={styles.riskSection}>

        <div style={styles.riskHeader}>
          <div>
            <div style={styles.sectionEyebrow}>
              RISK ANALYSIS
            </div>

            <h2 style={styles.sectionTitle}>
              Portfolio Risk
            </h2>

            <p style={styles.sectionDescription}>
              Based on concentration and overlapping fund exposure.
            </p>
          </div>

          <div style={styles.riskScoreContainer}>

            <div
              style={{
                ...styles.riskScore,
                borderColor:
                  riskLevel.toLowerCase() === "high"
                    ? "#ff5c5c"
                    : riskLevel.toLowerCase() === "moderate"
                    ? "#ffb84d"
                    : "#36e0a1",
              }}
            >
              {riskScore}
            </div>

            <div>
              <div style={styles.riskScoreLabel}>
                RISK SCORE
              </div>

              <div
                style={{
                  ...styles.riskLevel,
                  color:
                    riskLevel.toLowerCase() === "high"
                      ? "#ff6b6b"
                      : riskLevel.toLowerCase() === "moderate"
                      ? "#ffc15a"
                      : "#45e0a5",
                }}
              >
                {riskLevel}
              </div>
            </div>

          </div>
        </div>

        {/* Risk reasons */}

        <div style={styles.reasonsBox}>

          <h3 style={styles.smallTitle}>
            Why this risk level?
          </h3>

          {riskReasons.length === 0 ? (
            <div style={styles.noData}>
              No major risk factors detected.
            </div>
          ) : (
            riskReasons.map((reason, index) => (
              <div key={index} style={styles.reasonRow}>
                <div style={styles.warningIcon}>!</div>

                <div style={styles.reasonText}>
                  {reason}
                </div>
              </div>
            ))
          )}

        </div>

      </div>

      {/* =========================================
          STOCK EXPOSURE
      ========================================= */}

      <div style={styles.section}>

        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>
              Underlying Stock Exposure
            </h2>

            <p style={styles.sectionDescription}>
              Your combined exposure across all tracked funds.
            </p>
          </div>
        </div>

        {stockEntries.length === 0 ? (
          <div style={styles.emptyBox}>
            No stock exposure data available.
          </div>
        ) : (
          <div style={styles.stockTable}>

            <div style={styles.tableHeader}>
              <div>STOCK</div>
              <div>EXPOSURE</div>
              <div>WEIGHT</div>
            </div>

            {stockEntries.map(([stock, percentage]) => (

              <div style={styles.stockRow} key={stock}>

                <div>
                  <div style={styles.stockName}>
                    {stock}
                  </div>

                  <div style={styles.stockSubtext}>
                    Underlying holding
                  </div>
                </div>

                <div style={styles.percentage}>
                  {percentage}%
                </div>

                <div>
                  <div style={styles.progressBackground}>
                    <div
                      style={{
                        ...styles.progressBar,
                        width: `${Math.min(
                          Number(percentage),
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

              </div>

            ))}

          </div>
        )}

      </div>

      {/* =========================================
          HIGH CONCENTRATION
      ========================================= */}

      <div style={styles.section}>

        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>
              High Concentration
            </h2>

            <p style={styles.sectionDescription}>
              Stocks representing 10% or more of analyzed exposure.
            </p>
          </div>
        </div>

        {concentrationEntries.length === 0 ? (
          <div style={styles.successBox}>
            ✓ No high concentration stocks detected.
          </div>
        ) : (
          <div style={styles.concentrationGrid}>

            {concentrationEntries.map(
              ([stock, percentage]) => (

                <div
                  style={styles.concentrationCard}
                  key={stock}
                >
                  <div style={styles.concentrationTop}>

                    <div>
                      <div style={styles.stockName}>
                        {stock}
                      </div>

                      <div style={styles.stockSubtext}>
                        High concentration
                      </div>
                    </div>

                    <div style={styles.concentrationPercentage}>
                      {percentage}%
                    </div>

                  </div>

                  <div style={styles.progressBackground}>
                    <div
                      style={{
                        ...styles.highProgressBar,
                        width: `${Math.min(
                          Number(percentage),
                          100
                        )}%`,
                      }}
                    />
                  </div>

                </div>

              )
            )}

          </div>
        )}

      </div>

      {/* =========================================
          OVERLAPPING STOCKS
      ========================================= */}

      <div style={styles.section}>

        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>
              Overlapping Stocks
            </h2>

            <p style={styles.sectionDescription}>
              Stocks that appear across multiple tracked funds.
            </p>
          </div>
        </div>

        {overlappingEntries.length === 0 ? (
          <div style={styles.successBox}>
            ✓ No overlapping stocks detected.
          </div>
        ) : (
          <div style={styles.overlapGrid}>

            {overlappingEntries.map(
              ([stock, funds]) => (

                <div
                  style={styles.overlapCard}
                  key={stock}
                >
                  <div style={styles.overlapIcon}>
                    ↔
                  </div>

                  <div style={{ flex: 1 }}>

                    <div style={styles.stockName}>
                      {stock}
                    </div>

                    <div style={styles.stockSubtext}>
                      Held across multiple funds
                    </div>

                    <div style={styles.fundList}>

                      {funds.map((fund, index) => (
                        <span
                          style={styles.fundBadge}
                          key={index}
                        >
                          {fund}
                        </span>
                      ))}

                    </div>

                  </div>

                </div>

              )
            )}

          </div>
        )}

      </div>

      {/* =========================================
          ADD FUND HOLDING MODAL
      ========================================= */}

      {showAdd && (
        <div
          style={styles.modalOverlay}
          onClick={() => setShowAdd(false)}
        >

          <div
            style={styles.modal}
            onClick={(e) => e.stopPropagation()}
          >

            <div style={styles.modalHeader}>

              <div>
                <h2 style={styles.modalTitle}>
                  Add Fund Holding
                </h2>

                <p style={styles.modalSubtitle}>
                  Add an underlying stock held by a fund.
                </p>
              </div>

              <button
                style={styles.closeButton}
                onClick={() => setShowAdd(false)}
              >
                ×
              </button>

            </div>

            <form onSubmit={handleAddHolding}>

              <label style={styles.label}>
                Fund Name
              </label>

              <input
                style={styles.input}
                type="text"
                name="fund_name"
                placeholder="Example: Fund A"
                value={form.fund_name}
                onChange={handleChange}
              />

              <label style={styles.label}>
                Stock Name
              </label>

              <input
                style={styles.input}
                type="text"
                name="stock_name"
                placeholder="Example: Reliance Industries"
                value={form.stock_name}
                onChange={handleChange}
              />

              <label style={styles.label}>
                Stock Symbol
              </label>

              <input
                style={styles.input}
                type="text"
                name="stock_symbol"
                placeholder="Example: RELIANCE"
                value={form.stock_symbol}
                onChange={handleChange}
              />

              <label style={styles.label}>
                Amount
              </label>

              <input
                style={styles.input}
                type="number"
                name="amount"
                placeholder="Example: 15000"
                min="1"
                value={form.amount}
                onChange={handleChange}
              />

              <div style={styles.modalActions}>

                <button
                  type="button"
                  style={styles.cancelButton}
                  onClick={() => setShowAdd(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={styles.primaryButton}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Holding"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}

export default XRay;


// =====================================================
// STYLES
// =====================================================

const styles = {

  page: {
    minHeight: "100%",
    padding: "32px",
    color: "#ffffff",
    background:
      "radial-gradient(circle at top left, rgba(0,100,255,0.20), transparent 35%), #07152f",
    boxSizing: "border-box",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    marginBottom: "28px",
  },

  eyebrow: {
    color: "#28a9ff",
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "1.5px",
    marginBottom: "8px",
  },

  title: {
    margin: 0,
    fontSize: "36px",
    fontWeight: "700",
    letterSpacing: "-1px",
  },

  subtitle: {
    marginTop: "8px",
    marginBottom: 0,
    color: "#9db0cf",
    fontSize: "15px",
  },

  primaryButton: {
    border: "none",
    borderRadius: "10px",
    padding: "13px 18px",
    background:
      "linear-gradient(135deg, #079cff, #0875ff)",
    color: "#ffffff",
    fontWeight: "700",
    fontSize: "14px",
    cursor: "pointer",
    boxShadow: "0 8px 25px rgba(0,130,255,0.25)",
  },

  cards: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",
    gap: "16px",
    marginBottom: "22px",
  },

  card: {
    background:
      "linear-gradient(145deg, rgba(15,58,130,0.95), rgba(8,32,76,0.95))",
    border: "1px solid rgba(70,140,255,0.22)",
    borderRadius: "16px",
    padding: "22px",
    boxSizing: "border-box",
  },

  cardLabel: {
    color: "#8fb4e9",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "1px",
  },

  cardValue: {
    marginTop: "12px",
    fontSize: "28px",
    fontWeight: "700",
    color: "#20c9ff",
  },

  cardDescription: {
    marginTop: "7px",
    color: "#8fa5c7",
    fontSize: "12px",
  },

  section: {
    background:
      "rgba(7,31,70,0.86)",
    border:
      "1px solid rgba(80,140,230,0.18)",
    borderRadius: "18px",
    padding: "24px",
    marginBottom: "22px",
    boxSizing: "border-box",
  },

  sectionHeader: {
    marginBottom: "22px",
  },

  sectionEyebrow: {
    color: "#36b4ff",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "1.2px",
    marginBottom: "6px",
  },

  sectionTitle: {
    margin: 0,
    fontSize: "21px",
    fontWeight: "700",
  },

  sectionDescription: {
    color: "#91a7c9",
    fontSize: "13px",
    marginTop: "7px",
    marginBottom: 0,
  },

  stockTable: {
    width: "100%",
  },

  tableHeader: {
    display: "grid",
    gridTemplateColumns:
      "1.2fr 0.6fr 1fr",
    gap: "20px",
    padding:
      "12px 16px",
    color: "#7894bd",
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "1px",
    borderBottom:
      "1px solid rgba(100,150,220,0.15)",
  },

  stockRow: {
    display: "grid",
    gridTemplateColumns:
      "1.2fr 0.6fr 1fr",
    gap: "20px",
    alignItems: "center",
    padding:
      "17px 16px",
    borderBottom:
      "1px solid rgba(100,150,220,0.10)",
  },

  stockName: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: "15px",
  },

  stockSubtext: {
    marginTop: "4px",
    color: "#758caf",
    fontSize: "11px",
  },

  percentage: {
    color: "#20c8ff",
    fontSize: "16px",
    fontWeight: "700",
  },

  progressBackground: {
    height: "8px",
    background: "#16315e",
    borderRadius: "10px",
    overflow: "hidden",
    width: "100%",
  },

  progressBar: {
    height: "100%",
    borderRadius: "10px",
    background:
      "linear-gradient(90deg, #00bfff, #38d9ff)",
  },

  highProgressBar: {
    height: "100%",
    borderRadius: "10px",
    background:
      "linear-gradient(90deg, #ff9d3d, #ffcf5a)",
  },

  concentrationGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "14px",
  },

  concentrationCard: {
    padding: "18px",
    borderRadius: "13px",
    background:
      "rgba(17,46,91,0.75)",
    border:
      "1px solid rgba(255,180,70,0.18)",
  },

  concentrationTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    marginBottom: "14px",
  },

  concentrationPercentage: {
    color: "#ffc45c",
    fontWeight: "700",
    fontSize: "18px",
  },

  overlapGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: "14px",
  },

  overlapCard: {
    display: "flex",
    gap: "15px",
    alignItems: "flex-start",
    padding: "18px",
    borderRadius: "13px",
    background:
      "rgba(17,46,91,0.75)",
    border:
      "1px solid rgba(70,170,255,0.18)",
  },

  overlapIcon: {
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "rgba(20,160,255,0.16)",
    color: "#2bc5ff",
    fontSize: "20px",
    fontWeight: "700",
    flexShrink: 0,
  },

  fundList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "7px",
    marginTop: "12px",
  },

  fundBadge: {
    padding: "5px 9px",
    borderRadius: "7px",
    background:
      "rgba(34,150,255,0.12)",
    border:
      "1px solid rgba(50,160,255,0.20)",
    color: "#5bcaff",
    fontSize: "11px",
    fontWeight: "600",
  },

  riskSection: {
    background:
      "linear-gradient(145deg, rgba(13,45,95,0.95), rgba(7,27,61,0.95))",
    border:
      "1px solid rgba(100,160,255,0.20)",
    borderRadius: "18px",
    padding: "24px",
    marginBottom: "22px",
  },

  riskHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "25px",
    marginBottom: "20px",
  },

  riskScoreContainer: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },

  riskScore: {
    width: "70px",
    height: "70px",
    borderRadius: "50%",
    border: "4px solid",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "25px",
    fontWeight: "800",
    background: "#091d42",
  },

  riskScoreLabel: {
    color: "#718db8",
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "1px",
  },

  riskLevel: {
    marginTop: "5px",
    fontSize: "19px",
    fontWeight: "700",
  },

  reasonsBox: {
    padding: "18px",
    borderRadius: "12px",
    background:
      "rgba(3,18,43,0.65)",
    border:
      "1px solid rgba(90,140,210,0.15)",
  },

  smallTitle: {
    marginTop: 0,
    marginBottom: "14px",
    fontSize: "14px",
  },

  reasonRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "10px",
  },

  warningIcon: {
    width: "23px",
    height: "23px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,180,60,0.16)",
    color: "#ffc45c",
    fontWeight: "800",
    fontSize: "12px",
    flexShrink: 0,
  },

  reasonText: {
    color: "#b9c9e1",
    fontSize: "13px",
  },

  successBox: {
    padding: "17px",
    borderRadius: "10px",
    background:
      "rgba(40,210,150,0.08)",
    border:
      "1px solid rgba(40,210,150,0.18)",
    color: "#4be3aa",
    fontSize: "13px",
  },

  emptyBox: {
    padding: "25px",
    textAlign: "center",
    color: "#8298b9",
    background:
      "rgba(4,18,42,0.5)",
    borderRadius: "10px",
  },

  loadingBox: {
    minHeight: "500px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffffff",
  },

  loadingCircle: {
    fontSize: "45px",
    color: "#20c8ff",
    marginBottom: "15px",
  },

  errorBox: {
    padding: "40px",
    margin: "50px auto",
    maxWidth: "600px",
    textAlign: "center",
    borderRadius: "18px",
    background:
      "rgba(30,45,80,0.9)",
    color: "#ffffff",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background:
      "rgba(0,0,0,0.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: "20px",
    boxSizing: "border-box",
  },

  modal: {
    width: "100%",
    maxWidth: "520px",
    maxHeight: "90vh",
    overflowY: "auto",
    background:
      "linear-gradient(145deg, #0d2855, #071b3b)",
    border:
      "1px solid rgba(90,150,255,0.28)",
    borderRadius: "18px",
    padding: "25px",
    boxSizing: "border-box",
    boxShadow:
      "0 25px 80px rgba(0,0,0,0.55)",
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "22px",
  },

  modalTitle: {
    margin: 0,
    fontSize: "22px",
  },

  modalSubtitle: {
    color: "#8299bd",
    fontSize: "12px",
    marginTop: "6px",
  },

  closeButton: {
    border: "none",
    background: "transparent",
    color: "#9cb2d2",
    fontSize: "28px",
    cursor: "pointer",
    lineHeight: 1,
  },

  label: {
    display: "block",
    color: "#9db5d8",
    fontSize: "12px",
    fontWeight: "600",
    marginBottom: "7px",
    marginTop: "15px",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 13px",
    borderRadius: "9px",
    border:
      "1px solid rgba(100,160,230,0.22)",
    background: "#061936",
    color: "#ffffff",
    outline: "none",
    fontSize: "14px",
  },

  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "25px",
  },

  cancelButton: {
    border:
      "1px solid rgba(120,160,220,0.25)",
    background: "transparent",
    color: "#a7bad7",
    borderRadius: "9px",
    padding: "12px 18px",
    cursor: "pointer",
    fontWeight: "600",
  },
};