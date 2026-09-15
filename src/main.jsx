import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Clock3,
  ExternalLink,
  Eye,
  FileText,
  Flag,
  Globe2,
  Heart,
  LayoutDashboard,
  LogIn,
  LogOut,
  Mail,
  Menu,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Store,
  Tags,
  Trash2,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import logoDark from "./assets/brand/logo-dark.svg";
import logoLight from "./assets/brand/logo-light.svg";
import "./styles.css";

const DEALS_KEY = "promo-code-demo-deals";
const ACCOUNTS_KEY = "promo-code-demo-accounts";
const SESSION_KEY = "promo-code-demo-session";
const ADMIN_SESSION_KEY = "promo-code-admin-session";
const ADMIN_LOGS_KEY = "promo-code-admin-logs";
const ADMIN_SETTINGS_KEY = "promo-code-admin-settings";
const USER_ACCOUNTS_KEY = "promo-code-user-accounts";
const USER_SESSION_KEY = "promo-code-user-session";
const USER_REPORTS_KEY = "promo-code-user-reports";
const WEBSITE_FILTER_KEY = "promo-code-admin-website-filter";
const PUBLIC_DEALS_BATCH_SIZE = 20;
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://localhost:8000" : "")
).replace(/\/$/, "");
const DEMO_ADMIN_EMAIL = "admin@promo-code.local";
const DEMO_MERCHANT_ACCOUNT = {
  id: "demo-merchant",
  email: "demo@promo-code.local",
  password: "demo123456",
  storeName: "测试商户",
  website: "https://example.com",
  emailVerified: true,
  status: "active",
  adminStatus: "normal",
  createdAt: "2026-09-01",
};

const DEMO_DEALS = [
  {
    id: "demo-1",
    storeName: "墨点笔记",
    website: "https://www.notion.so",
    code: "MO20",
    offer: "年度套餐 8 折",
    dealType: "percentage",
    discountValue: "20",
    terms: "新用户可用",
    endAt: "2026-10-31",
    status: "published",
    createdAt: "2026-09-10",
    ownerEmail: "demo@promo-code.local",
  },
  {
    id: "demo-2",
    storeName: "画布设计",
    website: "https://www.canva.com",
    code: "CREATE15",
    offer: "全站订单立减 15 美元",
    dealType: "fixed_amount",
    discountValue: "15",
    terms: "订单满 80 美元可用",
    endAt: "2026-11-15",
    status: "published",
    createdAt: "2026-09-08",
    ownerEmail: "demo@promo-code.local",
  },
  {
    id: "demo-3",
    storeName: "云端办公",
    website: "https://www.dropbox.com",
    code: "CLOUD25",
    offer: "专业版首年 75 折",
    dealType: "percentage",
    discountValue: "25",
    terms: "仅限新订阅用户",
    endAt: "2026-10-08",
    status: "published",
    createdAt: "2026-09-07",
    ownerEmail: "demo@promo-code.local",
  },
  {
    id: "demo-4",
    storeName: "专注写作",
    website: "https://www.grammarly.com",
    code: "WRITE30",
    offer: "高级版 7 折",
    dealType: "percentage",
    discountValue: "30",
    terms: "新用户首月可用",
    endAt: "",
    status: "published",
    createdAt: "2026-09-05",
    ownerEmail: "demo@promo-code.local",
  },
  {
    id: "demo-5",
    storeName: "灵感图库",
    website: "https://unsplash.com",
    code: "PHOTO10",
    offer: "素材订阅立减 10 美元",
    dealType: "fixed_amount",
    discountValue: "10",
    terms: "首个结算周期可用",
    endAt: "2026-12-01",
    status: "published",
    createdAt: "2026-09-03",
    ownerEmail: "demo@promo-code.local",
  },
  {
    id: "demo-6",
    storeName: "团队协作",
    website: "https://slack.com",
    code: "TEAM20",
    offer: "团队方案 8 折",
    dealType: "percentage",
    discountValue: "20",
    terms: "新建付费工作区可用",
    endAt: "2026-09-30",
    status: "published",
    createdAt: "2026-08-30",
    ownerEmail: "demo@promo-code.local",
  },
  {
    id: "demo-7",
    storeName: "轻量项目",
    website: "https://linear.app",
    code: "LINEAR15",
    offer: "年度计划立减 15 美元",
    dealType: "fixed_amount",
    discountValue: "15",
    terms: "仅限年度计划",
    endAt: "2026-10-20",
    status: "published",
    createdAt: "2026-08-28",
    ownerEmail: "demo@promo-code.local",
  },
  {
    id: "demo-8",
    storeName: "设计协作",
    website: "https://www.figma.com",
    code: "FIGMA10",
    offer: "专业版 9 折",
    dealType: "percentage",
    discountValue: "10",
    terms: "新团队可用",
    endAt: "2026-11-30",
    status: "published",
    createdAt: "2026-08-24",
    ownerEmail: "demo@promo-code.local",
  },
];

function readStorage(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function getDeals() {
  return readStorage(DEALS_KEY, DEMO_DEALS);
}

function getAccounts() {
  const storedAccounts = readStorage(ACCOUNTS_KEY, []);
  const accounts = Array.isArray(storedAccounts) ? storedAccounts : [];
  return accounts.some((account) => account.email === DEMO_MERCHANT_ACCOUNT.email)
    ? accounts
    : [DEMO_MERCHANT_ACCOUNT, ...accounts];
}

function getSession() {
  return readStorage(SESSION_KEY, null);
}

function getUserAccounts() {
  const accounts = readStorage(USER_ACCOUNTS_KEY, []);
  return Array.isArray(accounts) ? accounts : [];
}

function getUserSession() {
  return readStorage(USER_SESSION_KEY, null);
}

function getUserReports() {
  const reports = readStorage(USER_REPORTS_KEY, []);
  return Array.isArray(reports) ? reports : [];
}

function getAdminSession() {
  return readStorage(ADMIN_SESSION_KEY, null);
}

function getAdminLogs() {
  return readStorage(ADMIN_LOGS_KEY, []);
}

function getAdminSettings() {
  return readStorage(ADMIN_SETTINGS_KEY, {
    allowMerchantRegistration: true,
    siteStatus: "正常运行",
  });
}

function getWebsiteBlacklist() {
  const storedRules = readStorage(WEBSITE_FILTER_KEY, []);
  return Array.isArray(storedRules) ? storedRules : [];
}

function normalizeWebsiteHostname(value) {
  const input = String(value || "").trim();
  if (!input) return "";

  try {
    const parsed = new URL(input.includes("://") ? input : `https://${input}`);
    if (!parsed.hostname || !/^[a-z0-9.-]+$/i.test(parsed.hostname)) return "";
    return parsed.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  } catch {
    return "";
  }
}

function getWebsiteRuleLabel(rule) {
  if (rule.matchType === "keyword" || (!rule.hostname && rule.keyword)) {
    return `敏感词：${rule.keyword}`;
  }
  return rule.hostname || "未命名规则";
}

function findWebsiteBlacklistMatch(website) {
  const normalizedWebsite = String(website || "").trim().toLowerCase();
  const hostname = normalizeWebsiteHostname(website);
  if (!normalizedWebsite && !hostname) return null;

  return getWebsiteBlacklist().find((rule) => {
    if (rule.status === "disabled") return false;
    if (rule.matchType === "keyword" || (!rule.hostname && rule.keyword)) {
      const keyword = String(rule.keyword || "").trim().toLowerCase();
      return Boolean(keyword && normalizedWebsite.includes(keyword));
    }
    if (!hostname || !rule.hostname) return false;
    return hostname === rule.hostname || hostname.endsWith(`.${rule.hostname}`);
  }) || null;
}

function isWebsiteBlacklisted(website) {
  return Boolean(findWebsiteBlacklistMatch(website));
}

async function adminApiRequest(path, options = {}) {
  const adminSession = getAdminSession();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(adminSession?.token ? { Authorization: `Bearer ${adminSession.token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `接口请求失败（${response.status}）`);
  }

  return data;
}

const DEFAULT_MAIL_SETTINGS = {
  fromAddress: "",
  contentFormat: "multipart",
  driver: "smtp",
  smtpHost: "",
  smtpPort: "587",
  smtpEncryption: "tls",
  smtpUsername: "",
  smtpPassword: "",
  smtpVerifySsl: true,
  testRecipient: "",
};

function normalizeMailSettings(settings = {}) {
  settings = settings || {};
  const smtp = settings.smtp || {};

  return {
    fromAddress:
      settings.fromAddress ||
      settings.from_address ||
      settings.mailFromAddress ||
      DEFAULT_MAIL_SETTINGS.fromAddress,
    contentFormat:
      settings.contentFormat ||
      settings.content_format ||
      DEFAULT_MAIL_SETTINGS.contentFormat,
    driver:
      settings.driver ||
      settings.mailer ||
      settings.transport ||
      DEFAULT_MAIL_SETTINGS.driver,
    smtpHost: settings.smtpHost || settings.smtp_host || smtp.host || "",
    smtpPort: String(settings.smtpPort || settings.smtp_port || smtp.port || "587"),
    smtpEncryption:
      settings.smtpEncryption ||
      settings.smtp_encryption ||
      smtp.encryption ||
      "",
    smtpUsername:
      settings.smtpUsername ||
      settings.smtp_username ||
      smtp.username ||
      "",
    smtpPassword: "",
    smtpVerifySsl:
      settings.smtpVerifySsl ??
      settings.smtp_verify_ssl ??
      smtp.verifySsl ??
      smtp.verify_ssl ??
      true,
    testRecipient:
      settings.testRecipient ||
      settings.test_recipient ||
      DEFAULT_MAIL_SETTINGS.testRecipient,
  };
}

function buildMailSettingsPayload(form) {
  const smtp = {
    host: form.smtpHost.trim(),
    port: Number(form.smtpPort),
    encryption: form.smtpEncryption || null,
    username: form.smtpUsername.trim(),
    verifySsl: form.smtpVerifySsl,
  };

  if (form.smtpPassword) {
    smtp.password = form.smtpPassword;
  }

  return {
    fromAddress: form.fromAddress.trim(),
    contentFormat: form.contentFormat,
    driver: form.driver,
    smtp,
    testRecipient: form.testRecipient.trim() || null,
  };
}

function writeAuditLog({ action, targetType, targetId, description }) {
  const nextLog = {
    id: makeId("audit"),
    adminEmail: DEMO_ADMIN_EMAIL,
    action,
    targetType,
    targetId,
    description,
    createdAt: new Date().toISOString(),
  };
  writeStorage(ADMIN_LOGS_KEY, [nextLog, ...getAdminLogs()].slice(0, 200));
}

function getDealAdminStatus(deal) {
  if (deal.adminStatus === "removed") return "removed";
  if (deal.status === "paused") return "paused";
  if (deal.endAt && daysUntil(deal.endAt) < 0) return "expired";
  return "published";
}

function getMerchantAdminStatus(account) {
  if (account.adminStatus === "suspended" || account.status === "suspended") {
    return "suspended";
  }
  if (!account.emailVerified || account.status === "pending_verification") {
    return "pending";
  }
  return "active";
}

function getWebsiteHostname(website) {
  try {
    return new URL(website).hostname;
  } catch {
    return website || "未填写官网";
  }
}

function formatAdminDate(value) {
  if (!value) return "暂无";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: value.includes("T") ? "2-digit" : undefined,
    minute: value.includes("T") ? "2-digit" : undefined,
  }).format(date);
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatDate(date) {
  if (!date) return "长期有效";
  const [year, month, day] = date.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

function daysUntil(date) {
  if (!date) return null;
  const today = new Date("2026-09-15T00:00:00");
  const target = new Date(`${date}T00:00:00`);
  return Math.ceil((target - today) / 86400000);
}

function isVisible(deal) {
  const now = new Date("2026-09-15T00:00:00");
  const starts = !deal.startAt || new Date(`${deal.startAt}T00:00:00`) <= now;
  const ends = !deal.endAt || new Date(`${deal.endAt}T23:59:59`) >= now;
  const owner = getAccounts().find((account) => account.email === deal.ownerEmail);
  const merchantActive =
    !owner ||
    (owner.status !== "suspended" &&
      owner.adminStatus !== "suspended" &&
      owner.emailVerified !== false);
  return (
    deal.status === "published" &&
    deal.adminStatus !== "removed" &&
    !isWebsiteBlacklisted(deal.website) &&
    (!owner || !isWebsiteBlacklisted(owner.website)) &&
    merchantActive &&
    starts &&
    ends
  );
}

function useNavigation() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = (nextPath) => {
    window.history.pushState({}, "", nextPath);
    setPath(new URL(nextPath, window.location.origin).pathname);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return { path, navigate };
}

function App() {
  const { path, navigate } = useNavigation();
  const [session, setSession] = useState(getSession);
  const [userSession, setUserSession] = useState(getUserSession);
  const [adminSession, setAdminSession] = useState(getAdminSession);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const showToast = (message, tone = "default") => setToast({ message, tone });

  const onLogin = (account) => {
    const nextSession = {
      accountId: account.id,
      email: account.email,
      storeName: account.storeName,
    };
    writeStorage(SESSION_KEY, nextSession);
    setSession(nextSession);
    navigate("/merchant/deals");
  };

  const onLogout = () => {
    window.localStorage.removeItem(SESSION_KEY);
    setSession(null);
    navigate("/");
  };

  const onUserLogin = (account) => {
    const nextSession = {
      accountId: account.id,
      email: account.email,
    };
    writeStorage(USER_SESSION_KEY, nextSession);
    setUserSession(nextSession);
    const nextPath = new URLSearchParams(window.location.search).get("next") || "/user/center";
    navigate(nextPath);
  };

  const onUserLogout = () => {
    window.localStorage.removeItem(USER_SESSION_KEY);
    setUserSession(null);
    navigate("/");
  };

  const onAdminLogin = (account) => {
    const nextSession = {
      email: account.email,
      name: account.name,
      ...(account.token ? { token: account.token } : {}),
    };
    writeStorage(ADMIN_SESSION_KEY, nextSession);
    writeAuditLog({
      action: "admin_login",
      targetType: "system",
      targetId: "admin",
      description: "管理员登录后台",
    });
    setAdminSession(nextSession);
    navigate("/admin");
  };

  const onAdminLogout = async () => {
    try {
      await adminApiRequest("/api/admin/logout", { method: "POST" });
    } catch {
      // Clear the local session even if the server session has already expired.
    }
    window.localStorage.removeItem(ADMIN_SESSION_KEY);
    setAdminSession(null);
    navigate("/admin/login");
  };

  let content;
  if (path === "/admin/login") {
    content = <AdminLogin navigate={navigate} onLogin={onAdminLogin} />;
  } else if (path === "/admin" || path.startsWith("/admin/")) {
    content = adminSession ? (
      <AdminConsole
        path={path}
        session={adminSession}
        navigate={navigate}
        onLogout={onAdminLogout}
        showToast={showToast}
      />
    ) : (
      <AdminRouteRedirect navigate={navigate} />
    );
  } else if (path === "/user/login") {
    content = <UserLogin navigate={navigate} onLogin={onUserLogin} />;
  } else if (path === "/user/register") {
    content = <UserRegister navigate={navigate} onLogin={onUserLogin} />;
  } else if (path === "/user/center") {
    content = userSession ? (
      <UserCenter
        userSession={userSession}
        navigate={navigate}
        onLogout={onUserLogout}
        showToast={showToast}
      />
    ) : (
      <UserLogin navigate={navigate} onLogin={onUserLogin} />
    );
  } else if (path === "/merchant/register") {
    content = (
      <MerchantRegister
        navigate={navigate}
        showToast={showToast}
      />
    );
  } else if (path === "/merchant/login") {
    content = (
      <MerchantLogin
        navigate={navigate}
        onLogin={onLogin}
        showToast={showToast}
      />
    );
  } else if (path === "/merchant/verify") {
    content = (
      <MerchantVerify
        navigate={navigate}
        onLogin={onLogin}
        showToast={showToast}
      />
    );
  } else if (path === "/merchant/deals") {
    content = session ? (
      <MerchantDashboard
        session={session}
        navigate={navigate}
        showToast={showToast}
      />
    ) : (
      <MerchantLogin
        navigate={navigate}
        onLogin={onLogin}
        showToast={showToast}
      />
    );
  } else {
    content = <PublicDirectory navigate={navigate} showToast={showToast} />;
  }

  const isAdminRoute = path.startsWith("/admin");

  return (
    <div className="app-shell">
      {isAdminRoute ? (
        content
      ) : (
        <>
          <SiteHeader
            path={path}
            navigate={navigate}
            userSession={userSession}
            onUserLogout={onUserLogout}
          />
          {React.cloneElement(content, {
            userSession,
          })}
          <SiteFooter />
        </>
      )}
      {toast && (
        <div className={`toast toast-${toast.tone}`} role="status">
          {toast.tone === "success" ? <Check size={16} /> : <Clipboard size={16} />}
          <span>{toast.message}</span>
          <button
            className="toast-close"
            type="button"
            aria-label="关闭提示"
            onClick={() => setToast(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

function SiteHeader({ path, navigate, userSession, onUserLogout }) {
  const isDirectoryActive = path === "/";
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    if (!userMenuOpen) return undefined;

    const handleOutsideClick = (event) => {
      if (!userMenuRef.current?.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [userMenuOpen]);

  useEffect(() => {
    setUserMenuOpen(false);
  }, [userSession]);

  const navigateToUserSection = (section) => {
    setUserMenuOpen(false);
    const target = `/user/center#${section}`;
    if (path === "/user/center") {
      window.history.pushState({}, "", target);
      window.setTimeout(() => {
        document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
      return;
    }
    navigate(target);
  };

  return (
    <header className="site-header">
      <div className="utility-bar">
        <div className="wrapper utility-inner">
          <div className="utility-actions">
            {userSession ? (
              <div className="user-menu" ref={userMenuRef}>
                <button
                  className="user-avatar-button"
                  type="button"
                  title="打开用户菜单"
                  aria-label="打开用户菜单"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  onClick={() => setUserMenuOpen((open) => !open)}
                >
                  <span>{userSession.email?.slice(0, 1).toUpperCase() || <User size={15} />}</span>
                  <ChevronDown size={12} aria-hidden="true" />
                </button>
                {userMenuOpen && (
                  <div className="user-menu-dropdown" role="menu">
                    <div className="user-menu-account">
                      <User size={15} />
                      <span>{userSession.email}</span>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate("/merchant/deals");
                      }}
                    >
                      <Store size={15} />
                      商户发布
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => navigateToUserSection("favorites")}
                    >
                      <Heart size={15} />
                      我的收藏
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => navigateToUserSection("reports")}
                    >
                      <Flag size={15} />
                      举报记录
                    </button>
                    <div className="user-menu-divider" />
                    <button
                      className="user-menu-logout"
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onUserLogout();
                      }}
                    >
                      <LogOut size={15} />
                      退出登录
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button type="button" onClick={() => navigate("/user/login")}>
                  <LogIn size={14} />
                  登录
                </button>
                <button
                  className="utility-primary"
                  type="button"
                  onClick={() => navigate("/user/register")}
                >
                  注册
                  <UserPlus size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <nav className="main-nav wrapper" aria-label="主导航">
        <button className="brand" type="button" onClick={() => navigate("/")}>
          <img className="brand-logo" src={logoLight} alt="promo-code" />
        </button>
        <div className="nav-links">
          <button
            className={`nav-link ${isDirectoryActive ? "active" : ""}`}
            type="button"
            onClick={() => navigate("/")}
          >
            优惠码
          </button>
        </div>
      </nav>
    </header>
  );
}

function PublicDirectory({ navigate, showToast, userSession }) {
  const [query, setQuery] = useState(
    () => new URLSearchParams(window.location.search).get("q") || "",
  );
  const [sort, setSort] = useState("recommended");
  const [deals, setDeals] = useState(getDeals);
  const [renderLimit, setRenderLimit] = useState(PUBLIC_DEALS_BATCH_SIZE);
  const [favoriteIds, setFavoriteIds] = useState(() => {
    const account = getUserAccounts().find((item) => item.id === userSession?.accountId);
    return account?.favoriteDealIds || [];
  });
  const [reportTarget, setReportTarget] = useState(null);
  const loadMoreRef = useRef(null);

  useEffect(() => {
    const onStorage = () => setDeals(getDeals());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const account = getUserAccounts().find((item) => item.id === userSession?.accountId);
    setFavoriteIds(account?.favoriteDealIds || []);
  }, [userSession]);

  const visibleDeals = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = deals.filter((deal) => {
      if (!isVisible(deal)) return false;
      if (!normalized) return true;
      return [deal.storeName, deal.code, deal.offer, deal.terms]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });

    return filtered.sort((a, b) => {
      if (sort === "latest") return b.createdAt.localeCompare(a.createdAt);
      if (sort === "ending") {
        if (!a.endAt) return 1;
        if (!b.endAt) return -1;
        return a.endAt.localeCompare(b.endAt);
      }
      return Number(b.discountValue) - Number(a.discountValue);
    });
  }, [deals, query, sort]);

  const renderedDeals = visibleDeals.slice(0, renderLimit);
  const hasMoreDeals = renderedDeals.length < visibleDeals.length;

  useEffect(() => {
    setRenderLimit(PUBLIC_DEALS_BATCH_SIZE);
  }, [visibleDeals]);

  useEffect(() => {
    const loadMoreTarget = loadMoreRef.current;
    if (!loadMoreTarget || !hasMoreDeals) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setRenderLimit((currentLimit) =>
          Math.min(currentLimit + PUBLIC_DEALS_BATCH_SIZE, visibleDeals.length),
        );
      },
      { rootMargin: "0px 0px 240px" },
    );

    observer.observe(loadMoreTarget);
    return () => observer.disconnect();
  }, [hasMoreDeals, visibleDeals.length]);

  const updateQuery = (value) => {
    setQuery(value);
    const params = new URLSearchParams(window.location.search);
    if (value) params.set("q", value);
    else params.delete("q");
    const next = params.toString() ? `/?${params.toString()}` : "/";
    window.history.replaceState({}, "", next);
  };

  const copyCode = async (deal) => {
    try {
      await navigator.clipboard.writeText(deal.code);
      const nextDeals = getDeals().map((item) =>
        item.id === deal.id ? { ...item, copyCount: (item.copyCount || 0) + 1 } : item,
      );
      writeStorage(DEALS_KEY, nextDeals);
      showToast(`优惠码 ${deal.code} 已复制`, "success");
    } catch {
      showToast(`复制失败，请手动复制优惠码 ${deal.code}`);
    }
  };

  const requireUser = () => {
    if (userSession) return true;
    showToast("请先登录后再使用此功能");
    navigate("/user/login?next=/");
    return false;
  };

  const toggleFavorite = (deal) => {
    if (!requireUser()) return;
    const accounts = getUserAccounts();
    const accountIndex = accounts.findIndex((item) => item.id === userSession.accountId);
    if (accountIndex < 0) {
      showToast("用户信息不存在，请重新登录");
      return;
    }
    const currentIds = accounts[accountIndex].favoriteDealIds || [];
    const isFavorite = currentIds.includes(deal.id);
    const nextIds = isFavorite
      ? currentIds.filter((id) => id !== deal.id)
      : [...currentIds, deal.id];
    accounts[accountIndex] = { ...accounts[accountIndex], favoriteDealIds: nextIds };
    writeStorage(USER_ACCOUNTS_KEY, accounts);
    setFavoriteIds(nextIds);
    showToast(isFavorite ? "已取消收藏" : "已收藏优惠码", "success");
  };

  const openReport = (deal) => {
    if (!requireUser()) return;
    setReportTarget(deal);
  };

  const submitReport = (reason) => {
    if (!reportTarget || !userSession) return;
    const reports = getUserReports();
    const alreadyReported = reports.some(
      (report) => report.dealId === reportTarget.id && report.userEmail === userSession.email,
    );
    if (alreadyReported) {
      showToast("你已经举报过这条优惠码");
      setReportTarget(null);
      return;
    }
    const nextReport = {
      id: makeId("report"),
      dealId: reportTarget.id,
      code: reportTarget.code,
      storeName: reportTarget.storeName,
      website: reportTarget.website,
      userEmail: userSession.email,
      reason,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    writeStorage(USER_REPORTS_KEY, [nextReport, ...reports]);
    writeAuditLog({
      action: "submit_report",
      targetType: "promo_code",
      targetId: reportTarget.id,
      description: `用户举报优惠码 ${reportTarget.code}`,
    });
    setReportTarget(null);
    showToast("举报已提交，我们会尽快处理", "success");
  };

  return (
    <main>
      <section className="hero-section">
        <div className="wrapper hero-inner">
          <p className="eyebrow">优惠码目录</p>
          <h1>优惠码</h1>
          <p className="hero-description">查找并使用最新的商户优惠码</p>
        </div>
      </section>

      <section className="directory-section">
        <div className="wrapper directory-inner">
          <div className="directory-toolbar">
            <label className="search-box">
              <Search size={18} aria-hidden="true" />
              <span className="sr-only">搜索商户或优惠码</span>
              <input
                value={query}
                onChange={(event) => updateQuery(event.target.value)}
                placeholder="搜索商户或优惠码"
                type="search"
              />
              {query && (
                <button
                  type="button"
                  className="clear-search"
                  aria-label="清除搜索"
                  onClick={() => updateQuery("")}
                >
                  <X size={16} />
                </button>
              )}
            </label>
            <div className="toolbar-meta">
              <span className="result-count">{visibleDeals.length} 条优惠码</span>
              <label className="sort-select">
                <span>排序</span>
                <select value={sort} onChange={(event) => setSort(event.target.value)}>
                  <option value="recommended">推荐</option>
                  <option value="latest">最新添加</option>
                  <option value="ending">即将结束</option>
                </select>
                <ChevronDown size={14} aria-hidden="true" />
              </label>
            </div>
          </div>

          <div className="table-wrap">
            <table className="deal-table">
              <thead>
                <tr>
                  <th>优惠码</th>
                  <th>商户</th>
                  <th>优惠内容</th>
                  <th>截止时间</th>
                  <th>使用限制</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
              {renderedDeals.map((deal) => (
                  <DealRow
                    key={deal.id}
                    deal={deal}
                    isFavorite={favoriteIds.includes(deal.id)}
                    onCopy={() => copyCode(deal)}
                    onFavorite={() => toggleFavorite(deal)}
                    onReport={() => openReport(deal)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {hasMoreDeals && <div ref={loadMoreRef} className="directory-load-sentinel" aria-hidden="true" />}

          {visibleDeals.length === 0 && (
            <div className="empty-state">
              <Search size={22} />
              <strong>没有找到匹配的优惠码</strong>
              <button type="button" onClick={() => updateQuery("")}>
                清除搜索
              </button>
            </div>
          )}

          <p className="directory-note">
            优惠码由商户自行发布，具体使用条件以商户官网结算页面为准。
          </p>
        </div>
      </section>
      {reportTarget && (
        <ReportDialog
          deal={reportTarget}
          onClose={() => setReportTarget(null)}
          onSubmit={submitReport}
        />
      )}
    </main>
  );
}

function getFaviconUrl(website) {
  try {
    const url = new URL(website);
    return `${url.origin}/favicon.ico`;
  } catch {
    return "";
  }
}

function FaviconAvatar({ website, fallback }) {
  const faviconUrl = getFaviconUrl(website);
  const [failed, setFailed] = useState(!faviconUrl);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(!faviconUrl);
    setLoaded(false);
  }, [faviconUrl]);

  return (
    <span className="store-avatar">
      {(!loaded || failed) && <span className="store-avatar-fallback">{fallback}</span>}
      {!failed && (
        <img
          src={faviconUrl}
          alt=""
          aria-hidden="true"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

function DealRow({ deal, isFavorite, onCopy, onFavorite, onReport }) {
  const remaining = daysUntil(deal.endAt);
  return (
    <tr>
      <td data-label="优惠码">
        <button className="code-button" type="button" onClick={onCopy}>
          <Clipboard size={14} aria-hidden="true" />
          <span>{deal.code}</span>
        </button>
      </td>
      <td data-label="商户">
        <div className="store-cell">
          <FaviconAvatar website={deal.website} fallback={deal.storeName.slice(0, 1)} />
          <div>
            <strong>{deal.storeName}</strong>
            <a
              className="store-domain"
              href={deal.website}
              target="_blank"
              rel="noreferrer"
            >
              {getWebsiteHostname(deal.website)}
            </a>
          </div>
        </div>
      </td>
      <td data-label="优惠内容">
        <div className="offer-cell">
          <strong>{deal.offer}</strong>
          <span>{deal.dealType === "percentage" ? "百分比折扣" : "固定金额折扣"}</span>
        </div>
      </td>
      <td data-label="截止时间">
        <div className="ends-cell">
          <span>{formatDate(deal.endAt)}</span>
          {remaining !== null && remaining <= 14 && remaining >= 0 && (
            <small>还有 {remaining} 天</small>
          )}
        </div>
      </td>
      <td data-label="使用限制">
        <span className="terms-cell">{deal.terms || "以商户官网规则为准"}</span>
      </td>
      <td data-label="操作">
        <div className="deal-actions">
          <button
            className={`deal-action-button ${isFavorite ? "is-active" : ""}`}
            type="button"
            title={isFavorite ? "取消收藏" : "收藏"}
            aria-label={isFavorite ? "取消收藏" : "收藏"}
            onClick={onFavorite}
          >
            <Heart size={16} fill={isFavorite ? "currentColor" : "none"} />
          </button>
          <button
            className="deal-action-button"
            type="button"
            title="举报"
            aria-label="举报"
            onClick={onReport}
          >
            <Flag size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function ReportDialog({ deal, onClose, onSubmit }) {
  const [reason, setReason] = useState("优惠码已失效");

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="report-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="report-dialog-header">
          <div>
            <span className="section-kicker">内容反馈</span>
            <h2 id="report-dialog-title">举报优惠码</h2>
          </div>
          <button className="modal-close-button" type="button" aria-label="关闭" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="report-dialog-summary">
          {deal.code} · {deal.storeName}
        </p>
        <label className="field report-reason-field">
          <span>举报原因</span>
          <select value={reason} onChange={(event) => setReason(event.target.value)}>
            <option>优惠码已失效</option>
            <option>优惠内容与实际不符</option>
            <option>官网地址无法访问</option>
            <option>其他问题</option>
          </select>
        </label>
        <div className="report-dialog-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            取消
          </button>
          <button className="primary-button" type="button" onClick={() => onSubmit(reason)}>
            提交举报
            <Flag size={15} />
          </button>
        </div>
      </section>
    </div>
  );
}

function UserLogin({ navigate, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = (event) => {
    event.preventDefault();
    const account = getUserAccounts().find(
      (item) => item.email === email.trim().toLowerCase() && item.password === password,
    );
    if (!account) {
      setError("邮箱或密码不正确");
      return;
    }
    onLogin(account);
  };

  return (
    <AuthPage
      eyebrow="用户入口"
      title="登录用户中心"
      description="登录后管理你收藏的优惠码和提交的举报。"
      navigate={navigate}
    >
      <form className="auth-form" onSubmit={submit}>
        <FormField
          label="邮箱"
          type="email"
          value={email}
          placeholder="name@example.com"
          onChange={setEmail}
        />
        <FormField
          label="密码"
          type="password"
          value={password}
          placeholder="请输入密码"
          onChange={setPassword}
        />
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button full-width" type="submit">
          登录
          <LogIn size={16} />
        </button>
        <p className="auth-switch">
          还没有账号？
          <button type="button" onClick={() => navigate("/user/register")}>
            注册
          </button>
        </p>
      </form>
    </AuthPage>
  );
}

function UserRegister({ navigate, onLogin }) {
  const [form, setForm] = useState({ email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");

  const submit = (event) => {
    event.preventDefault();
    const email = form.email.trim().toLowerCase();
    setError("");
    if (!email || !form.password || !form.confirmPassword) {
      setError("请填写完整信息");
      return;
    }
    if (form.password.length < 8) {
      setError("密码至少需要 8 位");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    const accounts = getUserAccounts();
    if (accounts.some((account) => account.email === email)) {
      setError("这个邮箱已经注册，请直接登录");
      return;
    }
    const account = {
      id: makeId("user"),
      email,
      password: form.password,
      favoriteDealIds: [],
      createdAt: new Date().toISOString(),
    };
    writeStorage(USER_ACCOUNTS_KEY, [...accounts, account]);
    onLogin(account);
  };

  return (
    <AuthPage
      eyebrow="用户入口"
      title="注册用户中心"
      description="注册后可以收藏优惠码，也可以提交失效或错误信息举报。"
      navigate={navigate}
    >
      <form className="auth-form" onSubmit={submit}>
        <FormField
          label="邮箱"
          type="email"
          value={form.email}
          placeholder="name@example.com"
          onChange={(value) => setForm({ ...form, email: value })}
        />
        <FormField
          label="密码"
          type="password"
          value={form.password}
          placeholder="至少 8 位"
          onChange={(value) => setForm({ ...form, password: value })}
        />
        <FormField
          label="确认密码"
          type="password"
          value={form.confirmPassword}
          placeholder="再次输入密码"
          onChange={(value) => setForm({ ...form, confirmPassword: value })}
        />
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button full-width" type="submit">
          注册并登录
          <UserPlus size={16} />
        </button>
        <p className="auth-switch">
          已有账号？
          <button type="button" onClick={() => navigate("/user/login")}>
            登录
          </button>
        </p>
      </form>
    </AuthPage>
  );
}

function UserCenter({ userSession, navigate, onLogout, showToast }) {
  const [version, setVersion] = useState(0);
  const account = getUserAccounts().find((item) => item.id === userSession.accountId);
  const favoriteIds = account?.favoriteDealIds || [];
  const favoriteDeals = getDeals().filter((deal) => favoriteIds.includes(deal.id));
  const reports = getUserReports().filter((report) => report.userEmail === userSession.email);
  void version;

  useEffect(() => {
    const section = window.location.hash.slice(1);
    if (!section) return undefined;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const removeFavorite = (dealId) => {
    const accounts = getUserAccounts();
    const index = accounts.findIndex((item) => item.id === userSession.accountId);
    if (index < 0) return;
    accounts[index] = {
      ...accounts[index],
      favoriteDealIds: (accounts[index].favoriteDealIds || []).filter((id) => id !== dealId),
    };
    writeStorage(USER_ACCOUNTS_KEY, accounts);
    setVersion((value) => value + 1);
    showToast("已取消收藏", "success");
  };

  return (
    <main className="user-main">
      <section className="user-topline">
        <div className="wrapper user-topline-inner">
          <div>
            <p className="eyebrow">用户中心</p>
            <h1>{userSession.email}</h1>
            <p>管理收藏的优惠码和你提交的内容举报。</p>
          </div>
          <button className="outline-button" type="button" onClick={onLogout}>
            <LogOut size={16} />
            退出登录
          </button>
        </div>
      </section>

      <section className="user-workspace wrapper">
        <div className="user-summary-grid">
          <div className="user-summary-item">
            <Heart size={18} />
            <strong>{favoriteDeals.length}</strong>
            <span>收藏优惠码</span>
          </div>
          <div className="user-summary-item">
            <Flag size={18} />
            <strong>{reports.length}</strong>
            <span>提交举报</span>
          </div>
        </div>

        <section className="user-section" id="favorites">
          <div className="section-heading compact">
            <div>
              <span className="section-kicker">我的收藏</span>
              <h2>收藏的优惠码</h2>
            </div>
            <span className="result-count">{favoriteDeals.length} 条</span>
          </div>
          {favoriteDeals.length ? (
            <div className="user-list">
              {favoriteDeals.map((deal) => (
                <div className="user-list-row" key={deal.id}>
                  <div>
                    <strong>{deal.code}</strong>
                    <span>{deal.storeName} · {deal.offer}</span>
                  </div>
                  <div className="user-row-actions">
                    <a href={deal.website} target="_blank" rel="noreferrer" title="打开商户官网">
                      <ExternalLink size={15} />
                    </a>
                    <button
                      type="button"
                      title="取消收藏"
                      aria-label="取消收藏"
                      onClick={() => removeFavorite(deal.id)}
                    >
                      <Heart size={15} fill="currentColor" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="user-empty">还没有收藏优惠码，返回目录点击心形图标即可收藏。</div>
          )}
        </section>

        <section className="user-section" id="reports">
          <div className="section-heading compact">
            <div>
              <span className="section-kicker">我的反馈</span>
              <h2>举报记录</h2>
            </div>
            <span className="result-count">{reports.length} 条</span>
          </div>
          {reports.length ? (
            <div className="user-list">
              {reports.map((report) => (
                <div className="user-list-row" key={report.id}>
                  <div>
                    <strong>{report.code} · {report.storeName}</strong>
                    <span>{report.reason} · {formatAdminDate(report.createdAt)}</span>
                  </div>
                  <span className={`user-report-status ${report.status}`}>
                    {report.status === "resolved"
                      ? "已处理"
                      : report.status === "dismissed"
                        ? "已忽略"
                        : "处理中"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="user-empty">暂无举报记录。</div>
          )}
        </section>

        <button className="back-link" type="button" onClick={() => navigate("/")}>
          <ArrowLeft size={15} />
          返回优惠码目录
        </button>
      </section>
    </main>
  );
}

function AdminRouteRedirect({ navigate }) {
  useEffect(() => {
    navigate("/admin/login");
  }, []);
  return null;
}

const ADMIN_NAV_ITEMS = [
  { path: "/admin", label: "数据概览", icon: LayoutDashboard },
  { path: "/admin/promo-codes", label: "优惠码管理", icon: Tags },
  { path: "/admin/merchants", label: "商户管理", icon: Users },
  { path: "/admin/reports", label: "举报管理", icon: Flag },
  { path: "/admin/website-filter", label: "网站过滤", icon: ShieldAlert },
  { path: "/admin/audit-logs", label: "操作日志", icon: FileText },
  { path: "/admin/mail", label: "邮件配置", icon: Mail },
  { path: "/admin/settings", label: "系统设置", icon: Settings },
];

function AdminLogin({ navigate, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await adminApiRequest("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const account = data?.admin || data?.user || data?.data || data;
      onLogin({
        email: account?.email || email.trim().toLowerCase(),
        name: account?.name || "平台管理员",
        token: account?.token || data?.token || data?.accessToken,
      });
    } catch (requestError) {
      setError(requestError.message || "管理员登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-brand-lockup">
          <img className="admin-brand-logo" src={logoDark} alt="promo-code" />
        </div>
        <span className="admin-login-kicker">管理后台</span>
        <h1>登录管理控制台</h1>
        <p>管理优惠码、商户和平台运行状态。</p>
        <form className="admin-login-form" onSubmit={submit}>
          <label className="admin-field">
            <span>管理员邮箱</span>
            <input
              type="email"
              value={email}
              placeholder="admin@promo-code.local"
              autoComplete="username"
              required
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="admin-field">
            <span>密码</span>
            <input
              type="password"
              value={password}
              placeholder="请输入密码"
              autoComplete="current-password"
              required
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && <p className="admin-form-error">{error}</p>}
          <button
            className="admin-primary-button admin-submit-button"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "登录中..." : "登录后台"}
            <LogIn size={16} />
          </button>
        </form>
        <button className="admin-back-link" type="button" onClick={() => navigate("/")}>
          <ArrowLeft size={14} />
          返回公开目录
        </button>
      </div>
    </main>
  );
}

function AdminConsole({ path, session, navigate, onLogout, showToast }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const merchantMatch = path.match(/^\/admin\/merchants\/([^/]+)$/);
  const pageMeta = getAdminPageMeta(path);

  const refresh = () => {
    setRefreshKey((value) => value + 1);
    showToast("页面数据已刷新", "success");
  };

  let page;
  if (path === "/admin") {
    page = <AdminDashboard refreshKey={refreshKey} navigate={navigate} />;
  } else if (path === "/admin/promo-codes") {
    page = (
      <AdminPromoCodes
        refreshKey={refreshKey}
        showToast={showToast}
      />
    );
  } else if (path === "/admin/merchants") {
    page = (
      <AdminMerchants
        refreshKey={refreshKey}
        navigate={navigate}
        showToast={showToast}
      />
    );
  } else if (path === "/admin/reports") {
    page = <AdminReports refreshKey={refreshKey} showToast={showToast} />;
  } else if (path === "/admin/website-filter") {
    page = <AdminWebsiteFilter refreshKey={refreshKey} showToast={showToast} />;
  } else if (merchantMatch) {
    page = (
      <AdminMerchantDetail
        merchantId={merchantMatch[1]}
        refreshKey={refreshKey}
        navigate={navigate}
        showToast={showToast}
      />
    );
  } else if (path === "/admin/audit-logs") {
    page = <AdminAuditLogs refreshKey={refreshKey} />;
  } else if (path === "/admin/mail") {
    page = <AdminMailSettings refreshKey={refreshKey} showToast={showToast} />;
  } else if (path === "/admin/settings") {
    page = <AdminSettings session={session} showToast={showToast} />;
  } else {
    page = <AdminDashboard refreshKey={refreshKey} navigate={navigate} />;
  }

  return (
    <div className="admin-shell">
      {sidebarOpen && (
        <button
          className="admin-sidebar-backdrop"
          type="button"
          aria-label="关闭导航"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`admin-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="admin-sidebar-brand">
          <img className="admin-sidebar-logo" src={logoLight} alt="promo-code" />
          <div>
            <small>运营控制台</small>
          </div>
        </div>
        <nav className="admin-nav" aria-label="管理后台导航">
          {ADMIN_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              item.path === "/admin"
                ? path === "/admin"
                : path === item.path || path.startsWith(`${item.path}/`);
            return (
              <button
                className={`admin-nav-item ${active ? "active" : ""}`}
                type="button"
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-user-mini">
            <span className="admin-user-avatar">{session.email.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{session.name || "平台管理员"}</strong>
              <small>{session.email}</small>
            </div>
          </div>
          <button className="admin-logout-button" type="button" onClick={onLogout}>
            <LogOut size={15} />
            退出登录
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              className="admin-mobile-menu"
              type="button"
              aria-label="打开导航"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={19} />
            </button>
            <div className="admin-breadcrumb">
              <span>管理控制台</span>
              <ChevronRight size={14} />
              <strong>{pageMeta.title}</strong>
            </div>
          </div>
          <div className="admin-topbar-actions">
            <button className="admin-topbar-button" type="button" onClick={refresh}>
              <RefreshCw size={15} />
              刷新
            </button>
            <a className="admin-topbar-button" href="/" target="_blank" rel="noreferrer">
              <ExternalLink size={15} />
              打开前台
            </a>
            <span className="admin-system-status">
              <span />
              系统正常
            </span>
          </div>
        </header>
        <main className="admin-content">{page}</main>
      </div>
    </div>
  );
}

function getAdminPageMeta(path) {
  if (path.startsWith("/admin/promo-codes")) {
    return { title: "优惠码管理" };
  }
  if (path.startsWith("/admin/merchants")) {
    return { title: "商户管理" };
  }
  if (path.startsWith("/admin/reports")) {
    return { title: "举报管理" };
  }
  if (path.startsWith("/admin/website-filter")) {
    return { title: "网站过滤" };
  }
  if (path.startsWith("/admin/audit-logs")) {
    return { title: "操作日志" };
  }
  if (path.startsWith("/admin/mail")) {
    return { title: "邮件配置" };
  }
  if (path.startsWith("/admin/settings")) {
    return { title: "系统设置" };
  }
  return { title: "数据概览" };
}

function AdminPageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="admin-page-header">
      <div>
        {eyebrow && <span className="admin-page-kicker">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

function AdminMetricCard({ icon: Icon, label, value, detail, tone = "purple" }) {
  return (
    <section className="admin-metric-card">
      <div className={`admin-metric-icon ${tone}`}>
        <Icon size={18} />
      </div>
      <div className="admin-metric-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </section>
  );
}

function AdminPanel({ title, description, action, children, className = "" }) {
  return (
    <section className={`admin-panel ${className}`}>
      <div className="admin-panel-header">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function AdminStatusBadge({ status, label }) {
  const labels = {
    active: "正常",
    pending: "待验证",
    suspended: "已暂停",
    published: "已发布",
    paused: "已暂停",
    expired: "已过期",
    removed: "已下架",
    disabled: "已停用",
    resolved: "已处理",
    dismissed: "已忽略",
  };
  return (
    <span className={`admin-status-badge ${status}`}>
      <span />
      {label || labels[status] || status}
    </span>
  );
}

function AdminDashboard({ refreshKey, navigate }) {
  const deals = getDeals();
  const accounts = getAccounts();
  const publishedDeals = deals.filter((deal) => isVisible(deal));
  const verifiedMerchants = accounts.filter(
    (account) => getMerchantAdminStatus(account) === "active",
  );
  const copies = deals.reduce((total, deal) => total + (deal.copyCount || 0), 0);
  const recentDeals = [...deals]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 5);
  const expiringDeals = deals
    .filter((deal) => getDealAdminStatus(deal) === "published")
    .filter((deal) => {
      const remaining = daysUntil(deal.endAt);
      return remaining !== null && remaining >= 0 && remaining <= 14;
    })
    .slice(0, 5);
  const dailyCounts = Array.from({ length: 7 }, (_, index) => {
    const date = new Date("2026-09-15T00:00:00");
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    return {
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      count: deals.filter((deal) => deal.createdAt === key).length,
    };
  });
  const maxDailyCount = Math.max(...dailyCounts.map((item) => item.count), 1);
  void refreshKey;

  return (
    <div className="admin-page">
      <AdminPageHeader
        eyebrow="平台运营"
        title="数据概览"
        description="快速查看优惠码目录、商户和内容状态。"
      />

      <div className="admin-metric-grid">
        <AdminMetricCard
          icon={Tags}
          label="当前在线优惠码"
          value={publishedDeals.length}
          detail={`全部 ${deals.length} 条记录`}
          tone="purple"
        />
        <AdminMetricCard
          icon={Users}
          label="已验证商户"
          value={verifiedMerchants.length}
          detail={`全部 ${accounts.length} 个商户`}
          tone="blue"
        />
        <AdminMetricCard
          icon={BarChart3}
          label="近 7 天新增"
          value={dailyCounts.reduce((total, item) => total + item.count, 0)}
          detail="按优惠码创建时间统计"
          tone="green"
        />
        <AdminMetricCard
          icon={Activity}
          label="优惠码复制次数"
          value={copies}
          detail="匿名聚合统计"
          tone="orange"
        />
      </div>

      <div className="admin-dashboard-grid">
        <AdminPanel
          title="近 7 天发布趋势"
          description="按优惠码创建时间统计"
          className="admin-trend-panel"
        >
          <div className="admin-trend-chart">
            {dailyCounts.map((item) => (
              <div className="admin-trend-column" key={item.label}>
                <span className="admin-trend-value">{item.count || ""}</span>
                <div className="admin-trend-track">
                  <div
                    className="admin-trend-bar"
                    style={{ height: `${Math.max((item.count / maxDailyCount) * 100, item.count ? 12 : 3)}%` }}
                  />
                </div>
                <small>{item.label}</small>
              </div>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel title="系统状态" description="当前前端演示环境状态">
          <div className="admin-health-list">
            <div>
              <span><CheckCircle2 size={16} />公开目录</span>
              <strong>正常</strong>
            </div>
            <div>
              <span><CheckCircle2 size={16} />商户发布</span>
              <strong>正常</strong>
            </div>
            <div>
              <span><Clock3 size={16} />邮件验证</span>
              <strong>演示模式</strong>
            </div>
            <div>
              <span><ShieldAlert size={16} />待处理下架</span>
              <strong>{deals.filter((deal) => deal.adminStatus === "removed").length} 条</strong>
            </div>
          </div>
        </AdminPanel>
      </div>

      <div className="admin-dashboard-grid lower">
        <AdminPanel
          title="最近发布"
          action={
            <button className="admin-inline-link" type="button" onClick={() => navigate("/admin/promo-codes")}>
              查看全部 <ChevronRight size={14} />
            </button>
          }
        >
          {recentDeals.length ? (
            <div className="admin-activity-list">
              {recentDeals.map((deal) => (
                <div className="admin-activity-row" key={deal.id}>
                  <span className="admin-activity-dot purple" />
                  <div>
                    <strong>{deal.code}</strong>
                    <span>{deal.offer}</span>
                  </div>
                  <time>{formatAdminDate(deal.createdAt)}</time>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmptyState label="暂无优惠码记录" />
          )}
        </AdminPanel>

        <AdminPanel title="即将过期" description="未来 14 天内结束的优惠码">
          {expiringDeals.length ? (
            <div className="admin-activity-list">
              {expiringDeals.map((deal) => (
                <div className="admin-activity-row" key={deal.id}>
                  <span className="admin-activity-dot orange" />
                  <div>
                    <strong>{deal.code}</strong>
                    <span>{deal.endAt ? `截止 ${formatDate(deal.endAt)}` : "长期有效"}</span>
                  </div>
                  <time>{deal.storeName}</time>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmptyState label="暂无即将过期的优惠码" />
          )}
        </AdminPanel>
      </div>
    </div>
  );
}

function AdminPromoCodes({ refreshKey, showToast }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [merchantId, setMerchantId] = useState("all");
  const [, setVersion] = useState(0);
  void refreshKey;

  const deals = getDeals();
  const accounts = getAccounts();
  const filteredDeals = deals
    .filter((deal) => {
      const normalized = query.trim().toLowerCase();
      const matchesQuery =
        !normalized ||
        [deal.code, deal.offer, deal.storeName, deal.website]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      const matchesStatus = status === "all" || getDealAdminStatus(deal) === status;
      const matchesMerchant =
        merchantId === "all" || deal.ownerEmail === merchantId;
      return matchesQuery && matchesStatus && matchesMerchant;
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  const reload = () => setVersion((value) => value + 1);

  const removeDeal = (deal) => {
    if (!window.confirm(`确认下架优惠码 ${deal.code} 吗？`)) return;
    const nextDeals = getDeals().map((item) =>
      item.id === deal.id
        ? {
            ...item,
            adminStatus: "removed",
            adminRemovalReason: "管理员下架",
            adminRemovedAt: new Date().toISOString(),
            adminRemovedBy: DEMO_ADMIN_EMAIL,
          }
        : item,
    );
    writeStorage(DEALS_KEY, nextDeals);
    writeAuditLog({
      action: "remove_promo_code",
      targetType: "promo_code",
      targetId: deal.id,
      description: `下架优惠码 ${deal.code}`,
    });
    reload();
    showToast(`优惠码 ${deal.code} 已下架`, "success");
  };

  const restoreDeal = (deal) => {
    const nextDeals = getDeals().map((item) =>
      item.id === deal.id
        ? {
            ...item,
            adminStatus: "normal",
            adminRemovalReason: "",
            adminRemovedAt: "",
            adminRemovedBy: "",
          }
        : item,
    );
    writeStorage(DEALS_KEY, nextDeals);
    writeAuditLog({
      action: "restore_promo_code",
      targetType: "promo_code",
      targetId: deal.id,
      description: `恢复优惠码 ${deal.code}`,
    });
    reload();
    showToast(`优惠码 ${deal.code} 已恢复`, "success");
  };

  const deleteDeal = (deal) => {
    if (!window.confirm(`确认永久删除优惠码 ${deal.code} 吗？此操作不可恢复。`)) return;
    writeStorage(DEALS_KEY, getDeals().filter((item) => item.id !== deal.id));
    writeAuditLog({
      action: "delete_promo_code",
      targetType: "promo_code",
      targetId: deal.id,
      description: `删除优惠码 ${deal.code}`,
    });
    reload();
    showToast(`优惠码 ${deal.code} 已删除`, "success");
  };

  return (
    <div className="admin-page">
      <AdminPageHeader
        eyebrow="内容管理"
        title="优惠码管理"
        description="查看和处理平台内全部优惠码，发布前不需要审核。"
      />
      <AdminPanel title="全部优惠码" description={`共 ${filteredDeals.length} 条匹配记录`}>
        <div className="admin-filter-bar">
          <label className="admin-search-box">
            <Search size={16} />
            <input
              value={query}
              placeholder="搜索优惠码、内容或商户"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">全部状态</option>
            <option value="published">已发布</option>
            <option value="paused">已暂停</option>
            <option value="expired">已过期</option>
            <option value="removed">已下架</option>
          </select>
          <select value={merchantId} onChange={(event) => setMerchantId(event.target.value)}>
            <option value="all">全部商户</option>
            {accounts.map((account) => (
              <option value={account.email} key={account.id}>
                {account.storeName}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>优惠码</th>
                <th>优惠内容</th>
                <th>商户</th>
                <th>状态</th>
                <th>截止时间</th>
                <th>复制次数</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeals.map((deal) => {
                const dealStatus = getDealAdminStatus(deal);
                return (
                  <tr key={deal.id}>
                    <td>
                      <span className="admin-code-chip">{deal.code}</span>
                    </td>
                    <td>
                      <strong className="admin-table-primary">{deal.offer}</strong>
                      <span className="admin-table-secondary">{deal.terms || "无额外限制"}</span>
                    </td>
                    <td>
                      <strong className="admin-table-primary">{deal.storeName}</strong>
                      <span className="admin-table-secondary">{getWebsiteHostname(deal.website)}</span>
                    </td>
                    <td><AdminStatusBadge status={dealStatus} /></td>
                    <td>{deal.endAt ? formatDate(deal.endAt) : "长期有效"}</td>
                    <td>{deal.copyCount || 0}</td>
                    <td>
                      <div className="admin-row-actions">
                        <a
                          className="admin-icon-button"
                          href={deal.website}
                          target="_blank"
                          rel="noreferrer"
                          title="打开官网"
                          aria-label="打开官网"
                        >
                          <Eye size={15} />
                        </a>
                        {dealStatus === "removed" ? (
                          <button
                            className="admin-icon-button success"
                            type="button"
                            title="恢复优惠码"
                            aria-label="恢复优惠码"
                            onClick={() => restoreDeal(deal)}
                          >
                            <CheckCircle2 size={15} />
                          </button>
                        ) : (
                          <button
                            className="admin-icon-button warning"
                            type="button"
                            title="下架优惠码"
                            aria-label="下架优惠码"
                            onClick={() => removeDeal(deal)}
                          >
                            <Ban size={15} />
                          </button>
                        )}
                        <button
                          className="admin-icon-button danger"
                          type="button"
                          title="永久删除"
                          aria-label="永久删除"
                          onClick={() => deleteDeal(deal)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filteredDeals.length && <AdminEmptyState label="没有符合条件的优惠码" />}
        </div>
      </AdminPanel>
    </div>
  );
}

function AdminMerchants({ refreshKey, navigate, showToast }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [, setVersion] = useState(0);
  void refreshKey;
  const accounts = getAccounts();
  const filteredAccounts = accounts.filter((account) => {
    const normalized = query.trim().toLowerCase();
    const accountStatus = getMerchantAdminStatus(account);
    const matchesQuery =
      !normalized ||
      [account.storeName, account.email, account.website].join(" ").toLowerCase().includes(normalized);
    return matchesQuery && (status === "all" || accountStatus === status);
  });

  const toggleMerchant = (account) => {
    const currentStatus = getMerchantAdminStatus(account);
    const shouldSuspend = currentStatus !== "suspended";
    const nextAccounts = getAccounts().map((item) =>
      item.id === account.id
        ? {
            ...item,
            adminStatus: shouldSuspend ? "suspended" : "normal",
            adminSuspendedAt: shouldSuspend ? new Date().toISOString() : "",
            adminSuspendedBy: shouldSuspend ? DEMO_ADMIN_EMAIL : "",
          }
        : item,
    );
    writeStorage(ACCOUNTS_KEY, nextAccounts);
    writeAuditLog({
      action: shouldSuspend ? "suspend_merchant" : "resume_merchant",
      targetType: "merchant",
      targetId: account.id,
      description: `${shouldSuspend ? "暂停" : "恢复"}商户 ${account.storeName}`,
    });
    setVersion((value) => value + 1);
    showToast(`商户已${shouldSuspend ? "暂停" : "恢复"}`, "success");
  };

  return (
    <div className="admin-page">
      <AdminPageHeader
        eyebrow="商户管理"
        title="商户管理"
        description="查看商户资料、验证状态和其发布的优惠码。"
      />
      <AdminPanel title="全部商户" description={`共 ${filteredAccounts.length} 个匹配商户`}>
        <div className="admin-filter-bar">
          <label className="admin-search-box">
            <Search size={16} />
            <input
              value={query}
              placeholder="搜索商户名称、邮箱或域名"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">全部状态</option>
            <option value="active">正常</option>
            <option value="pending">待验证</option>
            <option value="suspended">已暂停</option>
          </select>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>商户</th>
                <th>注册邮箱</th>
                <th>官网</th>
                <th>邮箱状态</th>
                <th>优惠码</th>
                <th>商户状态</th>
                <th>注册时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((account) => {
                const accountStatus = getMerchantAdminStatus(account);
                const dealCount = getDeals().filter((deal) => deal.ownerEmail === account.email).length;
                return (
                  <tr key={account.id}>
                    <td>
                      <div className="admin-merchant-cell">
                        <span className="admin-merchant-avatar">{account.storeName.slice(0, 1)}</span>
                        <strong>{account.storeName}</strong>
                      </div>
                    </td>
                    <td>{account.email}</td>
                    <td>
                      <a className="admin-table-link" href={account.website} target="_blank" rel="noreferrer">
                        {getWebsiteHostname(account.website)}
                      </a>
                    </td>
                    <td><AdminStatusBadge status={account.emailVerified ? "active" : "pending"} /></td>
                    <td>{dealCount}</td>
                    <td><AdminStatusBadge status={accountStatus} /></td>
                    <td>{formatAdminDate(account.createdAt)}</td>
                    <td>
                      <div className="admin-row-actions">
                        <button
                          className="admin-icon-button"
                          type="button"
                          title="查看商户"
                          aria-label="查看商户"
                          onClick={() => navigate(`/admin/merchants/${account.id}`)}
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          className={`admin-icon-button ${accountStatus === "suspended" ? "success" : "warning"}`}
                          type="button"
                          title={accountStatus === "suspended" ? "恢复商户" : "暂停商户"}
                          aria-label={accountStatus === "suspended" ? "恢复商户" : "暂停商户"}
                          onClick={() => toggleMerchant(account)}
                        >
                          {accountStatus === "suspended" ? <Play size={15} /> : <Pause size={15} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filteredAccounts.length && <AdminEmptyState label="暂无符合条件的商户" />}
        </div>
      </AdminPanel>
    </div>
  );
}

function AdminReports({ refreshKey, showToast }) {
  const [reports, setReports] = useState(getUserReports);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    setReports(getUserReports());
  }, [refreshKey]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredReports = reports
    .filter((report) => {
      const matchesQuery =
        !normalizedQuery ||
        [report.code, report.storeName, report.reason, report.userEmail]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesQuery && (status === "all" || report.status === status);
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  const updateReportStatus = (report, nextStatus) => {
    const nextReports = getUserReports().map((item) =>
      item.id === report.id
        ? {
            ...item,
            status: nextStatus,
            handledAt: new Date().toISOString(),
            handledBy: DEMO_ADMIN_EMAIL,
          }
        : item,
    );
    writeStorage(USER_REPORTS_KEY, nextReports);
    writeAuditLog({
      action: nextStatus === "resolved" ? "resolve_report" : "dismiss_report",
      targetType: "promo_code_report",
      targetId: report.id,
      description: `${nextStatus === "resolved" ? "处理" : "忽略"}举报 ${report.code}`,
    });
    setReports(nextReports);
    showToast(
      nextStatus === "resolved" ? "举报已标记为已处理" : "举报已忽略",
      "success",
    );
  };

  return (
    <div className="admin-page">
      <AdminPageHeader
        eyebrow="风险控制"
        title="举报管理"
        description="查看用户提交的优惠码举报，并记录处理结果。"
      />
      <AdminPanel
        title="用户举报"
        description={`共 ${filteredReports.length} 条匹配记录`}
      >
        <div className="admin-filter-bar">
          <label className="admin-search-box">
            <Search size={16} />
            <input
              value={query}
              placeholder="搜索优惠码、商户、举报原因或邮箱"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">全部状态</option>
            <option value="pending">待处理</option>
            <option value="resolved">已处理</option>
            <option value="dismissed">已忽略</option>
          </select>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table admin-reports-table">
            <thead>
              <tr>
                <th>举报时间</th>
                <th>优惠码</th>
                <th>商户</th>
                <th>举报原因</th>
                <th>用户邮箱</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((report) => (
                <tr key={report.id}>
                  <td>{formatAdminDate(report.createdAt)}</td>
                  <td><span className="admin-code-chip">{report.code}</span></td>
                  <td>
                    <strong className="admin-table-primary">{report.storeName}</strong>
                    <span className="admin-table-secondary">
                      {getWebsiteHostname(report.website)}
                    </span>
                  </td>
                  <td>
                    <span className="admin-table-primary">{report.reason}</span>
                  </td>
                  <td>{report.userEmail}</td>
                  <td>
                    <AdminStatusBadge
                      status={report.status}
                      label={
                        report.status === "pending"
                          ? "待处理"
                          : report.status === "resolved"
                            ? "已处理"
                            : "已忽略"
                      }
                    />
                  </td>
                  <td>
                    {report.status === "pending" ? (
                      <div className="admin-row-actions">
                        <button
                          className="admin-icon-button success"
                          type="button"
                          title="标记为已处理"
                          aria-label="标记为已处理"
                          onClick={() => updateReportStatus(report, "resolved")}
                        >
                          <CheckCircle2 size={15} />
                        </button>
                        <button
                          className="admin-icon-button warning"
                          type="button"
                          title="忽略举报"
                          aria-label="忽略举报"
                          onClick={() => updateReportStatus(report, "dismissed")}
                        >
                          <Ban size={15} />
                        </button>
                      </div>
                    ) : (
                      <span className="admin-table-secondary">
                        {report.handledAt ? formatAdminDate(report.handledAt) : "已归档"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredReports.length && <AdminEmptyState label="暂无符合条件的举报记录" />}
        </div>
      </AdminPanel>
    </div>
  );
}

function AdminWebsiteFilter({ refreshKey, showToast }) {
  const [rules, setRules] = useState(getWebsiteBlacklist);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [form, setForm] = useState({ website: "", reason: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    setRules(getWebsiteBlacklist());
  }, [refreshKey]);

  const activeRules = rules.filter((rule) => rule.status !== "disabled");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRules = rules
    .filter((rule) => {
      const matchesQuery =
        !normalizedQuery ||
        [rule.hostname, rule.keyword, rule.reason, rule.createdBy]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesStatus = status === "all" || rule.status === status;
      return matchesQuery && matchesStatus;
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  const reload = () => setRules(getWebsiteBlacklist());

  const addRule = (event) => {
    event.preventDefault();
    setError("");

    const input = form.website.trim();
    const hostname = normalizeWebsiteHostname(input);
    const isDomainRule = Boolean(hostname && hostname.includes("."));
    const keyword = input.toLowerCase();
    if (!isDomainRule && keyword.length < 2) {
      setError("请输入完整域名或至少 2 个字符的敏感词");
      return;
    }
    if (!form.reason.trim()) {
      setError("请填写加入黑名单的原因");
      return;
    }

    const existingRule = getWebsiteBlacklist().find((rule) => {
      const existingIsKeyword =
        rule.matchType === "keyword" || (!rule.hostname && rule.keyword);
      return isDomainRule
        ? !existingIsKeyword && rule.hostname === hostname
        : existingIsKeyword && String(rule.keyword || "").toLowerCase() === keyword;
    });
    if (existingRule) {
      setError(
        existingRule.status === "disabled"
          ? "该规则已停用，请直接恢复这条规则"
          : "该规则已经在黑名单中",
      );
      return;
    }

    const nextRule = {
      id: makeId("website-rule"),
      matchType: isDomainRule ? "domain" : "keyword",
      hostname: isDomainRule ? hostname : "",
      keyword: isDomainRule ? "" : keyword,
      reason: form.reason.trim(),
      status: "active",
      createdAt: new Date().toISOString(),
      createdBy: DEMO_ADMIN_EMAIL,
    };
    writeStorage(WEBSITE_FILTER_KEY, [nextRule, ...getWebsiteBlacklist()]);
    writeAuditLog({
      action: "add_website_blacklist",
      targetType: "website",
      targetId: isDomainRule ? hostname : keyword,
      description: `将${isDomainRule ? "网站域名" : "敏感词"} ${isDomainRule ? hostname : keyword} 加入黑名单`,
    });
    setForm({ website: "", reason: "" });
    reload();
    showToast(
      `已将${isDomainRule ? "网站域名" : "敏感词"} ${isDomainRule ? hostname : keyword} 加入黑名单`,
      "success",
    );
  };

  const toggleRule = (rule) => {
    const nextStatus = rule.status === "disabled" ? "active" : "disabled";
    const ruleLabel = getWebsiteRuleLabel(rule);
    writeStorage(
      WEBSITE_FILTER_KEY,
      getWebsiteBlacklist().map((item) =>
        item.id === rule.id ? { ...item, status: nextStatus } : item,
      ),
    );
    writeAuditLog({
      action: nextStatus === "active" ? "enable_website_blacklist" : "disable_website_blacklist",
      targetType: "website",
      targetId: rule.hostname || rule.keyword,
      description: `${nextStatus === "active" ? "启用" : "停用"}网站过滤规则 ${ruleLabel}`,
    });
    reload();
    showToast(`${ruleLabel} 已${nextStatus === "active" ? "恢复拦截" : "停用规则"}`, "success");
  };

  const deleteRule = (rule) => {
    const ruleLabel = getWebsiteRuleLabel(rule);
    if (!window.confirm(`确认永久删除 ${ruleLabel} 的过滤规则吗？`)) return;
    writeStorage(
      WEBSITE_FILTER_KEY,
      getWebsiteBlacklist().filter((item) => item.id !== rule.id),
    );
    writeAuditLog({
      action: "delete_website_blacklist",
      targetType: "website",
      targetId: rule.hostname || rule.keyword,
      description: `删除网站过滤规则 ${ruleLabel}`,
    });
    reload();
    showToast(`已删除 ${ruleLabel} 的过滤规则`, "success");
  };

  return (
    <div className="admin-page">
      <AdminPageHeader
        eyebrow="风险控制"
        title="网站过滤"
        description="维护违法违规网站黑名单，命中后将阻止商户注册并隐藏相关公开优惠码。"
        action={
          <span className="admin-page-signal">
            <ShieldAlert size={16} />
            当前拦截 {activeRules.length} 条规则
          </span>
        }
      />

      <div className="admin-website-filter-summary">
        <div>
          <strong>{activeRules.length}</strong>
          <span>当前拦截规则</span>
        </div>
        <div>
          <strong>{rules.length - activeRules.length}</strong>
          <span>已停用规则</span>
        </div>
        <div>
          <strong>包含</strong>
          <span>域名及敏感词匹配</span>
        </div>
      </div>

      <AdminPanel
        title="添加网站黑名单"
        description="输入完整域名会匹配主域名及子域名；输入敏感词会匹配官网地址中的域名、路径和参数。"
      >
        <form className="admin-website-filter-form" onSubmit={addRule}>
          <div className="admin-website-filter-fields">
            <label className="admin-field">
              <span>域名或敏感词</span>
              <input
                type="text"
                value={form.website}
                placeholder="https://example.com 或 doingfb"
                required
                onChange={(event) => setForm({ ...form, website: event.target.value })}
              />
            </label>
            <label className="admin-field">
              <span>违规原因</span>
              <input
                value={form.reason}
                placeholder="例如：传播违法违规内容"
                required
                onChange={(event) => setForm({ ...form, reason: event.target.value })}
              />
            </label>
          </div>
          <div className="admin-website-filter-form-footer">
            {error ? <p className="admin-form-error">{error}</p> : <span />}
            <button className="admin-primary-button" type="submit">
              <Plus size={16} />
              加入黑名单
            </button>
          </div>
        </form>
      </AdminPanel>

      <AdminPanel
        title="黑名单列表"
        description={`共 ${filteredRules.length} 条匹配规则`}
      >
        <div className="admin-filter-bar">
          <label className="admin-search-box">
            <Search size={16} />
            <input
              value={query}
              placeholder="搜索域名、违规原因或添加人"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">全部状态</option>
            <option value="active">拦截中</option>
            <option value="disabled">已停用</option>
          </select>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table website-filter-table">
            <thead>
              <tr>
                <th>匹配内容</th>
                <th>拦截范围</th>
                <th>违规原因</th>
                <th>添加时间</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.map((rule) => (
                <tr key={rule.id}>
                  <td>
                    {rule.matchType === "keyword" || (!rule.hostname && rule.keyword) ? (
                      <span className="admin-website-cell">
                        <ShieldAlert size={15} />
                        <strong>{rule.keyword}</strong>
                      </span>
                    ) : (
                      <a
                        className="admin-table-link"
                        href={`https://${rule.hostname}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className="admin-website-cell">
                          <Globe2 size={15} />
                          <strong>{rule.hostname}</strong>
                        </span>
                      </a>
                    )}
                  </td>
                  <td>
                    {rule.matchType === "keyword" || (!rule.hostname && rule.keyword)
                      ? "地址包含该敏感词"
                      : "主域名及其子域名"}
                  </td>
                  <td>
                    <span className="admin-table-primary">{rule.reason}</span>
                  </td>
                  <td>{formatAdminDate(rule.createdAt)}</td>
                  <td>
                    <AdminStatusBadge
                      status={rule.status}
                      label={rule.status === "disabled" ? "已停用" : "拦截中"}
                    />
                  </td>
                  <td>
                    <div className="admin-row-actions">
                      <button
                        className={`admin-icon-button ${rule.status === "disabled" ? "success" : "warning"}`}
                        type="button"
                        title={rule.status === "disabled" ? "恢复拦截" : "停用规则"}
                        aria-label={rule.status === "disabled" ? "恢复拦截" : "停用规则"}
                        onClick={() => toggleRule(rule)}
                      >
                        {rule.status === "disabled" ? (
                          <CheckCircle2 size={15} />
                        ) : (
                          <Ban size={15} />
                        )}
                      </button>
                      <button
                        className="admin-icon-button danger"
                        type="button"
                        title="永久删除规则"
                        aria-label="永久删除规则"
                        onClick={() => deleteRule(rule)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredRules.length && <AdminEmptyState label="暂无符合条件的网站黑名单规则" />}
        </div>
      </AdminPanel>
    </div>
  );
}

function AdminMerchantDetail({ merchantId, refreshKey, navigate, showToast }) {
  const account = getAccounts().find((item) => item.id === merchantId);
  void refreshKey;
  if (!account) {
    return (
      <div className="admin-page">
        <AdminPageHeader title="商户不存在" description="该商户可能已被删除或数据尚未同步。" />
        <button className="admin-secondary-button" type="button" onClick={() => navigate("/admin/merchants")}>
          返回商户列表
        </button>
      </div>
    );
  }

  const status = getMerchantAdminStatus(account);
  const deals = getDeals().filter((deal) => deal.ownerEmail === account.email);
  const toggleMerchant = () => {
    const shouldSuspend = status !== "suspended";
    writeStorage(
      ACCOUNTS_KEY,
      getAccounts().map((item) =>
        item.id === account.id
          ? {
              ...item,
              adminStatus: shouldSuspend ? "suspended" : "normal",
              adminSuspendedAt: shouldSuspend ? new Date().toISOString() : "",
              adminSuspendedBy: shouldSuspend ? DEMO_ADMIN_EMAIL : "",
            }
          : item,
      ),
    );
    writeAuditLog({
      action: shouldSuspend ? "suspend_merchant" : "resume_merchant",
      targetType: "merchant",
      targetId: account.id,
      description: `${shouldSuspend ? "暂停" : "恢复"}商户 ${account.storeName}`,
    });
    showToast(`商户已${shouldSuspend ? "暂停" : "恢复"}`, "success");
    navigate("/admin/merchants");
  };

  return (
    <div className="admin-page">
      <button className="admin-back-button" type="button" onClick={() => navigate("/admin/merchants")}>
        <ArrowLeft size={15} />
        返回商户列表
      </button>
      <AdminPageHeader
        eyebrow="商户详情"
        title={account.storeName}
        description={account.website}
        action={
          <button
            className={status === "suspended" ? "admin-primary-button" : "admin-danger-button"}
            type="button"
            onClick={toggleMerchant}
          >
            {status === "suspended" ? <Play size={15} /> : <Pause size={15} />}
            {status === "suspended" ? "恢复商户" : "暂停商户"}
          </button>
        }
      />
      <div className="admin-detail-grid">
        <AdminPanel title="基本资料">
          <dl className="admin-detail-list">
            <div><dt>注册邮箱</dt><dd>{account.email}</dd></div>
            <div><dt>官网地址</dt><dd><a className="admin-table-link" href={account.website} target="_blank" rel="noreferrer">{account.website}</a></dd></div>
            <div><dt>邮箱状态</dt><dd><AdminStatusBadge status={account.emailVerified ? "active" : "pending"} /></dd></div>
            <div><dt>商户状态</dt><dd><AdminStatusBadge status={status} /></dd></div>
            <div><dt>注册时间</dt><dd>{formatAdminDate(account.createdAt)}</dd></div>
          </dl>
        </AdminPanel>
        <AdminPanel title="内容统计">
          <div className="admin-detail-stats">
            <strong>{deals.length}</strong>
            <span>已创建优惠码</span>
          </div>
        </AdminPanel>
      </div>
      <AdminPanel title="商户优惠码" description={`共 ${deals.length} 条记录`}>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>优惠码</th><th>优惠内容</th><th>状态</th><th>截止时间</th><th>复制次数</th></tr>
            </thead>
            <tbody>
              {deals.map((deal) => (
                <tr key={deal.id}>
                  <td><span className="admin-code-chip">{deal.code}</span></td>
                  <td>{deal.offer}</td>
                  <td><AdminStatusBadge status={getDealAdminStatus(deal)} /></td>
                  <td>{deal.endAt ? formatDate(deal.endAt) : "长期有效"}</td>
                  <td>{deal.copyCount || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!deals.length && <AdminEmptyState label="该商户还没有优惠码" />}
        </div>
      </AdminPanel>
    </div>
  );
}

function AdminAuditLogs({ refreshKey }) {
  const [query, setQuery] = useState("");
  void refreshKey;
  const logs = getAdminLogs().filter((log) => {
    const normalized = query.trim().toLowerCase();
    return (
      !normalized ||
      [log.action, log.targetType, log.targetId, log.description, log.adminEmail]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  });

  return (
    <div className="admin-page">
      <AdminPageHeader
        eyebrow="安全与审计"
        title="操作日志"
        description="记录后台管理员对商户、优惠码和系统的关键操作。"
      />
      <AdminPanel title="管理员操作记录" description={`共 ${logs.length} 条记录`}>
        <div className="admin-filter-bar single">
          <label className="admin-search-box">
            <Search size={16} />
            <input
              value={query}
              placeholder="搜索操作、目标或说明"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>时间</th><th>管理员</th><th>操作</th><th>目标</th><th>说明</th></tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatAdminDate(log.createdAt)}</td>
                  <td>{log.adminEmail}</td>
                  <td><span className="admin-action-label">{log.action}</span></td>
                  <td>{log.targetType} / {log.targetId}</td>
                  <td>{log.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!logs.length && <AdminEmptyState label="暂无操作日志" />}
        </div>
      </AdminPanel>
    </div>
  );
}

function AdminMailSettings({ refreshKey, showToast }) {
  const [form, setForm] = useState(DEFAULT_MAIL_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    adminApiRequest("/api/admin/mail-settings")
      .then((data) => {
        if (cancelled) return;
        const settings = data?.settings || data?.data?.settings || data?.data || data;
        setForm({ ...DEFAULT_MAIL_SETTINGS, ...normalizeMailSettings(settings) });
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError.message || "邮件配置加载失败");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.fromAddress.trim()) {
      setError("请填写发件地址");
      return;
    }

    if (form.driver === "smtp") {
      const port = Number(form.smtpPort);
      if (!form.smtpHost.trim() || !Number.isInteger(port) || port < 1 || port > 65535) {
        setError("SMTP 服务器地址和端口格式不正确");
        return;
      }
    }

    setSaving(true);
    try {
      const data = await adminApiRequest("/api/admin/mail-settings", {
        method: "PUT",
        body: JSON.stringify(buildMailSettingsPayload(form)),
      });
      const settings = data?.settings || data?.data?.settings || data?.data || data;
      setForm({ ...DEFAULT_MAIL_SETTINGS, ...normalizeMailSettings(settings) });
      showToast("邮件配置已保存", "success");
    } catch (requestError) {
      setError(requestError.message || "邮件配置保存失败");
    } finally {
      setSaving(false);
    }
  };

  const sendTestMail = async () => {
    setError("");
    setTesting(true);
    try {
      const data = await adminApiRequest("/api/admin/mail-settings/test", {
        method: "POST",
        body: JSON.stringify({
          recipient: form.testRecipient.trim() || undefined,
        }),
      });
      showToast(data?.message || "测试邮件已发送", "success");
    } catch (requestError) {
      setError(requestError.message || "测试邮件发送失败");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="admin-page">
      <AdminPageHeader
        eyebrow="系统"
        title="邮件配置"
        description="配置平台发件服务，并发送测试邮件验证连接。"
      />
      {error && <p className="admin-page-error" role="alert">{error}</p>}
      {loading ? (
        <AdminPanel title="邮件服务">
          <div className="admin-empty-state">正在加载邮件配置...</div>
        </AdminPanel>
      ) : (
        <form className="admin-mail-layout" onSubmit={saveSettings}>
          <AdminPanel title="基础配置">
            <div className="admin-setting-fields">
              <label className="admin-field">
                <span>发件地址</span>
                <input
                  type="email"
                  value={form.fromAddress}
                  placeholder="no-reply@example.com"
                  required
                  onChange={(event) => updateField("fromAddress", event.target.value)}
                />
              </label>
              <label className="admin-field">
                <span>内容格式</span>
                <select
                  value={form.contentFormat}
                  onChange={(event) => updateField("contentFormat", event.target.value)}
                >
                  <option value="multipart">混合格式（推荐）</option>
                  <option value="plain">纯文本</option>
                  <option value="html">HTML</option>
                </select>
              </label>
              <label className="admin-field">
                <span>发件方式</span>
                <select
                  value={form.driver}
                  onChange={(event) => updateField("driver", event.target.value)}
                >
                  <option value="mail">mail</option>
                  <option value="mailgun">mailgun</option>
                  <option value="postmark">postmark</option>
                  <option value="log">log</option>
                  <option value="smtp">smtp</option>
                  <option value="null">null</option>
                </select>
              </label>
              <label className="admin-field">
                <span>测试收件地址</span>
                <input
                  type="email"
                  value={form.testRecipient}
                  placeholder="留空使用管理员邮箱"
                  onChange={(event) => updateField("testRecipient", event.target.value)}
                />
              </label>
            </div>
          </AdminPanel>

          <AdminPanel
            title="SMTP 服务"
            description="通常使用 587 端口（TLS）或 465 端口（SSL）。"
          >
            <div className="admin-setting-fields admin-mail-fields">
              <label className="admin-field">
                <span>服务器地址</span>
                <input
                  value={form.smtpHost}
                  placeholder="smtp.example.com"
                  onChange={(event) => updateField("smtpHost", event.target.value)}
                />
              </label>
              <label className="admin-field">
                <span>端口</span>
                <input
                  type="number"
                  min="1"
                  max="65535"
                  value={form.smtpPort}
                  onChange={(event) => updateField("smtpPort", event.target.value)}
                />
              </label>
              <label className="admin-field">
                <span>加密协议</span>
                <select
                  value={form.smtpEncryption}
                  onChange={(event) => updateField("smtpEncryption", event.target.value)}
                >
                  <option value="">None</option>
                  <option value="tls">TLS</option>
                  <option value="ssl">SSL</option>
                </select>
              </label>
              <label className="admin-field">
                <span>用户名</span>
                <input
                  value={form.smtpUsername}
                  placeholder="通常与发件地址一致"
                  onChange={(event) => updateField("smtpUsername", event.target.value)}
                />
              </label>
              <label className="admin-field">
                <span>密码</span>
                <input
                  type="password"
                  value={form.smtpPassword}
                  placeholder="留空表示保持当前密码"
                  autoComplete="new-password"
                  onChange={(event) => updateField("smtpPassword", event.target.value)}
                />
              </label>
              <label className="admin-toggle-row admin-mail-toggle">
                <span>
                  <strong>验证 SSL 证书</strong>
                  <small>使用 TLS 或 SSL 时验证服务器证书。</small>
                </span>
                <input
                  type="checkbox"
                  checked={form.smtpVerifySsl}
                  onChange={(event) => updateField("smtpVerifySsl", event.target.checked)}
                />
              </label>
            </div>
          </AdminPanel>

          <div className="admin-settings-footer">
            <button
              className="admin-secondary-button"
              type="button"
              disabled={saving || testing}
              onClick={sendTestMail}
            >
              <Mail size={16} />
              {testing ? "发送中..." : "发送测试邮件"}
            </button>
            <button className="admin-primary-button" type="submit" disabled={saving || testing}>
              {saving ? "保存中..." : "保存配置"}
              <Check size={16} />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function AdminSettings({ session, showToast }) {
  const [settings, setSettings] = useState(getAdminSettings);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const saveSettings = async (event) => {
    event.preventDefault();
    setError("");
    if (password || passwordConfirm) {
      if (password.length < 8) {
        setError("新密码至少需要 8 位");
        return;
      }
      if (password !== passwordConfirm) {
        setError("两次输入的新密码不一致");
        return;
      }
    }

    setSaving(true);
    try {
      await adminApiRequest("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({
          ...settings,
          ...(password ? { password } : {}),
        }),
      });
      writeStorage(ADMIN_SETTINGS_KEY, settings);
      setPassword("");
      setPasswordConfirm("");
      showToast("系统设置已保存", "success");
    } catch (requestError) {
      setError(requestError.message || "系统设置保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page">
      <AdminPageHeader
        eyebrow="系统"
        title="系统设置"
        description="管理后台基础开关和管理员登录凭据。"
      />
      <form className="admin-settings-layout" onSubmit={saveSettings}>
        <AdminPanel title="公开站点">
          <label className="admin-toggle-row">
            <span>
              <strong>允许新商户注册</strong>
              <small>关闭后，公开站点将暂时停止创建商户账号。</small>
            </span>
            <input
              type="checkbox"
              checked={settings.allowMerchantRegistration}
              onChange={(event) =>
                setSettings({ ...settings, allowMerchantRegistration: event.target.checked })
              }
            />
          </label>
          <div className="admin-setting-status">
            <span className="admin-system-dot" />
            公开站点状态：{settings.siteStatus}
          </div>
        </AdminPanel>
        <AdminPanel title="管理员密码">
          <div className="admin-setting-fields">
            <label className="admin-field">
              <span>当前管理员</span>
              <input value={session.email} readOnly />
            </label>
            <label className="admin-field">
              <span>新密码</span>
              <input
                type="password"
                value={password}
                placeholder="至少 8 位，留空表示不修改"
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label className="admin-field">
              <span>确认新密码</span>
              <input
                type="password"
                value={passwordConfirm}
                placeholder="再次输入新密码"
                onChange={(event) => setPasswordConfirm(event.target.value)}
              />
            </label>
          </div>
          {error && <p className="admin-form-error">{error}</p>}
        </AdminPanel>
        <div className="admin-settings-footer">
          <button className="admin-primary-button" type="submit" disabled={saving}>
            {saving ? "保存中..." : "保存设置"}
            <Check size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}

function AdminEmptyState({ label }) {
  return (
    <div className="admin-empty-state">
      <FileText size={20} />
      <span>{label}</span>
    </div>
  );
}

function MerchantRegister({ navigate, showToast }) {
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");

  const submit = (event) => {
    event.preventDefault();
    setError("");
    if (!getAdminSettings().allowMerchantRegistration) {
      setError("平台暂时关闭了商户注册，请稍后再试");
      return;
    }
    const email = form.email.trim().toLowerCase();
    if (!email || !form.password) {
      setError("请填写完整信息");
      return;
    }
    if (form.password.length < 8) {
      setError("密码至少需要 8 位");
      return;
    }
    const accounts = getAccounts();
    if (accounts.some((account) => account.email === email)) {
      setError("这个邮箱已经注册，请直接登录");
      return;
    }
    const account = {
      id: makeId("merchant"),
      email,
      password: form.password,
      storeName: "",
      website: "",
      emailVerified: false,
      status: "pending_verification",
      createdAt: "2026-09-15",
    };
    writeStorage(ACCOUNTS_KEY, [...accounts, account]);
    showToast("注册成功，请先完成邮箱验证", "success");
    navigate(`/merchant/verify?email=${encodeURIComponent(email)}`);
  };

  return (
    <AuthPage
      eyebrow="商户入口"
      title="发布你的优惠码"
      description="注册并验证邮箱后，在发布页面填写商户名称和官网地址。"
      navigate={navigate}
    >
      <form className="auth-form" onSubmit={submit}>
        <FormField
          label="邮箱"
          type="email"
          value={form.email}
          placeholder="name@company.com"
          onChange={(value) => setForm({ ...form, email: value })}
        />
        <FormField
          label="密码"
          type="password"
          value={form.password}
          placeholder="至少 8 位"
          onChange={(value) => setForm({ ...form, password: value })}
        />
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button full-width" type="submit">
          创建商户账号
          <ArrowUpRight size={16} />
        </button>
        <p className="auth-switch">
          已有账号？
          <button type="button" onClick={() => navigate("/merchant/login")}>
            商户登录
          </button>
        </p>
      </form>
    </AuthPage>
  );
}

function MerchantLogin({ navigate, onLogin, showToast }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = (event) => {
    event.preventDefault();
    const account = getAccounts().find(
      (item) => item.email === email.trim().toLowerCase() && item.password === password,
    );
    if (!account) {
      setError("邮箱或密码不正确");
      return;
    }
    if (!account.emailVerified) {
      setError("请先完成邮箱验证");
      navigate(`/merchant/verify?email=${encodeURIComponent(account.email)}`);
      return;
    }
    if (account.status === "suspended") {
      setError("该商户账号已暂停");
      return;
    }
    showToast("登录成功", "success");
    onLogin(account);
  };

  return (
    <AuthPage
      eyebrow="商户入口"
      title="商户登录"
      description="登录后管理你发布的优惠码。"
      navigate={navigate}
    >
      <form className="auth-form" onSubmit={submit}>
        <FormField
          label="邮箱"
          type="email"
          value={email}
          placeholder="name@company.com"
          onChange={setEmail}
        />
        <FormField
          label="密码"
          type="password"
          value={password}
          placeholder="请输入密码"
          onChange={setPassword}
        />
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button full-width" type="submit">
          登录商户中心
          <LogIn size={16} />
        </button>
        <p className="auth-switch">
          还没有账号？
          <button type="button" onClick={() => navigate("/merchant/register")}>
            注册商户
          </button>
        </p>
      </form>
    </AuthPage>
  );
}

function MerchantVerify({ navigate, onLogin, showToast }) {
  const email = new URLSearchParams(window.location.search).get("email") || "";
  const [message, setMessage] = useState("");

  const verify = () => {
    const accounts = getAccounts();
    const index = accounts.findIndex((account) => account.email === email);
    if (index < 0) {
      setMessage("没有找到对应的注册信息，请重新注册。");
      return;
    }
    const updated = {
      ...accounts[index],
      emailVerified: true,
      status: "active",
    };
    accounts[index] = updated;
    writeStorage(ACCOUNTS_KEY, accounts);
    showToast("邮箱验证成功", "success");
    onLogin(updated);
  };

  return (
    <AuthPage
      eyebrow="邮箱验证"
      title="验证你的邮箱"
      description={
        email
          ? `验证 ${email} 后即可发布优惠码。`
          : "请从验证邮件进入此页面。"
      }
      navigate={navigate}
    >
      <div className="verify-panel">
        <div className="verify-icon">
          <Mail size={22} />
        </div>
        <p>开发预览中，点击下方按钮模拟完成邮箱验证。</p>
        {message && <p className="form-error">{message}</p>}
        <button className="primary-button full-width" type="button" onClick={verify}>
          模拟验证邮箱
          <Check size={16} />
        </button>
        <button className="text-button full-width" type="button" onClick={() => navigate("/merchant/login")}>
          返回登录
        </button>
      </div>
    </AuthPage>
  );
}

function MerchantDashboard({ session, navigate, showToast }) {
  const account = getAccounts().find((item) => item.id === session.accountId);
  const [deals, setDeals] = useState(() =>
    getDeals().filter((deal) => deal.ownerEmail === session.email),
  );
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => createEmptyDealForm(account));

  const refresh = () => {
    setDeals(getDeals().filter((deal) => deal.ownerEmail === session.email));
  };

  const submit = (event) => {
    event.preventDefault();
    const storeName = form.storeName.trim();
    const website = form.website.trim();
    if (!storeName || !website || !form.code.trim() || !form.offer.trim() || !form.discountValue.trim()) {
      showToast("请填写商户名称、官网地址、优惠码、优惠内容和折扣数值");
      return;
    }
    try {
      const parsed = new URL(website);
      if (parsed.protocol !== "https:") throw new Error();
    } catch {
      showToast("官网地址必须是 HTTPS 地址，例如 https://example.com");
      return;
    }
    if (findWebsiteBlacklistMatch(website)) {
      showToast("该官网地址已被列入网站黑名单，暂不支持发布");
      return;
    }
    const allDeals = getDeals();
    const duplicate = allDeals.some(
      (deal) =>
        deal.ownerEmail === session.email &&
        deal.code.toLowerCase() === form.code.trim().toLowerCase() &&
        deal.id !== editing,
    );
    if (duplicate) {
      showToast("这个商户已经发布过相同优惠码");
      return;
    }

    const accounts = getAccounts();
    const accountIndex = accounts.findIndex((item) => item.id === account?.id);
    if (accountIndex < 0) {
      showToast("商户信息不存在，请重新登录");
      return;
    }
    const updatedAccount = {
      ...accounts[accountIndex],
      storeName,
      website,
    };
    accounts[accountIndex] = updatedAccount;
    writeStorage(ACCOUNTS_KEY, accounts);

    const nextDeal = {
      id: editing || makeId("deal"),
      storeName,
      website,
      code: form.code.trim().toUpperCase(),
      offer: form.offer.trim(),
      dealType: form.dealType,
      discountValue: form.discountValue.trim(),
      terms: form.terms.trim(),
      endAt: form.endAt,
      status: "published",
      createdAt: editing
        ? allDeals.find((deal) => deal.id === editing)?.createdAt || "2026-09-15"
        : "2026-09-15",
      ownerEmail: session.email,
    };
    const nextDeals = editing
      ? allDeals.map((deal) => (deal.id === editing ? nextDeal : deal))
      : [...allDeals, nextDeal];
    writeStorage(DEALS_KEY, nextDeals);
    setForm(createEmptyDealForm(updatedAccount));
    setEditing(null);
    refresh();
    showToast(editing ? "优惠码已更新" : "优惠码已发布", "success");
  };

  const editDeal = (deal) => {
    setEditing(deal.id);
    setForm({
      storeName: deal.storeName || account?.storeName || "",
      website: deal.website || account?.website || "",
      code: deal.code,
      offer: deal.offer,
      dealType: deal.dealType,
      discountValue: deal.discountValue,
      terms: deal.terms,
      endAt: deal.endAt,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleDeal = (id) => {
    const allDeals = getDeals();
    const nextDeals = allDeals.map((deal) => {
      if (deal.id !== id || deal.ownerEmail !== session.email) return deal;
      return { ...deal, status: deal.status === "paused" ? "published" : "paused" };
    });
    writeStorage(DEALS_KEY, nextDeals);
    refresh();
    showToast("优惠码状态已更新", "success");
  };

  return (
    <main className="merchant-main">
      <section className="merchant-topline">
        <div className="wrapper merchant-topline-inner">
          <div>
            <p className="eyebrow">用户中心</p>
            <h1>{account?.storeName || form.storeName || session.storeName || "用户中心"}</h1>
            <p>管理你的优惠码，保存后立即公开展示。</p>
          </div>
        </div>
      </section>

      <section className="merchant-workspace wrapper">
        <div className="form-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">{editing ? "编辑优惠码" : "新增优惠码"}</span>
              <h2>{editing ? "编辑优惠码" : "发布优惠码"}</h2>
            </div>
            {editing && (
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  setEditing(null);
                  setForm(createEmptyDealForm(account));
                }}
              >
                取消编辑
              </button>
            )}
          </div>
          <form className="deal-form" onSubmit={submit}>
            <div className="form-grid">
              <FormField
                label="商户名称"
                value={form.storeName}
                placeholder="例如：墨点笔记"
                onChange={(value) => setForm({ ...form, storeName: value })}
              />
              <FormField
                label="官网地址"
                type="url"
                value={form.website}
                placeholder="https://example.com"
                onChange={(value) => setForm({ ...form, website: value })}
              />
              <FormField
                label="优惠码"
                value={form.code}
                placeholder="例如 WELCOME20"
                onChange={(value) => setForm({ ...form, code: value })}
              />
              <FormField
                label="优惠内容"
                value={form.offer}
                placeholder="例如：新用户首单 8 折"
                onChange={(value) => setForm({ ...form, offer: value })}
              />
              <label className="field">
                <span>折扣类型</span>
                <div className="select-wrap">
                  <select
                    value={form.dealType}
                    onChange={(event) => setForm({ ...form, dealType: event.target.value })}
                  >
                    <option value="percentage">百分比折扣</option>
                    <option value="fixed_amount">固定金额折扣</option>
                  </select>
                  <ChevronDown size={15} />
                </div>
              </label>
              <FormField
                label="折扣数值"
                value={form.discountValue}
                placeholder="例如 20"
                onChange={(value) => setForm({ ...form, discountValue: value })}
              />
              <FormField
                label="截止时间"
                type="date"
                value={form.endAt}
                required={false}
                onChange={(value) => setForm({ ...form, endAt: value })}
              />
              <FormField
                label="使用限制"
                value={form.terms}
                placeholder="例如：仅限新用户"
                required={false}
                onChange={(value) => setForm({ ...form, terms: value })}
              />
            </div>
            <div className="form-footer">
              <span className="form-hint">
                发布商户：{form.website || "请填写 HTTPS 官网地址"}
              </span>
              <button className="primary-button" type="submit">
                {editing ? "保存修改" : "立即发布"}
                <Plus size={16} />
              </button>
            </div>
          </form>
        </div>

        <div className="merchant-list-section">
          <div className="section-heading compact">
            <div>
              <span className="section-kicker">我的优惠码</span>
              <h2>已发布优惠码</h2>
            </div>
            <span className="result-count">{deals.length} 条</span>
          </div>
          {deals.length === 0 ? (
            <div className="merchant-empty">还没有优惠码，先发布第一条吧。</div>
          ) : (
            <div className="merchant-deal-list">
              {deals.map((deal) => (
                <div className={`merchant-deal-row ${deal.status}`} key={deal.id}>
                  <div className="merchant-deal-code">
                    <span className="code-pill">{deal.code}</span>
                    <span className="status-label">
                      {deal.status === "paused" ? "已暂停" : "公开展示"}
                    </span>
                  </div>
                  <div className="merchant-deal-info">
                    <strong>{deal.offer}</strong>
                    <span>
                      {deal.endAt ? `截止 ${formatDate(deal.endAt)}` : "长期有效"}
                      {deal.terms ? ` · ${deal.terms}` : ""}
                    </span>
                  </div>
                  <div className="row-actions">
                    <button
                      className="icon-text-button"
                      type="button"
                      onClick={() => editDeal(deal)}
                    >
                      编辑
                    </button>
                    <button
                      className="icon-text-button"
                      type="button"
                      onClick={() => toggleDeal(deal.id)}
                    >
                      {deal.status === "paused" ? <Play size={14} /> : <Pause size={14} />}
                      {deal.status === "paused" ? "恢复" : "暂停"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button className="back-link" type="button" onClick={() => navigate("/")}>
          <ArrowLeft size={15} />
          返回优惠码目录
        </button>
      </section>
    </main>
  );
}

function createEmptyDealForm(account = {}) {
  return {
    storeName: account.storeName || "",
    website: account.website || "",
    code: "",
    offer: "",
    dealType: "percentage",
    discountValue: "",
    terms: "",
    endAt: "",
  };
}

function AuthPage({ eyebrow, title, description, navigate, children }) {
  return (
    <main className="auth-main">
      <div className="auth-layout wrapper">
        <div className="auth-intro">
          <button className="back-link" type="button" onClick={() => navigate("/")}>
            <ArrowLeft size={15} />
            返回优惠码目录
          </button>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <section className="auth-panel">{children}</section>
      </div>
    </main>
  );
}

function FormField({
  label,
  type = "text",
  value,
  placeholder,
  required = true,
  onChange,
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </label>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrapper footer-inner">
        <img className="footer-brand-logo" src={logoLight} alt="promo-code" />
      </div>
    </footer>
  );
}

createRoot(document.getElementById("root")).render(<App />);
