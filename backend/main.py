from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import RedirectResponse, JSONResponse
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import sqlite3
import json
import urllib.request
import urllib.error
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
import math
import os
import secrets
import time
import base64
import hashlib
import hmac
import shutil
import uuid
import re
from contextvars import ContextVar

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

try:
    from sklearn.ensemble import IsolationForest
    SKLEARN_AVAILABLE = True
except Exception:
    IsolationForest = None
    SKLEARN_AVAILABLE = False

APP_ENV = os.getenv("INSHIELD_ENV", "development").strip().lower()
DB_PATH = os.getenv("INSHIELD_DB_PATH", "inshield.db").strip() or "inshield.db"

_default_cors = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8001",
    "http://127.0.0.1:8001",
    "http://192.168.1.35:5173",
    "http://192.168.1.35:8001",
]
def _normalize_cors_origin(value: str) -> str:
    return value.strip().strip('\"\'')


CORS_ORIGINS = [
    _normalize_cors_origin(item)
    for item in os.getenv("INSHIELD_CORS_ORIGINS", ",".join(_default_cors)).split(",")
    if _normalize_cors_origin(item)
]

app = FastAPI(
    title="InShield",
    description="Investment Portfolio Intelligence & Risk Monitoring",
    version="0.5.0-auth",
)

@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Cache-Control"] = response.headers.get("Cache-Control", "no-store")
    if APP_ENV == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


AUTH_DB_PATH = os.getenv("INSHIELD_AUTH_DB_PATH", "inshield_auth.db").strip() or "inshield_auth.db"
SESSION_COOKIE = "inshield_session"
SESSION_DAYS = int(os.getenv("INSHIELD_SESSION_DAYS", "7"))
CURRENT_USER_ID = ContextVar("inshield_current_user_id", default=None)
CURRENT_USER_DB = ContextVar("inshield_current_user_db", default=None)


def get_auth_connection():
    conn = sqlite3.connect(AUTH_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _password_hash(password: str, salt: bytes | None = None):
    if salt is None:
        salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 310000)
    return base64.urlsafe_b64encode(salt).decode(), base64.urlsafe_b64encode(digest).decode()


def _password_verify(password: str, salt_b64: str, hash_b64: str):
    try:
        salt = base64.urlsafe_b64decode(salt_b64.encode())
        digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 310000)
        expected = base64.urlsafe_b64decode(hash_b64.encode())
        return hmac.compare_digest(digest, expected)
    except Exception:
        return False


def _safe_user_db_path(db_key: str):
    if db_key == "legacy":
        return DB_PATH
    root = os.path.join(os.path.dirname(os.path.abspath(AUTH_DB_PATH)) or ".", "data", "users")
    os.makedirs(root, exist_ok=True)
    return os.path.join(root, f"{db_key}.db")


def _initialize_database_file(path: str):
    conn = sqlite3.connect(path)
    conn.execute("""CREATE TABLE IF NOT EXISTS portfolio_holdings (id INTEGER PRIMARY KEY AUTOINCREMENT, asset_type TEXT NOT NULL, name TEXT NOT NULL, symbol TEXT, units REAL NOT NULL DEFAULT 0, buy_price REAL NOT NULL DEFAULT 0, invested_amount REAL NOT NULL, buy_date TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)""")
    conn.execute("""CREATE TABLE IF NOT EXISTS xray_holdings (id INTEGER PRIMARY KEY AUTOINCREMENT, fund_name TEXT NOT NULL, stock_name TEXT NOT NULL, stock_symbol TEXT, amount REAL NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)""")
    conn.execute("""CREATE TABLE IF NOT EXISTS portfolio_valuation_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, snapshot_date TEXT NOT NULL UNIQUE, invested_value REAL NOT NULL, current_value REAL NOT NULL, day_pnl REAL NOT NULL, overall_pnl REAL NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)""")
    conn.execute("""CREATE TABLE IF NOT EXISTS broker_connections (id INTEGER PRIMARY KEY AUTOINCREMENT, provider TEXT NOT NULL UNIQUE, label TEXT, status TEXT NOT NULL DEFAULT 'disconnected', last_test_at TEXT, last_sync_at TEXT, last_sync_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)""")
    conn.execute("""CREATE TABLE IF NOT EXISTS broker_sync_log (id INTEGER PRIMARY KEY AUTOINCREMENT, provider TEXT NOT NULL, mode TEXT NOT NULL, imported_count INTEGER NOT NULL DEFAULT 0, imported_value REAL NOT NULL DEFAULT 0, status TEXT NOT NULL, message TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)""")
    cols={r[1] for r in conn.execute("PRAGMA table_info(xray_holdings)").fetchall()}
    if "sector" not in cols: conn.execute("ALTER TABLE xray_holdings ADD COLUMN sector TEXT")
    if "market_cap" not in cols: conn.execute("ALTER TABLE xray_holdings ADD COLUMN market_cap TEXT")
    conn.commit(); conn.close()


def init_auth_db():
    conn=get_auth_connection()
    conn.execute("""CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, mobile TEXT NOT NULL UNIQUE, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, db_key TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, last_login_at TEXT)""")
    conn.execute("""CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at)")
    conn.commit(); conn.close()


def _get_user_by_id(user_id):
    conn=get_auth_connection(); row=conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone(); conn.close(); return row


def _get_user_by_mobile(mobile):
    conn=get_auth_connection(); row=conn.execute("SELECT * FROM users WHERE mobile=?", (mobile,)).fetchone(); conn.close(); return row


def _session_user(token):
    if not token: return None
    token_hash=hashlib.sha256(token.encode()).hexdigest()
    now=datetime.now(timezone.utc).isoformat()
    conn=get_auth_connection()
    row=conn.execute("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?", (token_hash, now)).fetchone()
    conn.close()
    return row


def _create_session(user_id):
    token=secrets.token_urlsafe(48)
    token_hash=hashlib.sha256(token.encode()).hexdigest()
    expires=(datetime.now(timezone.utc)+timedelta(days=SESSION_DAYS)).isoformat()
    conn=get_auth_connection(); conn.execute("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)", (token_hash,user_id,expires)); conn.execute("UPDATE users SET last_login_at=? WHERE id=?", (datetime.now(timezone.utc).isoformat(),user_id)); conn.commit(); conn.close()
    return token, expires


def _normalize_mobile(value):
    mobile=(value or "").strip().replace(" ", "").replace("-", "")
    if mobile.startswith("+91"): mobile=mobile[3:]
    if not re.fullmatch(r"[6-9]\d{9}", mobile):
        raise HTTPException(status_code=400, detail="Enter a valid 10-digit Indian mobile number.")
    return mobile


def _require_user():
    user_id=CURRENT_USER_ID.get()
    if not user_id: raise HTTPException(status_code=401, detail="Login required.")
    row=_get_user_by_id(user_id)
    if not row: raise HTTPException(status_code=401, detail="Session is no longer valid.")
    return row


def get_connection():
    db_path=CURRENT_USER_DB.get() or DB_PATH
    if db_path != DB_PATH and not os.path.exists(db_path):
        _initialize_database_file(db_path)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS portfolio_holdings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            asset_type TEXT NOT NULL,
            name TEXT NOT NULL,
            symbol TEXT,
            units REAL NOT NULL DEFAULT 0,
            buy_price REAL NOT NULL DEFAULT 0,
            invested_amount REAL NOT NULL,
            buy_date TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS xray_holdings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fund_name TEXT NOT NULL,
            stock_name TEXT NOT NULL,
            stock_symbol TEXT,
            amount REAL NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS portfolio_valuation_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_date TEXT NOT NULL UNIQUE,
            invested_value REAL NOT NULL,
            current_value REAL NOT NULL,
            day_pnl REAL NOT NULL,
            overall_pnl REAL NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()


init_db()


def ensure_xray_metadata_columns():
    """Add Phase 4 metadata columns without destroying an existing database."""
    conn = get_connection()
    columns = {row[1] for row in conn.execute("PRAGMA table_info(xray_holdings)").fetchall()}
    if "sector" not in columns:
        conn.execute("ALTER TABLE xray_holdings ADD COLUMN sector TEXT")
    if "market_cap" not in columns:
        conn.execute("ALTER TABLE xray_holdings ADD COLUMN market_cap TEXT")
    conn.commit()
    conn.close()


ensure_xray_metadata_columns()
init_auth_db()


PUBLIC_PATHS = {"/", "/health", "/ready", "/docs", "/openapi.json", "/redoc", "/auth/register", "/auth/login"}


@app.middleware("http")
async def authentication_middleware(request, call_next):
    if request.method == "OPTIONS" or request.url.path in PUBLIC_PATHS or request.url.path.startswith("/docs"):
        return await call_next(request)
    token=request.cookies.get(SESSION_COOKIE)
    user=_session_user(token)
    if not user:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=401, content={"detail":"Login required."})
    t1=CURRENT_USER_ID.set(user["id"]); t2=CURRENT_USER_DB.set(_safe_user_db_path(user["db_key"]))
    try:
        return await call_next(request)
    finally:
        CURRENT_USER_DB.reset(t2); CURRENT_USER_ID.reset(t1)


# CORS must be registered after authentication middleware so it becomes
# the outermost middleware and adds CORS headers even to 401 responses.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    # Supports the deployed Render frontend in addition to local LAN development.
    allow_origin_regex=r"^(https://inshield-frontend\.onrender\.com|http://192\.168\.\d+\.\d+:(5173|8001))$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


class AuthCredentials(BaseModel):
    mobile: str
    password: str


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


@app.post("/auth/register")
def auth_register(credentials: AuthCredentials):
    mobile=_normalize_mobile(credentials.mobile)
    password=credentials.password or ""
    if len(password)<8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    if _get_user_by_mobile(mobile):
        raise HTTPException(status_code=409, detail="An InShield account already exists for this mobile number.")
    salt_b64, hash_b64=_password_hash(password)
    user_id=uuid.uuid4().hex
    conn=get_auth_connection()
    count=conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    db_key="legacy" if count==0 and os.path.exists(DB_PATH) else uuid.uuid4().hex
    conn.execute("INSERT INTO users(id,mobile,password_salt,password_hash,db_key) VALUES(?,?,?,?,?)", (user_id,mobile,salt_b64,hash_b64,db_key))
    conn.commit(); conn.close()
    _initialize_database_file(_safe_user_db_path(db_key))
    token, expires=_create_session(user_id)
    response=JSONResponse(content={"success":True,"user":{"id":user_id,"mobile":mobile}})
    response.set_cookie(SESSION_COOKIE, token, httponly=True, secure=APP_ENV=="production", samesite="lax", max_age=SESSION_DAYS*86400, path="/")
    return response


@app.post("/auth/login")
def auth_login(credentials: AuthCredentials):
    mobile=_normalize_mobile(credentials.mobile)
    user=_get_user_by_mobile(mobile)
    if not user or not _password_verify(credentials.password or "", user["password_salt"], user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid mobile number or password.")
    _initialize_database_file(_safe_user_db_path(user["db_key"]))
    token, expires=_create_session(user["id"])
    response=JSONResponse(content={"success":True,"user":{"id":user["id"],"mobile":user["mobile"]}})
    response.set_cookie(SESSION_COOKIE, token, httponly=True, secure=APP_ENV=="production", samesite="lax", max_age=SESSION_DAYS*86400, path="/")
    return response


@app.get("/auth/me")
def auth_me():
    user=_require_user()
    return {"authenticated":True,"user":{"id":user["id"],"mobile":user["mobile"]}}


@app.post("/auth/logout")
def auth_logout(request: Request):
    _require_user()
    token=request.cookies.get(SESSION_COOKIE)
    if token:
        token_hash=hashlib.sha256(token.encode()).hexdigest()
        conn=get_auth_connection(); conn.execute("DELETE FROM sessions WHERE token_hash=?", (token_hash,)); conn.commit(); conn.close()
    response=JSONResponse(content={"success":True,"message":"Logged out successfully."})
    response.delete_cookie(SESSION_COOKIE, path="/")
    return response


@app.post("/auth/change-password")
def auth_change_password(payload: PasswordChange):
    user=_require_user()
    if len(payload.new_password or "")<8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters.")
    if not _password_verify(payload.current_password or "", user["password_salt"], user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    salt_b64, hash_b64=_password_hash(payload.new_password)
    conn=get_auth_connection(); conn.execute("UPDATE users SET password_salt=?, password_hash=? WHERE id=?", (salt_b64,hash_b64,user["id"])); conn.commit(); conn.close()
    return {"success":True,"message":"Password changed successfully."}


class Portfolio(BaseModel):
    total_investment: float
    funds: dict


class InvestmentCreate(BaseModel):
    asset_type: str
    name: str
    symbol: Optional[str] = None
    units: float = 0
    buy_price: float = 0
    invested_amount: float
    buy_date: Optional[str] = None


class XRayHoldingCreate(BaseModel):
    fund_name: str
    stock_name: str
    stock_symbol: str
    amount: float
    sector: Optional[str] = None
    market_cap: Optional[str] = None


class BrokerConnectRequest(BaseModel):
    provider: str
    label: Optional[str] = None


class BrokerSyncRequest(BaseModel):
    provider: str
    mode: str = "replace"
    confirm: bool = False


@app.get("/")
def home():
    return {"message": "Welcome to InShield", "status": "API is running"}


@app.get("/health")
def health():
    return {"status": "ok", "environment": APP_ENV, "service": "inshield-api"}


@app.get("/ready")
def ready():
    try:
        conn = get_connection()
        conn.execute("SELECT 1").fetchone()
        conn.close()
        return {"status": "ready", "database": "ok"}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {type(exc).__name__}")


# -----------------------------
# Portfolio X-Ray
# -----------------------------


def normalize_sector(value):
    value = (value or "").strip().title()
    return value if value else "Other"


def normalize_market_cap(value):
    value = (value or "").strip().title()
    allowed = {"Large Cap", "Mid Cap", "Small Cap", "Other"}
    return value if value in allowed else "Other"


# Lightweight metadata for common Indian securities. Unknown securities remain Other
# instead of inventing a classification.
SECURITY_METADATA = {
    "RELIANCE": ("Energy", "Large Cap"),
    "TCS": ("IT", "Large Cap"),
    "INFY": ("IT", "Large Cap"),
    "HDFCBANK": ("Financials", "Large Cap"),
    "ICICIBANK": ("Financials", "Large Cap"),
    "SBIN": ("Financials", "Large Cap"),
    "WIPRO": ("IT", "Large Cap"),
    "ITC": ("Consumer", "Large Cap"),
    "LT": ("Industrials", "Large Cap"),
    "BHARTIARTL": ("Telecom", "Large Cap"),
    "HINDUNILVR": ("Consumer", "Large Cap"),
    "MARUTI": ("Auto", "Large Cap"),
    "SUNPHARMA": ("Healthcare", "Large Cap"),
    "AXISBANK": ("Financials", "Large Cap"),
    "KOTAKBANK": ("Financials", "Large Cap"),
}


def get_security_metadata(symbol, sector=None, market_cap=None):
    mapped_sector, mapped_cap = SECURITY_METADATA.get(
        (symbol or "").strip().upper(), ("Other", "Other")
    )
    return normalize_sector(sector or mapped_sector), normalize_market_cap(market_cap or mapped_cap)


def calculate_phase4_breakdowns(xray_rows, portfolio_rows_override=None):
    """Build real Phase 4 breakdowns from persisted portfolio/X-Ray data."""
    if portfolio_rows_override is None:
        conn = get_connection()
        portfolio_rows = conn.execute("""
            SELECT asset_type, name, symbol, invested_amount
            FROM portfolio_holdings
            ORDER BY id ASC
        """).fetchall()
        conn.close()
    else:
        portfolio_rows = portfolio_rows_override

    # Asset allocation uses the user's persisted invested amounts.
    asset_amounts = {"Equity": 0.0, "Debt": 0.0, "Gold": 0.0, "Cash": 0.0, "Other": 0.0}
    for row in portfolio_rows:
        amount = float(row["invested_amount"] or 0)
        asset_type = row["asset_type"]
        # Current InShield asset model contains STOCK/MUTUAL_FUND/ETF only;
        # all three represent market-linked equity exposure unless later metadata says otherwise.
        if asset_type in {"STOCK", "MUTUAL_FUND", "ETF"}:
            asset_amounts["Equity"] += amount
        else:
            asset_amounts["Other"] += amount

    asset_total = sum(asset_amounts.values())
    asset_allocation = {
        key: round((value / asset_total) * 100, 2) if asset_total else 0
        for key, value in asset_amounts.items()
        if value > 0
    }

    # Sector and market-cap exposure use X-Ray underlying exposure plus direct stocks.
    sector_amounts = {}
    cap_amounts = {}
    exposure_total = 0.0

    for row in xray_rows:
        amount = float(row["amount"] or 0)
        symbol = (row["stock_symbol"] or "").strip().upper()
        sector, market_cap = get_security_metadata(symbol, row["sector"], row["market_cap"])
        sector_amounts[sector] = sector_amounts.get(sector, 0) + amount
        cap_amounts[market_cap] = cap_amounts.get(market_cap, 0) + amount
        exposure_total += amount

    # Add direct stock holdings that are not already represented by X-Ray rows.
    xray_symbols = {(row["stock_symbol"] or "").strip().upper() for row in xray_rows}
    for row in portfolio_rows:
        if row["asset_type"] != "STOCK":
            continue
        symbol = (row["symbol"] or "").strip().upper()
        if not symbol or symbol in xray_symbols:
            continue
        amount = float(row["invested_amount"] or 0)
        sector, market_cap = get_security_metadata(symbol)
        sector_amounts[sector] = sector_amounts.get(sector, 0) + amount
        cap_amounts[market_cap] = cap_amounts.get(market_cap, 0) + amount
        exposure_total += amount

    sector_exposure = {
        key: round((value / exposure_total) * 100, 2)
        for key, value in sorted(sector_amounts.items(), key=lambda x: x[1], reverse=True)
        if exposure_total and value > 0
    }
    market_cap_exposure = {
        key: round((value / exposure_total) * 100, 2)
        for key, value in sorted(cap_amounts.items(), key=lambda x: x[1], reverse=True)
        if exposure_total and value > 0
    }

    return {
        "asset_allocation": asset_allocation,
        "sector_exposure": sector_exposure,
        "market_cap_exposure": market_cap_exposure,
    }


def calculate_xray(portfolio_rows_override=None):
    """
    Calculate Portfolio X-Ray using persisted X-Ray holdings.

    Older/demo X-Ray data can contain company exposure amounts that are
    larger than the actual fund investment. We normalize each matched
    fund's X-Ray exposure against its persisted portfolio investment.
    This prevents impossible portfolio percentages such as 137%.
    """
    conn = get_connection()

    rows = conn.execute("""
        SELECT id, fund_name, stock_name, stock_symbol, amount, sector, market_cap
        FROM xray_holdings
        ORDER BY id ASC
    """).fetchall()

    if portfolio_rows_override is None:
        portfolio_rows = conn.execute("""
            SELECT id, asset_type, name, symbol, invested_amount
            FROM portfolio_holdings
            ORDER BY id ASC
        """).fetchall()
    else:
        portfolio_rows = portfolio_rows_override

    conn.close()

    if not rows:
        phase4 = calculate_phase4_breakdowns(rows, portfolio_rows)
        return {
            "message": "No X-Ray data available",
            **phase4,
        }

    # ---------------------------------------------------------
    # Build lookup of persisted mutual-fund investments.
    # ---------------------------------------------------------
    portfolio_funds_by_name = {}
    portfolio_funds_by_symbol = {}
    portfolio_total = 0.0

    for portfolio_row in portfolio_rows:
        portfolio_total += float(portfolio_row["invested_amount"] or 0)

        if portfolio_row["asset_type"] != "MUTUAL_FUND":
            continue

        name = (portfolio_row["name"] or "").strip().upper()
        symbol = (portfolio_row["symbol"] or "").strip().upper()
        invested = float(portfolio_row["invested_amount"] or 0)

        if name:
            portfolio_funds_by_name[name] = invested

        if symbol:
            portfolio_funds_by_symbol[symbol] = invested

    # ---------------------------------------------------------
    # Calculate raw X-Ray exposure per fund.
    # ---------------------------------------------------------
    raw_fund_amounts = {}
    fund_match_info = {}

    for row in rows:
        fund_name = (row["fund_name"] or "").strip()
        fund_key = fund_name.upper()
        amount = max(float(row["amount"] or 0), 0)
        symbol = (row["stock_symbol"] or "").strip().upper()

        raw_fund_amounts[fund_key] = (
            raw_fund_amounts.get(fund_key, 0.0) + amount
        )

        matched_investment = None
        match_type = None

        if fund_key in portfolio_funds_by_name:
            matched_investment = portfolio_funds_by_name[fund_key]
            match_type = "name"
        elif symbol and symbol in portfolio_funds_by_symbol:
            matched_investment = portfolio_funds_by_symbol[symbol]
            match_type = "symbol"

        if fund_key not in fund_match_info:
            fund_match_info[fund_key] = {
                "fund_name": fund_name,
                "invested_amount": matched_investment,
                "match_type": match_type,
            }

    # ---------------------------------------------------------
    # Normalize each fund's X-Ray exposure.
    #
    # If a fund has ₹60,000 of entered X-Ray exposure but only
    # ₹40,000 invested, all of that fund's underlying exposures
    # are scaled by 40,000 / 60,000.
    # ---------------------------------------------------------
    fund_scale = {}

    for fund_key, raw_amount in raw_fund_amounts.items():
        matched_investment = fund_match_info[fund_key]["invested_amount"]

        if raw_amount <= 0:
            fund_scale[fund_key] = 0.0
        elif matched_investment is not None and matched_investment > 0:
            fund_scale[fund_key] = min(
                1.0,
                matched_investment / raw_amount,
            )
        else:
            # Keep unmatched legacy data, but report it as a warning.
            fund_scale[fund_key] = 1.0

    normalized_rows = []

    for row in rows:
        fund_key = (row["fund_name"] or "").strip().upper()
        raw_amount = max(float(row["amount"] or 0), 0)
        normalized_amount = raw_amount * fund_scale.get(fund_key, 1.0)

        normalized_rows.append({
            "id": row["id"],
            "fund_name": row["fund_name"],
            "stock_name": row["stock_name"],
            "stock_symbol": row["stock_symbol"],
            "amount": normalized_amount,
            "sector": row["sector"],
            "market_cap": row["market_cap"],
        })

    # ---------------------------------------------------------
    # Final safety check for old/unmatched demo data.
    # X-Ray exposure cannot exceed the total persisted portfolio.
    # ---------------------------------------------------------
    normalized_total = sum(
        float(row["amount"] or 0)
        for row in normalized_rows
    )

    portfolio_scale = 1.0

    if portfolio_total > 0 and normalized_total > portfolio_total:
        portfolio_scale = portfolio_total / normalized_total

        for row in normalized_rows:
            row["amount"] *= portfolio_scale

        normalized_total = portfolio_total

    # Use normalized data for Phase 4 and Phase 5.
    phase4 = calculate_phase4_breakdowns(normalized_rows, portfolio_rows)

    if normalized_total <= 0:
        return {
            "message": "No X-Ray data available",
            "portfolio_invested": round(portfolio_total, 2),
            "hidden_exposure_total": 0,
            **phase4,
        }

    # ---------------------------------------------------------
    # Aggregate the same company across all tracked funds.
    # ---------------------------------------------------------
    stock_amounts = {}
    stock_funds = {}
    fund_amounts = {}
    fund_companies = {}

    for row in normalized_rows:
        stock = (row["stock_name"] or "").strip().upper()
        fund = (row["fund_name"] or "").strip()
        amount = float(row["amount"] or 0)

        if not stock or amount <= 0:
            continue

        stock_amounts[stock] = stock_amounts.get(stock, 0.0) + amount

        stock_funds.setdefault(stock, [])
        if fund not in stock_funds[stock]:
            stock_funds[stock].append(fund)

        fund_key = fund.upper()
        fund_amounts[fund] = fund_amounts.get(fund, 0.0) + amount

        fund_companies.setdefault(fund_key, {})
        fund_companies[fund_key][stock] = (
            fund_companies[fund_key].get(stock, 0.0) + amount
        )

    # ---------------------------------------------------------
    # X-Ray percentage = company exposure / total X-Ray exposure.
    # ---------------------------------------------------------
    stock_exposure = {
        stock: round((amount / normalized_total) * 100, 2)
        for stock, amount in stock_amounts.items()
        if normalized_total > 0
    }

    # ---------------------------------------------------------
    # Portfolio percentage = company exposure / actual portfolio.
    # This is the percentage used for concentration warnings.
    # ---------------------------------------------------------
    effective_company_exposure = {}

    for stock, amount in sorted(
        stock_amounts.items(),
        key=lambda item: item[1],
        reverse=True,
    ):
        portfolio_percent = (
            (amount / portfolio_total) * 100
            if portfolio_total > 0
            else 0
        )

        effective_company_exposure[stock] = {
            "exposure_amount": round(amount, 2),
            "portfolio_percent": round(portfolio_percent, 2),
            "xray_percent": round(
                (amount / normalized_total) * 100,
                2,
            ),
            "funds": stock_funds.get(stock, []),
        }

    # ---------------------------------------------------------
    # Fund-level exposure.
    # ---------------------------------------------------------
    fund_exposure = {}

    for fund, amount in sorted(
        fund_amounts.items(),
        key=lambda item: item[1],
        reverse=True,
    ):
        fund_exposure[fund] = {
            "exposure_amount": round(amount, 2),
            "portfolio_percent": (
                round((amount / portfolio_total) * 100, 2)
                if portfolio_total > 0
                else 0
            ),
            "companies": len(fund_companies.get(fund.upper(), {})),
        }

    # ---------------------------------------------------------
    # Phase 6: Fund-to-fund overlap analysis.
    #
    # For each pair of funds, calculate the shared economic
    # exposure in common companies. The overlap percentage is
    # measured against the smaller fund's total X-Ray exposure.
    # ---------------------------------------------------------
    fund_overlap = []
    fund_names = list(fund_companies.keys())

    # Preserve the original display names used in fund_amounts.
    fund_display_names = {
        fund.upper(): fund
        for fund in fund_amounts.keys()
    }

    for index, fund_a_key in enumerate(fund_names):
        for fund_b_key in fund_names[index + 1:]:
            holdings_a = fund_companies.get(fund_a_key, {})
            holdings_b = fund_companies.get(fund_b_key, {})

            common_stocks = sorted(
                set(holdings_a.keys()) & set(holdings_b.keys())
            )

            if not common_stocks:
                continue

            fund_a_total = sum(float(v or 0) for v in holdings_a.values())
            fund_b_total = sum(float(v or 0) for v in holdings_b.values())

            shared_amount = sum(
                min(
                    float(holdings_a[stock] or 0),
                    float(holdings_b[stock] or 0),
                )
                for stock in common_stocks
            )

            smaller_fund_total = min(fund_a_total, fund_b_total)
            overlap_percent = (
                (shared_amount / smaller_fund_total) * 100
                if smaller_fund_total > 0
                else 0
            )

            if overlap_percent >= 50:
                overlap_level = "High"
            elif overlap_percent >= 25:
                overlap_level = "Moderate"
            else:
                overlap_level = "Low"

            common_holdings = [
                {
                    "company": stock,
                    "fund_a_amount": round(float(holdings_a[stock]), 2),
                    "fund_b_amount": round(float(holdings_b[stock]), 2),
                    "shared_amount": round(
                        min(
                            float(holdings_a[stock]),
                            float(holdings_b[stock]),
                        ),
                        2,
                    ),
                }
                for stock in common_stocks
            ]

            fund_overlap.append({
                "fund_a": fund_display_names.get(fund_a_key, fund_a_key),
                "fund_b": fund_display_names.get(fund_b_key, fund_b_key),
                "common_companies": len(common_stocks),
                "overlap_amount": round(shared_amount, 2),
                "overlap_percent": round(overlap_percent, 2),
                "overlap_level": overlap_level,
                "common_holdings": common_holdings,
            })

    fund_overlap.sort(
        key=lambda item: (
            -float(item["overlap_percent"]),
            -int(item["common_companies"]),
        )
    )

    # ---------------------------------------------------------
    # Concentration now uses actual portfolio percentage,
    # not only X-Ray percentage.
    # ---------------------------------------------------------
    high_concentration = {
        stock: details["portfolio_percent"]
        for stock, details in effective_company_exposure.items()
        if details["portfolio_percent"] >= 10
    }

    # ---------------------------------------------------------
    # Overlap detection.
    # ---------------------------------------------------------
    overlapping_stocks = {
        stock: funds
        for stock, funds in stock_funds.items()
        if len(funds) > 1
    }

    # ---------------------------------------------------------
    # Risk score.
    # ---------------------------------------------------------
    risk_score = min(
        100,
        20
        + len(high_concentration) * 5
        + len(overlapping_stocks) * 15,
    )

    risk_level = (
        "High"
        if risk_score >= 60
        else "Moderate"
        if risk_score >= 30
        else "Low"
    )

    risk_reasons = []

    for stock, percentage in sorted(
        high_concentration.items(),
        key=lambda item: item[1],
        reverse=True,
    ):
        risk_reasons.append(
            f"{stock} has high portfolio concentration of {percentage}%"
        )

    for stock, funds in overlapping_stocks.items():
        risk_reasons.append(
            f"{stock} is held across {len(funds)} funds"
        )

    # ---------------------------------------------------------
    # Data-quality information.
    # ---------------------------------------------------------
    normalization_applied = (
        any(abs(scale - 1.0) > 0.000001 for scale in fund_scale.values())
        or abs(portfolio_scale - 1.0) > 0.000001
    )

    unmatched_funds = [
        info["fund_name"]
        for info in fund_match_info.values()
        if info["invested_amount"] is None
    ]

    data_quality = {
        "normalization_applied": normalization_applied,
        "portfolio_scale_applied": portfolio_scale < 1.0,
        "unmatched_funds": unmatched_funds,
        "message": (
            "Legacy X-Ray exposure was normalized against persisted "
            "portfolio investment values."
            if normalization_applied
            else "X-Ray exposure is consistent with persisted portfolio values."
        ),
    }

    return {
        "total_exposure": round(normalized_total, 2),
        "stock_exposure": stock_exposure,
        "high_concentration": high_concentration,
        "overlapping_stocks": overlapping_stocks,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "risk_reasons": risk_reasons,
        "portfolio_invested": round(portfolio_total, 2),
        "hidden_exposure_total": round(normalized_total, 2),
        "effective_company_exposure": effective_company_exposure,
        "fund_exposure": fund_exposure,
        "fund_overlap": fund_overlap,
        "data_quality": data_quality,
        **phase4,
    }


# -----------------------------
# Phase 7: Risk Score & Diversification Engine
# -----------------------------

def _risk_level(score):
    if score >= 70:
        return "Very High"
    if score >= 50:
        return "High"
    if score >= 30:
        return "Moderate"
    return "Low"


def _hhi(percentages):
    """Herfindahl-Hirschman Index on percentage weights (0-10,000)."""
    return round(sum((float(p) ** 2) for p in percentages), 2)


def _diversification_label(score):
    if score >= 75:
        return "Well diversified"
    if score >= 55:
        return "Reasonably diversified"
    if score >= 35:
        return "Needs diversification"
    return "Highly concentrated"


def _calculate_risk_for_context(xray, portfolio_rows, xray_symbol_rows):
    """Explainable portfolio concentration and diversification analytics."""
    if xray is None:
        xray = calculate_xray()

    portfolio_total = sum(float(row["invested_amount"] or 0) for row in portfolio_rows)

    if portfolio_total <= 0:
        return {
            "risk_score": 0,
            "risk_level": "Low",
            "diversification_score": 0,
            "diversification_label": "No portfolio data",
            "metrics": {},
            "components": {},
            "reasons": [],
            "recommendations": ["Add portfolio investments to calculate risk."],
        }

    # Company exposure = X-Ray underlying exposure + direct stocks that are not
    # already represented by the X-Ray. This avoids double counting.
    company_amounts = {}
    for company, details in xray.get("effective_company_exposure", {}).items():
        company_amounts[company] = float(details.get("exposure_amount", 0) or 0)

    # Direct stock/ETF positions are real portfolio exposure even when the
    # same company also appears inside a mutual fund. Keep both exposures and
    # merge them into the same company bucket when the names/symbols match.
    xray_name_by_symbol = {}
    for row in xray_symbol_rows:
        symbol = (row["stock_symbol"] or "").strip().upper()
        name = (row["stock_name"] or "").strip().upper()
        if symbol and name:
            xray_name_by_symbol[symbol] = name

    direct_stock_count = 0
    for row in portfolio_rows:
        if row["asset_type"] not in {"STOCK", "ETF"}:
            continue
        symbol = (row["symbol"] or "").strip().upper()
        name = xray_name_by_symbol.get(symbol) or (row["name"] or symbol or "Direct Stock").strip().upper()
        amount = max(float(row["invested_amount"] or 0), 0)
        if amount <= 0:
            continue
        company_amounts[name] = company_amounts.get(name, 0) + amount
        direct_stock_count += 1

    # A company's economic exposure must never make the concentration basket
    # exceed the actual portfolio. Legacy/unmatched X-Ray data can otherwise
    # produce impossible totals. If known exposures exceed the denominator,
    # scale the basket proportionally rather than displaying >100%.
    known_company_total = sum(max(float(v), 0.0) for v in company_amounts.values())
    if known_company_total > portfolio_total > 0:
        company_scale = portfolio_total / known_company_total
        company_amounts = {k: v * company_scale for k, v in company_amounts.items()}

    company_percentages = [
        (amount / portfolio_total) * 100
        for amount in company_amounts.values()
        if amount > 0
    ]
    company_percentages.sort(reverse=True)
    # Protect against floating-point rounding at the boundary.
    company_percentages = [min(100.0, max(0.0, v)) for v in company_percentages]
    top_company_pct = company_percentages[0] if company_percentages else 0
    top_3_pct = sum(company_percentages[:3])
    company_hhi = _hhi(company_percentages)

    # Concentration component: maximum 50 points.
    top_company_points = min(35.0, top_company_pct * 0.39)
    hhi_points = min(15.0, max(0.0, (company_hhi - 1500) / 100))
    company_component = min(50.0, top_company_points + hhi_points)

    # Sector component: maximum 20 points.
    sector_entries = xray.get("sector_exposure", {}) or {}
    sector_values = sorted((float(v) for v in sector_entries.values()), reverse=True)
    top_sector_pct = sector_values[0] if sector_values else 0
    sector_hhi = _hhi(sector_values)
    sector_component = min(20.0, top_sector_pct * 0.14 + max(0.0, (sector_hhi - 3500) / 250))

    # Fund overlap component: maximum 20 points.
    overlap_entries = xray.get("fund_overlap", []) or []
    max_overlap_pct = max((float(item.get("overlap_percent", 0) or 0) for item in overlap_entries), default=0)
    high_overlap_pairs = sum(1 for item in overlap_entries if item.get("overlap_level") == "High")
    moderate_overlap_pairs = sum(1 for item in overlap_entries if item.get("overlap_level") == "Moderate")
    overlap_component = min(20.0, max_overlap_pct * 0.15 + high_overlap_pairs * 3 + moderate_overlap_pairs * 1.5)

    # Market-cap component: maximum 10 points. Unknown/Other is not treated
    # as inherently risky, but a highly concentrated known bucket still counts.
    cap_entries = xray.get("market_cap_exposure", {}) or {}
    cap_values = sorted((float(v) for v in cap_entries.values()), reverse=True)
    top_cap_pct = cap_values[0] if cap_values else 0
    cap_component = min(10.0, top_cap_pct * 0.10)

    raw_score = company_component + sector_component + overlap_component + cap_component
    risk_score = int(round(min(100.0, max(0.0, raw_score))))
    risk_level = _risk_level(risk_score)
    diversification_score = int(round(max(0.0, 100.0 - risk_score)))

    reasons = []
    recommendations = []

    if top_company_pct >= 40:
        reasons.append(f"Top company exposure is {top_company_pct:.2f}% of the portfolio.")
        recommendations.append("Reduce dependence on the largest company exposure or add unrelated holdings.")
    elif top_company_pct >= 20:
        reasons.append(f"Top company exposure is {top_company_pct:.2f}%, creating meaningful concentration.")
        recommendations.append("Consider adding companies outside the largest current exposure.")

    if top_sector_pct >= 60:
        reasons.append(f"The largest sector represents {top_sector_pct:.2f}% of analyzed exposure.")
        recommendations.append("Add exposure to different sectors to reduce sector concentration.")
    elif top_sector_pct >= 40:
        reasons.append(f"Sector concentration is elevated at {top_sector_pct:.2f}% in the largest sector.")

    if max_overlap_pct >= 50:
        reasons.append(f"The highest fund overlap is {max_overlap_pct:.2f}%, indicating duplicated underlying exposure.")
        recommendations.append("Review highly overlapping funds before adding another similar fund.")
    elif max_overlap_pct >= 25:
        reasons.append(f"The highest fund overlap is {max_overlap_pct:.2f}%.")

    if top_cap_pct >= 80:
        reasons.append(f"{top_cap_pct:.2f}% of analyzed exposure sits in one market-cap bucket.")

    if not reasons:
        reasons.append("No major concentration or overlap risk was detected from the available data.")
        recommendations.append("Maintain diversification and review the X-Ray periodically.")

    # Keep the recommendation list compact and unique.
    recommendations = list(dict.fromkeys(recommendations))[:4]

    return {
        "risk_score": risk_score,
        "risk_level": risk_level,
        "diversification_score": diversification_score,
        "diversification_label": _diversification_label(diversification_score),
        "metrics": {
            "portfolio_invested": round(portfolio_total, 2),
            "companies_analyzed": len(company_percentages),
            "direct_stocks_included": direct_stock_count,
            "top_company_percent": round(top_company_pct, 2),
            "top_3_company_percent": round(top_3_pct, 2),
            "company_hhi": company_hhi,
            "top_sector_percent": round(top_sector_pct, 2),
            "sector_hhi": sector_hhi,
            "max_fund_overlap_percent": round(max_overlap_pct, 2),
            "overlapping_fund_pairs": len(overlap_entries),
            "top_market_cap_percent": round(top_cap_pct, 2),
        },
        "components": {
            "company_concentration": round(company_component, 2),
            "sector_concentration": round(sector_component, 2),
            "fund_overlap": round(overlap_component, 2),
            "market_cap_concentration": round(cap_component, 2),
        },
        "reasons": reasons,
        "recommendations": recommendations,
        "methodology": "Company concentration 50 pts + sector concentration 20 pts + fund overlap 20 pts + market-cap concentration 10 pts.",
    }


def calculate_risk(xray=None):
    if xray is None:
        xray = calculate_xray()
    conn = get_connection()
    portfolio_rows = conn.execute("""
        SELECT asset_type, name, symbol, invested_amount
        FROM portfolio_holdings
        ORDER BY id ASC
    """).fetchall()
    xray_symbol_rows = conn.execute("SELECT stock_name, stock_symbol FROM xray_holdings").fetchall()
    conn.close()
    return _calculate_risk_for_context(xray, portfolio_rows, xray_symbol_rows)



# -----------------------------
# Phase 8: What-If Simulator
# -----------------------------

class SimulatorChange(BaseModel):
    action: str = "add"  # add | remove | reduce
    holding_id: Optional[int] = None
    name: str = ""
    symbol: Optional[str] = None
    asset_type: str = "STOCK"
    amount: float = 0
    sector: Optional[str] = None
    market_cap: Optional[str] = None


def _rows_with_scenario(base_rows, changes):
    """Build an in-memory portfolio scenario without touching SQLite."""
    rows = []
    for row in base_rows:
        rows.append({
            "asset_type": row["asset_type"],
            "name": row["name"],
            "symbol": row["symbol"],
            "invested_amount": float(row["invested_amount"] or 0),
            "_id": row.get("id") if isinstance(row, dict) else None,
        })

    for change in changes:
        action = (change.action or "add").strip().lower()
        amount = max(float(change.amount or 0), 0)
        if action == "add":
            if amount <= 0:
                raise HTTPException(status_code=400, detail="Scenario amount must be greater than 0")
            rows.append({
                "asset_type": (change.asset_type or "STOCK").upper(),
                "name": change.name.strip() or (change.symbol or "Scenario holding").strip(),
                "symbol": (change.symbol or "").strip().upper(),
                "invested_amount": amount,
                "_id": None,
            })
        elif action in {"remove", "reduce"}:
            target = None
            if change.holding_id is not None:
                target = next((r for r in rows if r.get("_id") == change.holding_id), None)
            if target is None and change.symbol:
                symbol = change.symbol.strip().upper()
                target = next((r for r in rows if (r.get("symbol") or "").upper() == symbol), None)
            if target is None:
                raise HTTPException(status_code=400, detail="Scenario holding was not found")
            if action == "remove":
                target["invested_amount"] = 0
            else:
                if amount <= 0:
                    raise HTTPException(status_code=400, detail="Reduction amount must be greater than 0")
                target["invested_amount"] = max(0, float(target["invested_amount"]) - amount)
        else:
            raise HTTPException(status_code=400, detail="Unsupported scenario action")

    return [r for r in rows if float(r.get("invested_amount") or 0) > 0]


def _scenario_xray_with_direct_holding(xray, change):
    """Deprecated compatibility helper; direct scenario context is rebuilt by calculate_xray."""
    return xray


@app.post("/simulate")
def simulate_portfolio(changes: list[SimulatorChange]):
    """Run a hypothetical portfolio change entirely in memory."""
    conn = get_connection()
    base_rows = conn.execute("""
        SELECT id, asset_type, name, symbol, invested_amount
        FROM portfolio_holdings ORDER BY id ASC
    """).fetchall()
    xray_symbol_rows = conn.execute("SELECT stock_name, stock_symbol FROM xray_holdings").fetchall()
    conn.close()

    if not base_rows:
        raise HTTPException(status_code=400, detail="Add a portfolio investment before using the simulator")

    base_xray = calculate_xray()
    current_risk = calculate_risk(base_xray)
    scenario_rows = _rows_with_scenario(base_rows, changes)

    # Rebuild the entire X-Ray against the synthetic portfolio. This keeps
    # fund scaling, sector exposure, market-cap exposure and overlap consistent
    # when a fund is reduced/removed as well as when a new security is added.
    scenario_xray = calculate_xray(scenario_rows)
    scenario_risk = _calculate_risk_for_context(scenario_xray, scenario_rows, xray_symbol_rows)
    delta_risk = scenario_risk["risk_score"] - current_risk["risk_score"]
    delta_div = scenario_risk["diversification_score"] - current_risk["diversification_score"]

    return {
        "current": current_risk,
        "delta": {
            "risk_score": delta_risk,
            "diversification_score": delta_div,
            "risk_direction": "improved" if delta_risk < 0 else "worsened" if delta_risk > 0 else "unchanged",
            "diversification_direction": "improved" if delta_div > 0 else "worsened" if delta_div < 0 else "unchanged",
        },
        "scenario": scenario_risk,
        "changes": [change.model_dump() for change in changes],
        "note": "Simulation is hypothetical and does not modify your saved portfolio.",
    }

@app.get("/risk")
def get_risk():
    return calculate_risk()


@app.get("/xray")
def get_xray():
    return calculate_xray()


@app.post("/xray/holding")
def add_xray_holding(holding: XRayHoldingCreate):
    if not holding.fund_name.strip():
        raise HTTPException(status_code=400, detail="Fund name is required")
    if not holding.stock_name.strip():
        raise HTTPException(status_code=400, detail="Stock name is required")
    if holding.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    conn = get_connection()
    cursor = conn.execute("""
        INSERT INTO xray_holdings
        (fund_name, stock_name, stock_symbol, amount, sector, market_cap)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        holding.fund_name.strip(),
        holding.stock_name.strip().upper(),
        holding.stock_symbol.strip().upper(),
        holding.amount,
        get_security_metadata(holding.stock_symbol, holding.sector, holding.market_cap)[0],
        get_security_metadata(holding.stock_symbol, holding.sector, holding.market_cap)[1],
    ))
    conn.commit()
    holding_id = cursor.lastrowid
    conn.close()

    return {"message": "X-Ray holding added successfully", "id": holding_id}


# -----------------------------
# Legacy / demo X-Ray API
# -----------------------------

@app.post("/analyze")
def analyze_portfolio(portfolio: Portfolio):
    total_investment = portfolio.total_investment
    if total_investment <= 0:
        raise HTTPException(status_code=400, detail="Total investment must be greater than 0")

    portfolio_exposure = {}
    stock_funds = {}

    for fund, holdings in portfolio.funds.items():
        for stock, amount in holdings.items():
            portfolio_exposure[stock] = portfolio_exposure.get(stock, 0) + float(amount)
            stock_funds.setdefault(stock, []).append(fund)

    for stock, amount in portfolio_exposure.items():
        portfolio_exposure[stock] = round((amount / total_investment) * 100, 2)

    high_exposure = {
        stock: percentage
        for stock, percentage in portfolio_exposure.items()
        if percentage >= 10
    }

    overlapping_stocks = {
        stock: funds
        for stock, funds in stock_funds.items()
        if len(funds) > 1
    }

    return {
        "total_investment": total_investment,
        "number_of_funds": len(portfolio.funds),
        "stock_exposure": portfolio_exposure,
        "high_concentration": high_exposure,
        "overlapping_stocks": overlapping_stocks,
    }


# -----------------------------
# Real Portfolio API
# -----------------------------

@app.get("/portfolio")
def get_portfolio():
    conn = get_connection()
    rows = conn.execute("""
        SELECT id, asset_type, name, symbol, units,
               buy_price, invested_amount, buy_date
        FROM portfolio_holdings
        ORDER BY id DESC
    """).fetchall()
    conn.close()

    holdings = [dict(row) for row in rows]
    total_invested = round(
        sum(float(item["invested_amount"] or 0) for item in holdings), 2
    )

    return {
        "holdings": holdings,
        "total_invested": total_invested,
        "count": len(holdings),
    }


@app.post("/portfolio")
def add_investment(investment: InvestmentCreate):
    if investment.asset_type not in {"STOCK", "MUTUAL_FUND", "ETF"}:
        raise HTTPException(
            status_code=400,
            detail="asset_type must be STOCK, MUTUAL_FUND or ETF",
        )
    if not investment.name.strip():
        raise HTTPException(status_code=400, detail="Investment name is required")
    if investment.invested_amount <= 0:
        raise HTTPException(status_code=400, detail="Invested amount must be greater than 0")
    if investment.units < 0 or investment.buy_price < 0:
        raise HTTPException(status_code=400, detail="Units and buy price cannot be negative")

    conn = get_connection()
    cursor = conn.execute("""
        INSERT INTO portfolio_holdings
        (asset_type, name, symbol, units, buy_price, invested_amount, buy_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        investment.asset_type,
        investment.name.strip(),
        investment.symbol.strip().upper() if investment.symbol else None,
        investment.units,
        investment.buy_price,
        investment.invested_amount,
        investment.buy_date,
    ))
    conn.commit()
    holding_id = cursor.lastrowid
    conn.close()

    return {"message": "Investment added successfully", "id": holding_id}


@app.put("/portfolio/{holding_id}")
def update_investment(holding_id: int, investment: InvestmentCreate):
    conn = get_connection()
    existing = conn.execute(
        "SELECT id FROM portfolio_holdings WHERE id = ?",
        (holding_id,),
    ).fetchone()

    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Investment not found")

    conn.execute("""
        UPDATE portfolio_holdings
        SET asset_type = ?, name = ?, symbol = ?, units = ?,
            buy_price = ?, invested_amount = ?, buy_date = ?
        WHERE id = ?
    """, (
        investment.asset_type,
        investment.name.strip(),
        investment.symbol.strip().upper() if investment.symbol else None,
        investment.units,
        investment.buy_price,
        investment.invested_amount,
        investment.buy_date,
        holding_id,
    ))
    conn.commit()
    conn.close()

    return {"message": "Investment updated successfully"}


@app.delete("/portfolio/{holding_id}")
def delete_investment(holding_id: int):
    conn = get_connection()
    cursor = conn.execute(
        "DELETE FROM portfolio_holdings WHERE id = ?",
        (holding_id,),
    )
    conn.commit()
    deleted = cursor.rowcount
    conn.close()

    if deleted == 0:
        raise HTTPException(status_code=404, detail="Investment not found")

    return {"message": "Investment deleted successfully"}


# -----------------------------
# Phase 3: Portfolio Valuation Engine
# -----------------------------

def calculate_portfolio_valuation():
    """Calculate current portfolio value and P&L from market prices."""
    conn = get_connection()
    rows = conn.execute("""
        SELECT id, asset_type, name, symbol, units,
               buy_price, invested_amount, buy_date
        FROM portfolio_holdings
        ORDER BY id DESC
    """).fetchall()
    conn.close()

    holdings = []
    total_invested = 0.0
    total_current = 0.0
    total_previous = 0.0
    valued_invested = 0.0
    valuation_unavailable = []

    for row in rows:
        item = dict(row)
        invested = float(item.get("invested_amount") or 0)
        units = float(item.get("units") or 0)
        buy_price = float(item.get("buy_price") or 0)
        symbol = (item.get("symbol") or "").strip().upper()

        total_invested += invested
        item["current_price"] = None
        item["previous_close"] = None
        item["current_value"] = None
        item["previous_value"] = None
        item["day_pnl"] = None
        item["overall_pnl"] = None
        item["pnl_percent"] = None
        item["valuation_status"] = "UNAVAILABLE"

        # Stocks and ETFs can be valued from the market feed.
        if item["asset_type"] in {"STOCK", "ETF"} and symbol and units > 0:
            try:
                quote = yahoo_quote(normalize_stock_symbol(symbol))
                current_price = quote.get("price")
                previous_close = quote.get("previous_close")

                if current_price is not None:
                    current_value = units * float(current_price)
                    previous_value = (
                        units * float(previous_close)
                        if previous_close is not None
                        else current_value
                    )
                    overall_pnl = current_value - invested
                    day_pnl = current_value - previous_value

                    item["current_price"] = round(float(current_price), 2)
                    item["previous_close"] = (
                        round(float(previous_close), 2)
                        if previous_close is not None else None
                    )
                    item["current_value"] = round(current_value, 2)
                    item["previous_value"] = round(previous_value, 2)
                    item["day_pnl"] = round(day_pnl, 2)
                    item["overall_pnl"] = round(overall_pnl, 2)
                    item["pnl_percent"] = round(
                        (overall_pnl / invested) * 100, 2
                    ) if invested > 0 else 0
                    item["valuation_status"] = "VALUED"

                    total_current += current_value
                    total_previous += previous_value
                    valued_invested += invested
                    holdings.append(item)
                    continue
            except Exception as exc:
                item["valuation_error"] = str(exc)

        # Mutual-fund NAV support comes in the next market-data enhancement.
        valuation_unavailable.append(item["name"])
        holdings.append(item)

    total_invested = round(total_invested, 2)
    total_current = round(total_current, 2)
    total_previous = round(total_previous, 2)
    overall_pnl = round(total_current - valued_invested, 2)
    day_pnl = round(total_current - total_previous, 2)
    pnl_percent = round((overall_pnl / valued_invested) * 100, 2) if valued_invested > 0 else 0
    day_pnl_percent = round((day_pnl / total_previous) * 100, 2) if total_previous > 0 else 0
    coverage = round((valued_invested / total_invested) * 100, 2) if total_invested > 0 else 0

    # Store a daily snapshot when at least one holding is valued.
    if total_current > 0:
        today = datetime.now(timezone.utc).date().isoformat()
        conn = get_connection()
        conn.execute("""
            INSERT INTO portfolio_valuation_snapshots
            (snapshot_date, invested_value, current_value, day_pnl, overall_pnl)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(snapshot_date) DO UPDATE SET
                invested_value = excluded.invested_value,
                current_value = excluded.current_value,
                day_pnl = excluded.day_pnl,
                overall_pnl = excluded.overall_pnl
        """, (today, total_invested, total_current, day_pnl, overall_pnl))
        conn.commit()
        conn.close()

    return {
        "invested_value": total_invested,
        "current_value": total_current,
        "previous_value": total_previous,
        "day_pnl": day_pnl,
        "day_pnl_percent": day_pnl_percent,
        "overall_pnl": overall_pnl,
        "overall_pnl_percent": pnl_percent,
        "valued_invested": round(valued_invested, 2),
        "valuation_coverage_percent": coverage,
        "valuation_unavailable": valuation_unavailable,
        "holdings": holdings,
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/portfolio/valuation")
def get_portfolio_valuation():
    return calculate_portfolio_valuation()


@app.get("/portfolio/history")
def get_portfolio_history():
    conn = get_connection()
    rows = conn.execute("""
        SELECT snapshot_date, invested_value, current_value,
               day_pnl, overall_pnl
        FROM portfolio_valuation_snapshots
        ORDER BY snapshot_date ASC
    """).fetchall()
    conn.close()
    return {"history": [dict(row) for row in rows]}


# -----------------------------
# Phase 3: Market Data
# -----------------------------

INDEXES = [
    {"name": "NIFTY 50", "symbol": "^NSEI"},
    {"name": "SENSEX", "symbol": "^BSESN"},
    {"name": "NIFTY IT", "symbol": "^CNXIT"},
]


def yahoo_quote(symbol: str):
    encoded = urllib.parse.quote(symbol, safe="")
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{encoded}"
        "?range=1d&interval=1m&includePrePost=false"
    )

    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0"},
    )

    with urllib.request.urlopen(request, timeout=8) as response:
        payload = json.loads(response.read().decode("utf-8"))

    meta = payload.get("chart", {}).get("result", [None])[0]
    if not meta:
        raise ValueError("No market data returned")

    info = meta.get("meta", {})
    price = info.get("regularMarketPrice")
    previous = info.get("previousClose") or info.get("chartPreviousClose")

    if price is None:
        price = info.get("currentTradingPeriod", {}).get("regular", {}).get("start")

    if price is None:
        raise ValueError("Market price unavailable")

    change = None
    change_percent = None
    if previous not in (None, 0):
        change = round(float(price) - float(previous), 2)
        change_percent = round((change / float(previous)) * 100, 2)

    return {
        "symbol": symbol,
        "price": round(float(price), 2),
        "previous_close": round(float(previous), 2) if previous is not None else None,
        "change": change,
        "change_percent": change_percent,
        "market_state": info.get("marketState", "UNKNOWN"),
        "currency": info.get("currency", "INR"),
    }


def normalize_stock_symbol(symbol: str):
    symbol = symbol.strip().upper()
    if not symbol:
        return None
    if symbol.startswith("^") or "." in symbol:
        return symbol
    return f"{symbol}.NS"


@app.get("/markets")
def get_markets(symbols: str = Query(default="")):
    items = []
    errors = []

    for index in INDEXES:
        try:
            quote = yahoo_quote(index["symbol"])
            items.append({
                "name": index["name"],
                "display_symbol": index["symbol"],
                "type": "INDEX",
                **quote,
            })
        except Exception as exc:
            errors.append(f"{index['name']}: {exc}")
            items.append({
                "name": index["name"],
                "display_symbol": index["symbol"],
                "type": "INDEX",
                "symbol": index["symbol"],
                "price": None,
                "previous_close": None,
                "change": None,
                "change_percent": None,
                "market_state": "UNAVAILABLE",
                "currency": "INR",
            })

    requested = []
    if symbols.strip():
        requested = [item.strip() for item in symbols.split(",") if item.strip()]

    seen = set()
    for raw_symbol in requested:
        yahoo_symbol = normalize_stock_symbol(raw_symbol)
        if not yahoo_symbol or yahoo_symbol in seen or yahoo_symbol.startswith("^"):
            continue
        seen.add(yahoo_symbol)

        try:
            quote = yahoo_quote(yahoo_symbol)
            items.append({
                "name": raw_symbol.upper(),
                "display_symbol": raw_symbol.upper(),
                "type": "PORTFOLIO",
                **quote,
            })
        except Exception as exc:
            errors.append(f"{raw_symbol}: {exc}")
            items.append({
                "name": raw_symbol.upper(),
                "display_symbol": raw_symbol.upper(),
                "type": "PORTFOLIO",
                "symbol": yahoo_symbol,
                "price": None,
                "previous_close": None,
                "change": None,
                "change_percent": None,
                "market_state": "UNAVAILABLE",
                "currency": "INR",
            })

    return {
        "items": items,
        "source": "Yahoo Finance market feed",
        "errors": errors,
    }


# Phase 15: historical price chart data.
# Kept backend-side so the browser never talks directly to Yahoo Finance.
MARKET_HISTORY_CACHE = {}
MARKET_HISTORY_TTL = 300


def yahoo_history(symbol: str, range_value: str, interval: str):
    cache_key = (symbol, range_value, interval)
    cached = MARKET_HISTORY_CACHE.get(cache_key)
    now = time.time()
    if cached and now - cached["timestamp"] < MARKET_HISTORY_TTL:
        return cached["data"]

    encoded = urllib.parse.quote(symbol, safe="^")
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{encoded}"
        f"?range={urllib.parse.quote(range_value)}&interval={urllib.parse.quote(interval)}"
        "&events=history&includeAdjustedClose=true"
    )
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})

    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Historical market data unavailable: {exc}")

    result = payload.get("chart", {}).get("result") or []
    if not result:
        raise HTTPException(status_code=404, detail="No historical data found for this symbol")

    chart = result[0]
    timestamps = chart.get("timestamp") or []
    quote = (chart.get("indicators", {}).get("quote") or [{}])[0]
    closes = quote.get("close") or []
    opens = quote.get("open") or []
    highs = quote.get("high") or []
    lows = quote.get("low") or []
    volumes = quote.get("volume") or []

    points = []
    for index, ts in enumerate(timestamps):
        close = closes[index] if index < len(closes) else None
        if close is None:
            continue
        point = {
            "timestamp": int(ts),
            "close": round(float(close), 2),
            "open": round(float(opens[index]), 2) if index < len(opens) and opens[index] is not None else None,
            "high": round(float(highs[index]), 2) if index < len(highs) and highs[index] is not None else None,
            "low": round(float(lows[index]), 2) if index < len(lows) and lows[index] is not None else None,
            "volume": int(volumes[index]) if index < len(volumes) and volumes[index] is not None else None,
        }
        points.append(point)

    if not points:
        raise HTTPException(status_code=404, detail="No usable historical prices found for this symbol")

    meta = chart.get("meta", {})
    data = {
        "symbol": symbol,
        "currency": meta.get("currency", "INR"),
        "exchange": meta.get("exchangeName", ""),
        "range": range_value,
        "interval": interval,
        "points": points,
        "source": "Yahoo Finance historical market feed",
    }
    MARKET_HISTORY_CACHE[cache_key] = {"timestamp": now, "data": data}
    return data


@app.get("/markets/history")
def get_market_history(
    symbol: str = Query(min_length=1, max_length=30),
    range: str = Query(default="1y"),
):
    requested = symbol.strip().upper()
    if not requested:
        raise HTTPException(status_code=400, detail="Symbol is required")

    range_map = {
        "1d": ("1d", "5m"),
        "1w": ("5d", "15m"),
        "1m": ("1mo", "1d"),
        "1y": ("1y", "1d"),
        "5y": ("5y", "1wk"),
    }
    if range not in range_map:
        raise HTTPException(status_code=400, detail="Range must be one of 1d, 1w, 1m, 1y, 5y")

    yahoo_symbol = requested if requested.startswith("^") else normalize_stock_symbol(requested)
    return yahoo_history(yahoo_symbol, *range_map[range])


@app.get("/markets/search")
def search_markets(q: str = Query(min_length=1, max_length=50)):
    query = urllib.parse.quote(q.strip())
    url = f"https://query1.finance.yahoo.com/v1/finance/search?q={query}&quotesCount=8&newsCount=0"
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})

    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Market search unavailable: {exc}")

    results = []
    for quote in payload.get("quotes", []):
        symbol = quote.get("symbol", "")
        quote_type = quote.get("quoteType", "")
        if not symbol:
            continue
        results.append({
            "symbol": symbol,
            "name": quote.get("shortname") or quote.get("longname") or symbol,
            "exchange": quote.get("exchange", ""),
            "type": quote_type,
        })

    return {"query": q, "results": results}


# -----------------------------
# Phase 9: Professional Alert Engine
# -----------------------------

from datetime import datetime, timezone


def _alert_severity(score):
    if score >= 80:
        return "High"
    if score >= 55:
        return "Medium"
    return "Low"


def _append_alert(alerts, seen, alert_id, alert_type, severity, title, description, **extra):
    """Add a single deduplicated alert with consistent metadata."""
    if alert_id in seen:
        return
    seen.add(alert_id)
    alerts.append({
        "id": alert_id,
        "type": alert_type,
        "severity": severity,
        "title": title,
        "description": description,
        **extra,
    })



# -----------------------------
# Phase 10: News Intelligence
# -----------------------------

NEWS_CACHE = {"timestamp": None, "key": None, "items": []}
NEWS_CACHE_TTL_SECONDS = 300


def _clean_html(text):
    if not text:
        return ""
    import re
    return re.sub(r"<[^>]+>", " ", text).replace("&amp;", "&").replace("&#39;", "'").strip()


def _news_impact(title, summary=""):
    text = f"{title} {summary}".lower()
    positive = ["profit", "growth", "surge", "wins", "order", "contract", "expands", "investment", "approval", "upgrade", "record", "strong", "rises", "buyback", "dividend"]
    negative = ["loss", "fall", "falls", "drop", "crash", "downgrade", "probe", "penalty", "fraud", "delay", "cut", "warning", "weak", "debt", "lawsuit", "resign", "decline"]
    pos = sum(1 for w in positive if w in text)
    neg = sum(1 for w in negative if w in text)
    if pos > neg and pos:
        return "Positive"
    if neg > pos and neg:
        return "Negative"
    return "Neutral"


def _news_relevance(title, summary, company_terms):
    text = f"{title} {summary}".lower()
    matches = [term for term in company_terms if term and term.lower() in text]
    return min(100, 45 + len(matches) * 20), matches


def _parse_google_news(query, limit=12):
    encoded = urllib.parse.quote(query)
    url = f"https://news.google.com/rss/search?q={encoded}&hl=en-IN&gl=IN&ceid=IN:en"
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 InShield/1.0"})
    with urllib.request.urlopen(request, timeout=10) as response:
        raw = response.read()
    root = ET.fromstring(raw)
    items = []
    for item in root.findall('./channel/item')[:limit]:
        title = (item.findtext('title') or '').strip()
        link = (item.findtext('link') or '').strip()
        pub = (item.findtext('pubDate') or '').strip()
        desc = _clean_html(item.findtext('description') or '')
        source_node = item.find('source')
        source = (source_node.text or '').strip() if source_node is not None else 'News'
        items.append({"title": title, "url": link, "published": pub, "summary": desc[:320], "source": source})
    return items


def _portfolio_news_terms():
    conn = get_connection()
    rows = conn.execute("SELECT name, symbol, asset_type FROM portfolio_holdings ORDER BY id ASC").fetchall()
    conn.close()
    terms=[]
    for row in rows:
        name=(row['name'] or '').strip()
        symbol=(row['symbol'] or '').strip().upper()
        if name:
            terms.append({"name": name, "symbol": symbol, "asset_type": row['asset_type']})
    return terms


@app.get("/news")
def get_news(query: str = Query(default=""), limit: int = Query(default=30, ge=1, le=60)):
    """Portfolio-aware news intelligence using live RSS headlines."""
    portfolio = _portfolio_news_terms()
    requested = query.strip()
    if requested:
        searches = [requested]
    else:
        searches = []
        for item in portfolio[:8]:
            searches.append(item['symbol'] or item['name'])
        if not searches:
            searches = ["India stock market"]

    cache_key = '|'.join(searches) + f'|{limit}'
    now = datetime.now(timezone.utc)
    if NEWS_CACHE['key'] == cache_key and NEWS_CACHE['timestamp'] and (now-NEWS_CACHE['timestamp']).total_seconds() < NEWS_CACHE_TTL_SECONDS:
        return {"generated_at": NEWS_CACHE['timestamp'].isoformat(), "items": NEWS_CACHE['items'], "portfolio_companies": portfolio, "source": "Google News RSS"}

    raw=[]
    errors=[]
    for search in searches:
        try:
            raw.extend(_parse_google_news(search, min(12, limit)))
        except Exception as exc:
            errors.append({"query": search, "error": str(exc)})

    dedup={}
    for item in raw:
        key=(item.get('title') or '').lower().strip()
        if key and key not in dedup:
            dedup[key]=item

    out=[]
    for item in dedup.values():
        title=item['title']; summary=item.get('summary','')
        matched=[]
        relevance=35
        for p in portfolio:
            terms=[p['name'], p['symbol']]
            score,matches=_news_relevance(title, summary, terms)
            if matches:
                matched.append(p['name'])
                relevance=max(relevance, score)
        impact=_news_impact(title, summary)
        text=f"{title} {summary}".lower()
        if impact == 'Positive': impact_score=65
        elif impact == 'Negative': impact_score=75
        else: impact_score=45
        relevance=min(100, relevance + (10 if matched else 0))
        out.append({**item, "impact": impact, "relevance_score": relevance, "impact_score": impact_score, "portfolio_matches": sorted(set(matched)), "is_portfolio_relevant": bool(matched)})

    out.sort(key=lambda x: (x['is_portfolio_relevant'], x['relevance_score'], x['published']), reverse=True)
    out=out[:limit]
    NEWS_CACHE.update({"timestamp": now, "key": cache_key, "items": out})
    return {"generated_at": now.isoformat(), "items": out, "portfolio_companies": portfolio, "errors": errors, "source": "Google News RSS"}


# -----------------------------
# Phase 11: AI / ML Intelligence
# -----------------------------

def _safe_float(value, default=0.0):
    try:
        value = float(value)
        return value if math.isfinite(value) else default
    except Exception:
        return default


def _minmax(value, low, high):
    if high <= low:
        return 0.0
    return max(0.0, min(1.0, (value - low) / (high - low)))


def _ai_anomaly_analysis(xray):
    """Use a local Isolation Forest to flag unusual exposure patterns.

    The model is intentionally unsupervised: InShield does not claim to predict
    returns from a tiny personal portfolio. It looks for unusual concentration
    patterns relative to the portfolio's own exposure distribution.
    """
    companies = xray.get("effective_company_exposure", {}) or {}
    rows = []
    for name, item in companies.items():
        rows.append({
            "name": name,
            "portfolio_percent": _safe_float(item.get("portfolio_percent")),
            "xray_percent": _safe_float(item.get("xray_percent")),
            "fund_count": len(item.get("funds", []) or []),
        })

    if not rows:
        return {"available": False, "model": "IsolationForest", "anomalies": [], "message": "No exposure data available."}

    # With very few companies, an unsupervised forest is unstable. Use a
    # transparent concentration fallback instead of manufacturing confidence.
    if not SKLEARN_AVAILABLE or len(rows) < 5:
        anomalies = []
        for row in rows:
            if row["portfolio_percent"] >= 20:
                anomalies.append({**row, "anomaly_score": round(min(1.0, row["portfolio_percent"] / 100), 3), "reason": "Unusually high portfolio concentration"})
        return {
            "available": bool(anomalies),
            "model": "Concentration fallback" if not SKLEARN_AVAILABLE else "IsolationForest + concentration fallback",
            "sample_count": len(rows),
            "anomalies": sorted(anomalies, key=lambda x: x["portfolio_percent"], reverse=True)[:5],
            "message": "More holdings improve unsupervised anomaly detection quality." if len(rows) < 5 else "",
        }

    X = [[r["portfolio_percent"], r["xray_percent"], r["fund_count"]] for r in rows]
    contamination = min(0.25, max(0.08, 2 / len(rows)))
    model = IsolationForest(n_estimators=160, contamination=contamination, random_state=42)
    labels = model.fit_predict(X)
    raw_scores = model.decision_function(X)
    anomalies = []
    for row, label, score in zip(rows, labels, raw_scores):
        if label == -1:
            anomaly_strength = max(0.0, min(1.0, 0.5 - float(score)))
            reason = "Unusual exposure pattern relative to the rest of the portfolio"
            if row["portfolio_percent"] >= 25:
                reason = "Unusual pattern plus high portfolio concentration"
            anomalies.append({**row, "anomaly_score": round(anomaly_strength, 3), "reason": reason})

    return {
        "available": True,
        "model": "IsolationForest",
        "sample_count": len(rows),
        "anomalies": sorted(anomalies, key=lambda x: x["anomaly_score"], reverse=True)[:8],
        "message": "Unsupervised anomaly detection; it flags unusual exposure patterns, not future returns.",
    }


def _ai_news_analysis():
    """Aggregate the existing portfolio-aware news intelligence into ML-ready signals."""
    try:
        payload = get_news(limit=40)
        items = payload.get("items", [])
    except Exception:
        items = []

    relevant = [x for x in items if x.get("is_portfolio_relevant")]
    positive = sum(1 for x in relevant if x.get("impact") == "Positive")
    negative = sum(1 for x in relevant if x.get("impact") == "Negative")
    neutral = max(0, len(relevant) - positive - negative)
    total = max(1, len(relevant))
    sentiment_score = round(((positive - negative) / total) * 100, 1)
    negative_pressure = round((negative / total) * 100, 1)

    by_company = {}
    for item in relevant:
        for company in item.get("portfolio_matches", []) or []:
            entry = by_company.setdefault(company, {"positive": 0, "negative": 0, "neutral": 0, "items": 0})
            impact = str(item.get("impact", "Neutral")).lower()
            entry[impact] = entry.get(impact, 0) + 1
            entry["items"] += 1

    company_signals = []
    for company, counts in by_company.items():
        n = max(1, counts["items"])
        score = round(((counts["positive"] - counts["negative"]) / n) * 100, 1)
        company_signals.append({"company": company, "sentiment_score": score, **counts})

    company_signals.sort(key=lambda x: (x["negative"], -x["sentiment_score"]), reverse=True)
    return {
        "items_analyzed": len(items),
        "portfolio_relevant": len(relevant),
        "positive": positive,
        "negative": negative,
        "neutral": neutral,
        "sentiment_score": sentiment_score,
        "negative_pressure": negative_pressure,
        "company_signals": company_signals[:10],
        "method": "Portfolio-aware NLP signal aggregation from live news classification",
    }


def _build_ai_insights(risk, xray, alerts, news, anomalies):
    risk_score = _safe_float(risk.get("risk_score"))
    news_score = _safe_float(news.get("sentiment_score"))
    negative_pressure = _safe_float(news.get("negative_pressure"))
    anomaly_count = len(anomalies.get("anomalies", []) or [])

    # Intelligence score is a monitoring score, not a return forecast.
    risk_penalty = risk_score * 0.55
    news_penalty = negative_pressure * 0.20
    anomaly_penalty = min(20.0, anomaly_count * 5.0)
    intelligence_score = round(max(0.0, min(100.0, 100 - risk_penalty - news_penalty - anomaly_penalty)), 1)

    if intelligence_score >= 75:
        label = "Healthy"
    elif intelligence_score >= 55:
        label = "Watch"
    else:
        label = "Needs attention"

    insights = []
    recs = []
    top_company = sorted((xray.get("effective_company_exposure", {}) or {}).items(), key=lambda kv: _safe_float(kv[1].get("portfolio_percent")), reverse=True)
    if top_company and _safe_float(top_company[0][1].get("portfolio_percent")) >= 20:
        pct = _safe_float(top_company[0][1].get("portfolio_percent"))
        insights.append({"type": "concentration", "severity": "high", "title": "Single-company concentration", "detail": f"{top_company[0][0]} represents {pct:.1f}% of portfolio exposure."})
        recs.append("Review whether your largest company exposure is intentional before adding more to it.")

    if negative_pressure >= 40:
        insights.append({"type": "news", "severity": "medium", "title": "Negative news pressure", "detail": f"{negative_pressure:.1f}% of portfolio-relevant headlines are currently classified negative."})
        recs.append("Review the negative headlines and open the original sources before making changes.")
    elif news.get("portfolio_relevant", 0) == 0:
        insights.append({"type": "data", "severity": "low", "title": "Limited news coverage", "detail": "There are not enough portfolio-relevant headlines to form a strong news signal."})

    if anomaly_count:
        top_anomaly = anomalies["anomalies"][0]
        insights.append({"type": "anomaly", "severity": "medium", "title": "Unusual exposure pattern", "detail": f"{top_anomaly['name']} was flagged by the local anomaly detector."})
        recs.append("Investigate unusual exposure patterns; anomaly flags are monitoring signals, not predictions.")

    if risk_score >= 60:
        insights.append({"type": "risk", "severity": "high", "title": "Portfolio risk is elevated", "detail": f"Current InShield diversification/risk engine score is {risk_score:.0f}/100."})
        recs.append("Use the What-If Simulator to test whether reducing concentration improves the risk score.")

    if not insights:
        insights.append({"type": "positive", "severity": "low", "title": "No major AI flags", "detail": "Current concentration, risk and news signals do not show a major issue."})

    recs = list(dict.fromkeys(recs))[:5]
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "intelligence_score": intelligence_score,
        "status": label,
        "risk_score": risk_score,
        "news_sentiment_score": news_score,
        "negative_news_pressure": negative_pressure,
        "anomaly_count": anomaly_count,
        "insights": insights[:8],
        "recommendations": recs,
        "models": {
            "exposure_anomaly": anomalies.get("model"),
            "news_signal": news.get("method"),
            "risk_engine": "Explainable concentration/diversification model",
        },
        "disclaimer": "AI Intelligence is a portfolio monitoring layer. It does not predict returns or constitute investment advice.",
    }


@app.get("/ai")
def get_ai_intelligence():
    """Return the Phase 11 local AI/ML portfolio intelligence layer."""
    xray = calculate_xray()
    if xray.get("message") == "No X-Ray data available":
        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "intelligence_score": 0,
            "status": "No data",
            "risk_score": 0,
            "news_sentiment_score": 0,
            "negative_news_pressure": 0,
            "anomaly_count": 0,
            "insights": [{"type": "data", "severity": "low", "title": "Build your portfolio first", "detail": "Add holdings and X-Ray data to activate AI intelligence."}],
            "recommendations": [],
            "models": {"exposure_anomaly": "Waiting for data", "news_signal": "Waiting for data", "risk_engine": "Waiting for data"},
            "anomalies": {"available": False, "anomalies": []},
            "news": {"items_analyzed": 0, "portfolio_relevant": 0, "positive": 0, "negative": 0, "neutral": 0, "sentiment_score": 0, "negative_pressure": 0, "company_signals": []},
            "disclaimer": "AI Intelligence is a portfolio monitoring layer. It does not predict returns or constitute investment advice.",
        }

    risk = calculate_risk(xray)
    anomalies = _ai_anomaly_analysis(xray)
    news = _ai_news_analysis()
    # Reuse the professional alert engine's current state when available.
    try:
        alerts = get_alerts()
    except Exception:
        alerts = {"active_alerts": 0}
    result = _build_ai_insights(risk, xray, alerts, news, anomalies)
    result["anomalies"] = anomalies
    result["news"] = news
    result["alerts"] = {"active": alerts.get("active_alerts", 0), "high": alerts.get("summary", {}).get("high", 0)}
    return result


@app.get("/alerts")
def get_alerts():
    """
    Professional portfolio alert engine.

    Alerts are derived from the current X-Ray/risk state and live market
    quotes. Nothing is persisted: every refresh represents the current state.
    """
    generated_at = datetime.now(timezone.utc).isoformat()

    xray = calculate_xray()

    if xray.get("message") == "No X-Ray data available":
        return {
            "generated_at": generated_at,
            "risk_score": 0,
            "risk_level": "Low",
            "active_alerts": 0,
            "summary": {"high": 0, "medium": 0, "low": 0},
            "alerts": [],
            "market_signals": [],
            "health": "No X-Ray data",
            "message": "No X-Ray data available",
            "source": "InShield X-Ray + Yahoo Finance",
        }

    conn = get_connection()
    xray_rows = conn.execute("""
        SELECT stock_name, stock_symbol
        FROM xray_holdings
        ORDER BY id ASC
    """).fetchall()
    conn.close()

    # Symbol lookup for live market checks.
    stock_symbols = {}
    for row in xray_rows:
        name = (row["stock_name"] or "").strip().upper()
        symbol = (row["stock_symbol"] or "").strip().upper()
        if name and symbol:
            stock_symbols[name] = symbol

    alerts = []
    seen = set()
    market_signals = []

    # ---------------------------------------------------------
    # 1. Company concentration
    # ---------------------------------------------------------
    company_entries = sorted(
        (
            (company, float(details.get("portfolio_percent", 0) or 0), details)
            for company, details in (xray.get("effective_company_exposure", {}) or {}).items()
        ),
        key=lambda item: item[1],
        reverse=True,
    )

    # Fallback for portfolios where effective exposure is unavailable.
    if not company_entries:
        company_entries = sorted(
            (
                (company, float(pct or 0), {})
                for company, pct in (xray.get("stock_exposure", {}) or {}).items()
            ),
            key=lambda item: item[1],
            reverse=True,
        )

    for company, percentage, details in company_entries:
        if percentage < 15:
            continue

        if percentage >= 40:
            severity = "High"
            score = 90
        elif percentage >= 25:
            severity = "High"
            score = 80
        elif percentage >= 20:
            severity = "Medium"
            score = 65
        else:
            severity = "Low"
            score = 45

        _append_alert(
            alerts,
            seen,
            f"concentration-{company}",
            "CONCENTRATION",
            severity,
            f"{company} is highly concentrated",
            f"{company} represents {percentage:.2f}% of portfolio exposure.",
            company=company,
            exposure=round(percentage, 2),
            score=score,
            action="Review position sizing and single-company dependency.",
        )

    # ---------------------------------------------------------
    # 2. Sector concentration
    # ---------------------------------------------------------
    sector_entries = sorted(
        (
            (sector, float(pct or 0))
            for sector, pct in (xray.get("sector_exposure", {}) or {}).items()
        ),
        key=lambda item: item[1],
        reverse=True,
    )

    for sector, percentage in sector_entries:
        if percentage < 30:
            continue

        if percentage >= 50:
            severity = "High"
            score = 90
        elif percentage >= 40:
            severity = "High"
            score = 80
        else:
            severity = "Medium"
            score = 65

        _append_alert(
            alerts,
            seen,
            f"sector-{sector}",
            "SECTOR_CONCENTRATION",
            severity,
            f"{sector} sector concentration is elevated",
            f"{sector} accounts for {percentage:.2f}% of analyzed exposure.",
            sector=sector,
            exposure=round(percentage, 2),
            score=score,
            action="Consider whether your portfolio has enough exposure outside this sector.",
        )

    # ---------------------------------------------------------
    # 3. Market-cap concentration
    # ---------------------------------------------------------
    cap_entries = sorted(
        (
            (bucket, float(pct or 0))
            for bucket, pct in (xray.get("market_cap_exposure", {}) or {}).items()
        ),
        key=lambda item: item[1],
        reverse=True,
    )

    for bucket, percentage in cap_entries:
        if percentage < 60:
            continue

        if percentage >= 80:
            severity = "High"
            score = 85
        elif percentage >= 70:
            severity = "Medium"
            score = 65
        else:
            severity = "Low"
            score = 45

        _append_alert(
            alerts,
            seen,
            f"market-cap-{bucket}",
            "MARKET_CAP_CONCENTRATION",
            severity,
            f"{bucket} exposure dominates the portfolio",
            f"{bucket} represents {percentage:.2f}% of analyzed exposure.",
            market_cap=bucket,
            exposure=round(percentage, 2),
            score=score,
            action="Review exposure across different market-cap segments.",
        )

    # ---------------------------------------------------------
    # 4. Fund overlap
    # ---------------------------------------------------------
    overlap_entries = xray.get("fund_overlap", []) or []

    for item in overlap_entries:
        overlap_pct = float(item.get("overlap_percent", 0) or 0)
        if overlap_pct < 25:
            continue

        fund_a = item.get("fund_a") or "Fund A"
        fund_b = item.get("fund_b") or "Fund B"
        level = item.get("overlap_level") or (
            "High" if overlap_pct >= 50 else "Moderate"
        )

        if overlap_pct >= 50:
            severity = "High"
            score = 85
        elif overlap_pct >= 35:
            severity = "Medium"
            score = 65
        else:
            severity = "Low"
            score = 45

        pair_key = " vs ".join(sorted([fund_a.upper(), fund_b.upper()]))

        common_names = [
            str(item.get("stock_name") or item.get("company") or "").strip()
            for item in (item.get("common_holdings") or [])
        ]
        common_names = [name for name in common_names if name]

        _append_alert(
            alerts,
            seen,
            f"fund-overlap-{pair_key}",
            "FUND_OVERLAP",
            severity,
            f"{fund_a} and {fund_b} have significant overlap",
            f"{level} overlap of {overlap_pct:.2f}% across {item.get('common_companies', len(common_names))} common companies.",
            fund_a=fund_a,
            fund_b=fund_b,
            overlap_percent=round(overlap_pct, 2),
            common_companies=item.get("common_companies", len(common_names)),
            common_holdings=common_names[:10],
            score=score,
            action="Review whether both funds are needed for the same underlying exposure.",
        )

    # ---------------------------------------------------------
    # 5. Live market movement
    # ---------------------------------------------------------
    # Use the company basket first, because it represents actual economic
    # exposure rather than only the raw X-Ray rows.
    market_companies = [item[0] for item in company_entries[:25]]

    for stock in market_companies:
        symbol = stock_symbols.get(stock)
        if not symbol:
            continue

        try:
            quote = yahoo_quote(normalize_stock_symbol(symbol))
            change_percent = quote.get("change_percent")
            price = quote.get("price")

            signal = {
                "stock": stock,
                "symbol": symbol,
                "price": price,
                "change_percent": change_percent,
            }
            market_signals.append(signal)

            if change_percent is None:
                continue

            change_percent = float(change_percent)

            if change_percent <= -8:
                severity = "High"
                score = 90
                title = f"{stock} is under sharp market pressure"
                description = f"{stock} is down {abs(change_percent):.2f}% today."
            elif change_percent <= -5:
                severity = "High"
                score = 80
                title = f"{stock} has a significant price drop"
                description = f"{stock} is down {abs(change_percent):.2f}% today."
            elif change_percent <= -3:
                severity = "Medium"
                score = 65
                title = f"{stock} is down materially today"
                description = f"{stock} is down {abs(change_percent):.2f}% today."
            else:
                continue

            _append_alert(
                alerts,
                seen,
                f"market-movement-{stock}",
                "MARKET_MOVEMENT",
                severity,
                title,
                description,
                stock=stock,
                symbol=symbol,
                price=price,
                change_percent=round(change_percent, 2),
                score=score,
                action="Review the move in context of your position size and thesis.",
            )

        except Exception as exc:
            market_signals.append({
                "stock": stock,
                "symbol": symbol,
                "price": None,
                "change_percent": None,
                "error": str(exc),
            })

    # ---------------------------------------------------------
    # 6. Combined concentration + market downside
    # ---------------------------------------------------------
    market_map = {
        item["stock"]: item
        for item in market_signals
        if item.get("change_percent") is not None
    }

    for company, exposure, _details in company_entries:
        market = market_map.get(company)
        if not market:
            continue

        change = float(market["change_percent"])

        if exposure >= 20 and change <= -5:
            _append_alert(
                alerts,
                seen,
                f"combined-downside-{company}",
                "COMBINED_RISK",
                "High",
                f"{company} has concentrated downside risk",
                f"{company} represents {exposure:.2f}% of portfolio exposure and is down {abs(change):.2f}% today.",
                company=company,
                exposure=round(exposure, 2),
                change_percent=round(change, 2),
                score=95,
                action="Review this position first because concentration and market downside are occurring together.",
            )

    # ---------------------------------------------------------
    # 7. Portfolio-level structural risk
    # ---------------------------------------------------------
    risk_analysis = calculate_risk(xray)
    structural_score = int(risk_analysis.get("risk_score", 0) or 0)

    # Market alerts add incremental pressure, but are capped so one volatile
    # day cannot completely dominate the structural risk engine.
    high_alerts = sum(1 for a in alerts if a["severity"] == "High")
    medium_alerts = sum(1 for a in alerts if a["severity"] == "Medium")

    market_pressure = min(20, high_alerts * 5 + medium_alerts * 2)
    risk_score = min(100, structural_score + market_pressure)
    risk_level = "High" if risk_score >= 60 else "Moderate" if risk_score >= 30 else "Low"

    # Sort: highest severity, then highest score.
    severity_order = {"High": 0, "Medium": 1, "Low": 2}
    alerts.sort(
        key=lambda a: (
            severity_order.get(a.get("severity"), 3),
            -float(a.get("score", 0) or 0),
            a.get("title", ""),
        )
    )

    summary = {
        "high": sum(1 for a in alerts if a["severity"] == "High"),
        "medium": sum(1 for a in alerts if a["severity"] == "Medium"),
        "low": sum(1 for a in alerts if a["severity"] == "Low"),
    }

    if summary["high"] > 0:
        health = "Needs attention"
    elif summary["medium"] > 0:
        health = "Watch closely"
    elif summary["low"] > 0:
        health = "Generally healthy"
    else:
        health = "No active risk signals"

    return {
        "generated_at": generated_at,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "structural_risk_score": structural_score,
        "active_alerts": len(alerts),
        "summary": summary,
        "health": health,
        "alerts": alerts,
        "market_signals": market_signals,
        "risk_analysis": risk_analysis,
        "xray": xray,
        "source": "InShield X-Ray + Yahoo Finance",
    }


# -----------------------------
# Phase 12: Broker Integration
# -----------------------------

BROKER_PROVIDERS = {
    # 12.2 introduces a broker registry: every connector exposes the same
    # normalized holding schema to the rest of InShield.
    "mock": {
        "name": "InShield Sandbox",
        "description": "Safe local connector with synthetic holdings for testing the complete import workflow.",
        "live": False,
        "availability": "sandbox",
        "capabilities": ["test", "preview", "sync"],
    },
    "upstox": {
        "name": "Upstox",
        "description": "OAuth-based read-only holdings and mutual-fund portfolio connector.",
        "live": True,
        "availability": "available",
        "capabilities": ["oauth", "holdings", "mutual_funds", "test", "preview", "sync"],
    },
    "zerodha": {
        "name": "Zerodha Kite",
        "description": "Read-only Kite portfolio connector planned for the next broker adapter rollout.",
        "live": True,
        "availability": "planned",
        "capabilities": ["oauth", "holdings", "mutual_funds", "test", "preview", "sync"],
    },
    "angelone": {
        "name": "Angel One",
        "description": "SmartAPI read-only portfolio connector planned for the next broker adapter rollout.",
        "live": True,
        "availability": "planned",
        "capabilities": ["oauth", "holdings", "test", "preview", "sync"],
    },
    "groww": {
        "name": "Groww",
        "description": "Broker connector placeholder. InShield will enable it only after a supported official API flow is integrated and verified.",
        "live": True,
        "availability": "planned",
        "capabilities": ["holdings", "test", "preview", "sync"],
    },
}


def init_broker_tables():
    conn = get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS broker_connections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider TEXT NOT NULL UNIQUE,
            label TEXT,
            status TEXT NOT NULL DEFAULT 'disconnected',
            last_test_at TEXT,
            last_sync_at TEXT,
            last_sync_count INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS broker_sync_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider TEXT NOT NULL,
            mode TEXT NOT NULL,
            imported_count INTEGER NOT NULL DEFAULT 0,
            imported_value REAL NOT NULL DEFAULT 0,
            status TEXT NOT NULL,
            message TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()


init_broker_tables()


def _broker_now():
    return datetime.now(timezone.utc).isoformat()


def _broker_upsert_connection(provider, label=None, status=None, test_at=None, sync_at=None, sync_count=None):
    provider = provider.lower().strip()
    if provider not in BROKER_PROVIDERS:
        raise HTTPException(status_code=400, detail="Unsupported broker provider")
    conn = get_connection()
    existing = conn.execute("SELECT id FROM broker_connections WHERE provider = ?", (provider,)).fetchone()
    if existing:
        fields, values = [], []
        if label is not None:
            fields.append("label = ?"); values.append(label)
        if status is not None:
            fields.append("status = ?"); values.append(status)
        if test_at is not None:
            fields.append("last_test_at = ?"); values.append(test_at)
        if sync_at is not None:
            fields.append("last_sync_at = ?"); values.append(sync_at)
        if sync_count is not None:
            fields.append("last_sync_count = ?"); values.append(sync_count)
        fields.append("updated_at = CURRENT_TIMESTAMP")
        values.append(provider)
        conn.execute(f"UPDATE broker_connections SET {', '.join(fields)} WHERE provider = ?", values)
    else:
        conn.execute("""
            INSERT INTO broker_connections
            (provider, label, status, last_test_at, last_sync_at, last_sync_count)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (provider, label or BROKER_PROVIDERS[provider]["name"], status or "disconnected", test_at, sync_at, sync_count or 0))
    conn.commit()
    conn.close()


def _mock_broker_holdings():
    return [
        {"asset_type": "STOCK", "name": "Reliance Industries", "symbol": "RELIANCE", "units": 10, "buy_price": 1410.0, "invested_amount": 14100.0, "buy_date": None},
        {"asset_type": "STOCK", "name": "HDFC Bank", "symbol": "HDFCBANK", "units": 20, "buy_price": 1650.0, "invested_amount": 33000.0, "buy_date": None},
        {"asset_type": "MUTUAL_FUND", "name": "SBI Small Cap Fund - Direct Plan - Growth", "symbol": "INF200K01T51", "units": 110, "buy_price": 181.80, "invested_amount": 19998.0, "buy_date": None},
    ]


# Phase 12.2: multi-broker architecture with server-side OAuth session/token handling.
# Tokens are intentionally kept in server memory for this local development build;
# production should use encrypted secret storage and a proper user/session store.
UPSTOX_OAUTH_STATE = {}
UPSTOX_OAUTH_STATE_CREATED = {}
UPSTOX_ACCESS_TOKEN_MEMORY = {}
UPSTOX_PROFILE_MEMORY = {}


def _upstox_config():
    return {
        "client_id": os.getenv("UPSTOX_CLIENT_ID", "").strip(),
        "client_secret": os.getenv("UPSTOX_CLIENT_SECRET", "").strip(),
        "redirect_uri": os.getenv(
            "UPSTOX_REDIRECT_URI",
            "http://127.0.0.1:8000/broker/upstox/callback",
        ).strip(),
        "frontend_url": os.getenv("INSHIELD_FRONTEND_URL", "http://localhost:5173").strip(),
    }


def _upstox_runtime_token():
    user_id = CURRENT_USER_ID.get()
    return (UPSTOX_ACCESS_TOKEN_MEMORY.get(user_id, "") or os.getenv("UPSTOX_ACCESS_TOKEN", "")).strip()


def _upstox_get(path):
    token = _upstox_runtime_token()
    if not token:
        raise HTTPException(
            status_code=400,
            detail="Upstox is not connected. Use Connect Upstox to complete OAuth, or set UPSTOX_ACCESS_TOKEN for manual local testing.",
        )
    url = "https://api.upstox.com/v2" + path
    request = urllib.request.Request(url, headers={
        "Accept": "application/json",
        "Authorization": f"Bearer {token}",
    })
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        raise HTTPException(status_code=502, detail=f"Upstox API returned HTTP {exc.code}: {body[:300]}")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unable to reach Upstox: {exc}")
    if payload.get("status") not in (None, "success"):
        raise HTTPException(status_code=502, detail=f"Upstox API error: {payload}")
    return payload


def _fetch_upstox_holdings():
    equity = _upstox_get("/portfolio/long-term-holdings").get("data", []) or []
    try:
        mutual_funds = _upstox_get("/mf/holdings").get("data", []) or []
    except HTTPException:
        # Equity holdings can still be previewed if the MF endpoint is unavailable.
        mutual_funds = []

    rows = []
    for item in equity:
        quantity = float(item.get("quantity") or 0)
        average_price = float(item.get("average_price") or 0)
        if quantity <= 0:
            continue
        symbol = item.get("trading_symbol") or item.get("tradingsymbol")
        rows.append({
            "asset_type": "STOCK",
            "name": item.get("company_name") or symbol or "Unknown stock",
            "symbol": symbol,
            "units": quantity,
            "buy_price": average_price,
            "invested_amount": round(quantity * average_price, 2),
            "buy_date": None,
        })

    for item in mutual_funds:
        quantity = float(item.get("quantity") or 0)
        average_price = float(item.get("average_price") or 0)
        if quantity <= 0:
            continue
        fund = item.get("fund") or item.get("instrument_key") or "Mutual fund"
        rows.append({
            "asset_type": "MUTUAL_FUND",
            "name": fund,
            "symbol": item.get("instrument_key"),
            "units": quantity,
            "buy_price": average_price,
            "invested_amount": round(quantity * average_price, 2),
            "buy_date": None,
        })
    return rows


def _broker_fetch(provider):
    provider = provider.lower().strip()
    if provider == "mock":
        return _mock_broker_holdings()
    if provider == "upstox":
        return _fetch_upstox_holdings()
    if provider in BROKER_PROVIDERS and BROKER_PROVIDERS[provider]["availability"] == "planned":
        raise HTTPException(
            status_code=409,
            detail=f"{BROKER_PROVIDERS[provider]['name']} is registered in the multi-broker architecture but its live connector is not enabled yet."
        )
    raise HTTPException(status_code=400, detail="Unsupported broker provider")


def _broker_status(provider):
    provider = provider.lower().strip()
    if provider not in BROKER_PROVIDERS:
        raise HTTPException(status_code=400, detail="Unsupported broker provider")
    meta = BROKER_PROVIDERS[provider]

    if provider == "mock":
        return {
            "connected": True,
            "status": "sandbox",
            "availability": "sandbox",
            "message": "Sandbox connector is ready. No real broker credentials are used.",
            "capabilities": meta["capabilities"],
        }

    if provider == "upstox":
        cfg = _upstox_config()
        token_ready = bool(_upstox_runtime_token())
        oauth_ready = bool(cfg["client_id"] and cfg["client_secret"])
        if token_ready:
            status = "connected"
            message = "Upstox OAuth session is connected. Read-only portfolio access is available."
        elif oauth_ready:
            status = "ready"
            message = "Upstox OAuth is configured. Connect your account to authorize read-only access."
        else:
            status = "not_configured"
            message = "Set UPSTOX_CLIENT_ID and UPSTOX_CLIENT_SECRET on the FastAPI server before connecting."
        return {
            "connected": token_ready,
            "oauth_ready": oauth_ready,
            "status": status,
            "availability": "available",
            "message": message,
            "redirect_uri": cfg["redirect_uri"],
            "capabilities": meta["capabilities"],
        }

    if meta["availability"] == "planned":
        return {
            "connected": False,
            "status": "coming_soon",
            "availability": "planned",
            "message": f"{meta['name']} is registered, but its live read-only adapter is not enabled in this build yet.",
            "capabilities": meta["capabilities"],
        }

    return {
        "connected": False,
        "status": "unknown",
        "availability": meta["availability"],
        "message": "Connector status unavailable.",
        "capabilities": meta["capabilities"],
    }


@app.get("/broker/upstox/authorize")
def upstox_authorize():
    cfg = _upstox_config()
    user_id = _require_user()["id"]
    if not cfg["client_id"] or not cfg["client_secret"]:
        raise HTTPException(
            status_code=400,
            detail="Upstox OAuth is not configured. Set UPSTOX_CLIENT_ID and UPSTOX_CLIENT_SECRET on the FastAPI server.",
        )
    UPSTOX_OAUTH_STATE[user_id] = secrets.token_urlsafe(32)
    UPSTOX_OAUTH_STATE_CREATED[user_id] = time.time()
    params = urllib.parse.urlencode({
        "response_type": "code",
        "client_id": cfg["client_id"],
        "redirect_uri": cfg["redirect_uri"],
        "state": UPSTOX_OAUTH_STATE[user_id],
    })
    return {
        "authorization_url": "https://api.upstox.com/v2/login/authorization/dialog?" + params,
        "redirect_uri": cfg["redirect_uri"],
        "message": "Open the authorization URL to sign in to Upstox. InShield never receives your Upstox password.",
    }


@app.get("/broker/upstox/callback")
def upstox_callback(code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None, error_description: Optional[str] = None):
    cfg = _upstox_config()
    user_id = _require_user()["id"]
    frontend = cfg["frontend_url"].rstrip("/")

    if error:
        message = error_description or error
        return RedirectResponse(url=frontend + "/?broker=upstox&status=error&message=" + urllib.parse.quote(message))

    if not code:
        return RedirectResponse(url=frontend + "/?broker=upstox&status=error&message=" + urllib.parse.quote("Upstox did not return an authorization code."))

    if not UPSTOX_OAUTH_STATE.get(user_id) or not state or not secrets.compare_digest(state, UPSTOX_OAUTH_STATE.get(user_id, "")):
        return RedirectResponse(url=frontend + "/?broker=upstox&status=error&message=" + urllib.parse.quote("Invalid OAuth state. Please start the Upstox connection again."))

    if time.time() - UPSTOX_OAUTH_STATE_CREATED.get(user_id, 0) > 600:
        UPSTOX_OAUTH_STATE.pop(user_id, None)
        return RedirectResponse(url=frontend + "/?broker=upstox&status=error&message=" + urllib.parse.quote("OAuth session expired. Please try again."))

    body = urllib.parse.urlencode({
        "code": code,
        "client_id": cfg["client_id"],
        "client_secret": cfg["client_secret"],
        "redirect_uri": cfg["redirect_uri"],
        "grant_type": "authorization_code",
    }).encode("utf-8")
    request = urllib.request.Request(
        "https://api.upstox.com/v2/login/authorization/token",
        data=body,
        headers={"Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        return RedirectResponse(url=frontend + "/?broker=upstox&status=error&message=" + urllib.parse.quote("Upstox token exchange failed: " + detail[:180]))
    except Exception as exc:
        return RedirectResponse(url=frontend + "/?broker=upstox&status=error&message=" + urllib.parse.quote("Unable to reach Upstox token service: " + str(exc)[:140]))

    token = (payload.get("access_token") or "").strip()
    if not token:
        return RedirectResponse(url=frontend + "/?broker=upstox&status=error&message=" + urllib.parse.quote("Upstox did not return an access token."))

    UPSTOX_ACCESS_TOKEN_MEMORY[user_id] = token
    UPSTOX_PROFILE_MEMORY[user_id] = {
        "user_id": payload.get("user_id"),
        "user_name": payload.get("user_name"),
        "email": payload.get("email"),
        "broker": payload.get("broker"),
    }
    UPSTOX_OAUTH_STATE.pop(user_id, None)
    UPSTOX_OAUTH_STATE_CREATED.pop(user_id, None)
    now = _broker_now()
    _broker_upsert_connection("upstox", "Upstox", "connected", test_at=now)
    return RedirectResponse(url=frontend + "/?broker=upstox&status=connected")


@app.post("/broker/upstox/disconnect")
def upstox_disconnect():
    user_id = _require_user()["id"]
    UPSTOX_ACCESS_TOKEN_MEMORY.pop(user_id, None)
    UPSTOX_PROFILE_MEMORY.pop(user_id, None)
    UPSTOX_OAUTH_STATE.pop(user_id, None)
    UPSTOX_OAUTH_STATE_CREATED.pop(user_id, None)
    _broker_upsert_connection("upstox", "Upstox", "disconnected")
    return {"success": True, "message": "Upstox connection cleared from the local server session."}


@app.get("/broker/upstox/profile")
def upstox_profile():
    if not _upstox_runtime_token():
        raise HTTPException(status_code=400, detail="Upstox is not connected.")
    user_id = _require_user()["id"]
    return {"connected": True, "profile": UPSTOX_PROFILE_MEMORY.get(user_id, {})}


@app.get("/broker/providers")
def get_broker_providers():
    providers = []
    for key, value in BROKER_PROVIDERS.items():
        status = _broker_status(key)
        providers.append({"id": key, **value, **status})
    return {
        "providers": providers,
        "architecture": {
            "schema": "InShieldNormalizedHoldingV1",
            "read_only": True,
            "supported_now": ["mock", "upstox"],
            "planned": ["zerodha", "angelone", "groww"],
        },
    }


@app.get("/broker/summary")
def get_broker_summary():
    statuses = [_broker_status(key) for key in BROKER_PROVIDERS]
    return {
        "total_connectors": len(BROKER_PROVIDERS),
        "available": sum(1 for s in statuses if s.get("availability") == "available"),
        "sandbox": sum(1 for s in statuses if s.get("availability") == "sandbox"),
        "planned": sum(1 for s in statuses if s.get("availability") == "planned"),
        "connected": sum(1 for s in statuses if s.get("connected")),
        "normalized_schema": "InShieldNormalizedHoldingV1",
        "read_only": True,
    }


@app.get("/broker/connections")
def get_broker_connections():
    conn = get_connection()
    rows = conn.execute("""
        SELECT provider, label, status, last_test_at, last_sync_at, last_sync_count
        FROM broker_connections ORDER BY provider
    """).fetchall()
    conn.close()
    saved = {row["provider"]: dict(row) for row in rows}
    result = []
    for provider, meta in BROKER_PROVIDERS.items():
        result.append({
            "provider": provider,
            "name": meta["name"],
            "description": meta["description"],
            "live": meta["live"],
            "runtime": _broker_status(provider),
            "connection": saved.get(provider),
        })
    return {"connections": result}


@app.post("/broker/connect")
def connect_broker(request: BrokerConnectRequest):
    provider = request.provider.lower().strip()
    if provider not in BROKER_PROVIDERS:
        raise HTTPException(status_code=400, detail="Unsupported broker provider")
    status = _broker_status(provider)
    if status.get("availability") == "planned":
        raise HTTPException(status_code=409, detail=status["message"])
    _broker_upsert_connection(
        provider,
        request.label or BROKER_PROVIDERS[provider]["name"],
        "connected" if status["connected"] else "pending",
    )
    return {"message": "Broker connector saved", "provider": provider, "runtime": status}


@app.post("/broker/test")
def test_broker(request: BrokerConnectRequest):
    provider = request.provider.lower().strip()
    rows = _broker_fetch(provider)
    now = _broker_now()
    _broker_upsert_connection(provider, request.label or BROKER_PROVIDERS[provider]["name"], "connected", test_at=now)
    return {
        "provider": provider,
        "success": True,
        "tested_at": now,
        "holding_count": len(rows),
        "invested_value": round(sum(float(row["invested_amount"]) for row in rows), 2),
        "message": "Connector test succeeded. No portfolio data was changed.",
    }


@app.get("/broker/preview")
def broker_preview(provider: str = Query("mock")):
    provider = provider.lower().strip()
    rows = _broker_fetch(provider)
    total = round(sum(float(row["invested_amount"]) for row in rows), 2)
    by_type = {}
    for row in rows:
        by_type[row["asset_type"]] = by_type.get(row["asset_type"], 0) + 1
    return {
        "provider": provider,
        "generated_at": _broker_now(),
        "holdings": rows,
        "count": len(rows),
        "invested_value": total,
        "by_asset_type": by_type,
        "safe_to_import": True,
        "message": "Preview only. Your saved portfolio has not been changed.",
    }


@app.post("/broker/sync")
def broker_sync(request: BrokerSyncRequest):
    provider = request.provider.lower().strip()
    mode = request.mode.lower().strip()
    if mode not in {"replace", "merge"}:
        raise HTTPException(status_code=400, detail="mode must be replace or merge")
    rows = _broker_fetch(provider)
    if not request.confirm:
        return {
            "requires_confirmation": True,
            "provider": provider,
            "mode": mode,
            "count": len(rows),
            "invested_value": round(sum(float(row["invested_amount"]) for row in rows), 2),
            "message": "Set confirm=true after reviewing the preview. No data was changed.",
        }

    conn = get_connection()
    if mode == "replace":
        conn.execute("DELETE FROM portfolio_holdings")
    imported = 0
    total = 0.0
    for row in rows:
        conn.execute("""
            INSERT INTO portfolio_holdings
            (asset_type, name, symbol, units, buy_price, invested_amount, buy_date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            row["asset_type"], row["name"], row.get("symbol"), row.get("units", 0),
            row.get("buy_price", 0), row["invested_amount"], row.get("buy_date")
        ))
        imported += 1
        total += float(row["invested_amount"])
    conn.commit()
    conn.close()

    now = _broker_now()
    _broker_upsert_connection(provider, status="connected", sync_at=now, sync_count=imported)
    conn = get_connection()
    conn.execute("""
        INSERT INTO broker_sync_log (provider, mode, imported_count, imported_value, status, message)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (provider, mode, imported, total, "success", "Portfolio synchronized from broker connector."))
    conn.commit()
    conn.close()

    return {
        "success": True,
        "provider": provider,
        "mode": mode,
        "imported_count": imported,
        "imported_value": round(total, 2),
        "synced_at": now,
        "message": "Portfolio synchronized successfully. Re-run X-Ray, risk and AI analysis to refresh derived intelligence.",
    }


@app.get("/broker/sync-history")
def broker_sync_history(limit: int = Query(10, ge=1, le=50)):
    conn = get_connection()
    rows = conn.execute("""
        SELECT provider, mode, imported_count, imported_value, status, message, created_at
        FROM broker_sync_log ORDER BY id DESC LIMIT ?
    """, (limit,)).fetchall()
    conn.close()
    return {"history": [dict(row) for row in rows]}
