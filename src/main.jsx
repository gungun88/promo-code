import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Ban,
  Check,
  CheckCircle2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Clock3,
  ExternalLink,
  Eye,
  FileText,
  Flag,
  Github,
  Globe2,
  Heart,
  LayoutDashboard,
  LogIn,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  Pause,
  Pin,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Store,
  Tag,
  Tags,
  Trash2,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import logoDark from "./assets/brand/logo-dark.svg";
import logoLight from "./assets/brand/logo-light.svg";
import packageJson from "../package.json";
import "./styles.css";

const PUBLIC_DEALS_BATCH_SIZE = 20;
const ADMIN_TABLE_PAGE_SIZE = 50;
const APP_VERSION = packageJson.version;
const GITHUB_REPOSITORY_URL = "https://github.com/lowseekai/promo-code";
const DEV_API_ORIGIN = `http://${globalThis.location?.hostname || "localhost"}:8000`;
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? DEV_API_ORIGIN : "")
).replace(/\/$/, "");
const DEFAULT_ADMIN_SETTINGS = {
  allowUserRegistration: true,
  siteStatus: "正常运行",
  merchantDealTotalLimit: 50,
  merchantDealPublicLimit: 10,
  merchantDealDailyLimit: 5,
  preventDuplicateMerchantCodes: true,
  showGithubLink: true,
  githubUrl: GITHUB_REPOSITORY_URL,
};
const DEFAULT_ANNOUNCEMENT = {
  id: "site-announcement",
  content: "",
  link: "",
  level: "normal",
  enabled: false,
  startsAt: "",
  endsAt: "",
  updatedAt: "",
  updatedBy: "",
};
function normalizeLimitValue(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
}

function getBusinessDateInputValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeAnnouncement(value = {}) {
  return {
    ...DEFAULT_ANNOUNCEMENT,
    ...(value || {}),
    content: String(value?.content || "").trim(),
    link: String(value?.link || "").trim(),
    level: ["normal", "important", "risk"].includes(value?.level)
      ? value.level
      : DEFAULT_ANNOUNCEMENT.level,
    enabled: value?.enabled === true,
    startsAt: String(value?.startsAt || ""),
    endsAt: String(value?.endsAt || ""),
    updatedAt: String(value?.updatedAt || ""),
    updatedBy: String(value?.updatedBy || ""),
  };
}

function getAnnouncementSignature(announcement) {
  return announcement?.updatedAt || announcement?.content || "empty-announcement";
}

function isAnnouncementActive(announcement) {
  if (!announcement?.enabled || !announcement.content) return false;
  const now = new Date();
  const startsAt = announcement.startsAt
    ? new Date(`${announcement.startsAt}T00:00:00`)
    : null;
  const endsAt = announcement.endsAt
    ? new Date(`${announcement.endsAt}T23:59:59`)
    : null;
  return (
    (!startsAt || Number.isNaN(startsAt.getTime()) || startsAt <= now) &&
    (!endsAt || Number.isNaN(endsAt.getTime()) || endsAt >= now)
  );
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

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
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

const adminApiRequest = apiRequest;

function Switch({ checked, onChange, label, disabled = false }) {
  return (
    <span className="admin-switch-control">
      <button
        className={`admin-switch${checked ? " is-on" : ""}`}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onChange(!checked);
        }}
      >
        <span className="admin-switch-thumb" />
      </button>
      <small>{checked ? "开启中" : "关闭中"}</small>
    </span>
  );
}

function DateInput({ value, min, required = false, onChange }) {
  const inputRef = useRef(null);

  const openPicker = () => {
    if (typeof inputRef.current?.showPicker === "function") {
      inputRef.current.showPicker();
    } else {
      inputRef.current?.focus();
    }
  };

  return (
    <div className="admin-date-input">
      <input
        ref={inputRef}
        type="date"
        value={value}
        min={min}
        required={required}
        onChange={onChange}
      />
      <button
        className="admin-date-picker-button"
        type="button"
        aria-label="打开日期选择器"
        onClick={openPicker}
      >
        <CalendarDays size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

function SearchableSelect({ options, value, onChange, placeholder, required = false }) {
  const selected = options.find((option) => option.value === value);
  const [query, setQuery] = useState(selected?.label || "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(selected?.label || "");
  }, [value, selected?.label]);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="searchable-select">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        value={query}
        placeholder={placeholder}
        required={required}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          onChange("");
          setOpen(true);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      />
      {open && (
        <div className="searchable-select-menu" role="listbox">
          {filteredOptions.length ? (
            filteredOptions.map((option) => (
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                className="searchable-select-option"
                key={option.value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  setQuery(option.label);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            ))
          ) : (
            <span className="searchable-select-empty">没有匹配的优惠码</span>
          )}
        </div>
      )}
    </div>
  );
}

const DEFAULT_MAIL_SETTINGS = {
  enabled: true,
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
    enabled: settings.enabled !== false,
    contentFormat:
      settings.contentFormat ||
      settings.content_format ||
      DEFAULT_MAIL_SETTINGS.contentFormat,
    driver: ["smtp", "log", "null"].includes(
      settings.driver || settings.mailer || settings.transport,
    )
      ? settings.driver || settings.mailer || settings.transport
      : DEFAULT_MAIL_SETTINGS.driver,
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
    enabled: form.enabled,
    fromAddress: form.fromAddress.trim(),
    contentFormat: form.contentFormat,
    driver: form.driver,
    smtp,
    testRecipient: form.testRecipient.trim() || null,
  };
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
  const today = getBusinessDateInputValue();
  const target = Date.parse(`${date}T00:00:00Z`);
  const current = Date.parse(`${today}T00:00:00Z`);
  return Number.isNaN(target) || Number.isNaN(current)
    ? null
    : Math.ceil((target - current) / 86400000);
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
  const [userSession, setUserSession] = useState(null);
  const [adminSession, setAdminSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiRequest("/api/auth/user/me"),
      apiRequest("/api/admin/me"),
    ])
      .then(([userData, adminData]) => {
        if (cancelled) return;
        const user = userData?.user;
        const admin = adminData?.admin;
        setUserSession(
          user
            ? {
                accountId: user.id,
                email: user.email,
                emailVerified: user.emailVerified,
                merchant: userData?.merchant || null,
              }
            : null,
        );
        setAdminSession(admin ? { email: admin.email, name: admin.name } : null);
      })
      .catch(() => {
        if (!cancelled) {
          setUserSession(null);
          setAdminSession(null);
        }
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const showToast = (message, tone = "default") => setToast({ message, tone });

  const onUserLogin = (account, fallbackPath = "/user/center") => {
    setUserSession({
      accountId: account.id,
      email: account.email,
      emailVerified: account.emailVerified,
    });
    const nextPath =
      new URLSearchParams(window.location.search).get("next") || fallbackPath;
    navigate(nextPath);
  };

  const onUserLogout = async () => {
    try {
      await apiRequest("/api/auth/user/logout", { method: "POST" });
    } catch {
      // The local React state is still cleared when the server session has expired.
    }
    setUserSession(null);
    navigate("/");
  };

  const onAdminLogin = (account) => {
    setAdminSession({
      email: account.email,
      name: account.name,
    });
    navigate("/admin");
  };

  const onAdminLogout = async () => {
    try {
      await adminApiRequest("/api/admin/logout", { method: "POST" });
    } catch {
      // Clear the local state even if the server session has already expired.
    }
    setAdminSession(null);
    navigate("/admin/login");
  };

  if (!authReady) {
    return <div className="app-loading">正在连接服务...</div>;
  }

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
    content = <UserRegister navigate={navigate} />;
  } else if (path === "/user/verify") {
    content = <UserVerify navigate={navigate} onLogin={onUserLogin} showToast={showToast} />;
  } else if (path === "/user/forgot-password") {
    content = <UserForgotPassword navigate={navigate} showToast={showToast} />;
  } else if (path === "/user/reset-password") {
    content = <UserResetPassword navigate={navigate} onLogin={onUserLogin} showToast={showToast} />;
  } else if (path === "/user/center") {
    content = userSession ? (
      <UserCenter
        userSession={userSession}
        navigate={navigate}
        showToast={showToast}
      />
    ) : (
      <UserLogin navigate={navigate} onLogin={onUserLogin} />
    );
  } else if (path === "/create-deal") {
    content = userSession ? (
      <MerchantDashboard
        session={userSession}
        navigate={navigate}
        showToast={showToast}
      />
    ) : (
      <UserLogin navigate={navigate} onLogin={onUserLogin} nextPath="/create-deal" />
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
  const [siteSettings, setSiteSettings] = useState(DEFAULT_ADMIN_SETTINGS);

  useEffect(() => {
    let cancelled = false;

    apiRequest("/api/settings/public")
      .then((data) => {
        if (cancelled) return;
        const publicSettings = data?.settings || data?.data || data;
        setSiteSettings((current) => ({
          ...current,
          ...publicSettings,
          githubUrl: GITHUB_REPOSITORY_URL,
        }));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

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
      <AnnouncementBar />
      <div className="utility-bar">
        <div className="wrapper utility-inner">
          <div className="utility-meta">
            {siteSettings.showGithubLink !== false && (
              <a
                className="utility-repository"
                href={GITHUB_REPOSITORY_URL}
                target="_blank"
                rel="noreferrer"
                title="访问 GitHub 仓库"
                aria-label="访问 GitHub 仓库"
              >
                <Github size={14} aria-hidden="true" />
              </a>
            )}
            <span className="utility-version">v{APP_VERSION}</span>
          </div>
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
                        navigate("/create-deal");
                      }}
                    >
                      <Store size={15} />
                      创建优惠
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

function AnnouncementBar() {
  const [announcement, setAnnouncement] = useState(DEFAULT_ANNOUNCEMENT);
  const [dismissedSignature, setDismissedSignature] = useState("");

  useEffect(() => {
    let cancelled = false;

    apiRequest("/api/announcement")
      .then((data) => {
        if (cancelled) return;
        setAnnouncement(
          normalizeAnnouncement(data?.announcement || data?.data?.announcement || data),
        );
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  if (
    !isAnnouncementActive(announcement) ||
    dismissedSignature === getAnnouncementSignature(announcement)
  ) {
    return null;
  }

  const dismiss = () => {
    const signature = getAnnouncementSignature(announcement);
    setDismissedSignature(signature);
  };

  return (
    <div className={`announcement-bar announcement-${announcement.level}`} role="status">
      <div className="wrapper announcement-inner">
        <div className="announcement-copy">
          <Megaphone size={15} aria-hidden="true" />
          <span className="announcement-label">
            {announcement.level === "risk"
              ? "风险提示"
              : announcement.level === "important"
                ? "重要公告"
                : "公告"}
          </span>
          {announcement.link ? (
            <a href={announcement.link} target="_blank" rel="noreferrer">
              {announcement.content}
            </a>
          ) : (
            <span>{announcement.content}</span>
          )}
        </div>
        <button
          className="announcement-dismiss"
          type="button"
          aria-label="关闭公告"
          title="关闭公告"
          onClick={dismiss}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

function PublicDirectory({ navigate, showToast, userSession }) {
  const [query, setQuery] = useState(
    () => new URLSearchParams(window.location.search).get("q") || "",
  );
  const [sort, setSort] = useState("recommended");
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalDeals, setTotalDeals] = useState(0);
  const [hasMoreDeals, setHasMoreDeals] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [reportTarget, setReportTarget] = useState(null);
  const loadMoreRef = useRef(null);

  useEffect(() => {
    setPage(1);
    setDeals([]);
    setFavoriteIds([]);
    setTotalDeals(0);
    setHasMoreDeals(false);
  }, [query, sort, userSession?.accountId]);

  useEffect(() => {
    let cancelled = false;
    if (page === 1) setLoading(true);
    else setLoadingMore(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PUBLIC_DEALS_BATCH_SIZE),
      sort,
    });
    if (query.trim()) params.set("q", query.trim());
    apiRequest(`/api/deals?${params.toString()}`)
      .then((data) => {
        if (cancelled) return;
        const incomingDeals = Array.isArray(data?.deals) ? data.deals : [];
        setDeals((current) =>
          page === 1
            ? incomingDeals
            : [...current, ...incomingDeals.filter((deal) => !current.some((item) => item.id === deal.id))],
        );
        setFavoriteIds((current) =>
          page === 1
            ? Array.isArray(data?.favoriteIds) ? data.favoriteIds : []
            : [...new Set([...current, ...(data?.favoriteIds || [])])],
        );
        setTotalDeals(Number(data?.total || 0));
        setHasMoreDeals(Boolean(data?.hasMore));
      })
      .catch((error) => {
        if (!cancelled) showToast(error.message || "优惠码加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
        if (!cancelled) setLoadingMore(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, query, sort, userSession?.accountId]);

  useEffect(() => {
    if (!userSession) {
      setFavoriteIds([]);
    }
  }, [userSession]);

  useEffect(() => {
    const loadMoreTarget = loadMoreRef.current;
    if (!loadMoreTarget || !hasMoreDeals || loading || loadingMore) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setPage((currentPage) => currentPage + 1);
      },
      { rootMargin: "0px 0px 240px" },
    );

    observer.observe(loadMoreTarget);
    return () => observer.disconnect();
  }, [hasMoreDeals, loading, loadingMore]);

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
      await apiRequest(`/api/deals/${deal.id}/copy`, { method: "POST" });
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

  const toggleFavorite = async (deal) => {
    if (!requireUser()) return;
    const isFavorite = favoriteIds.includes(deal.id);
    try {
      await apiRequest(`/api/user/favorites/${deal.id}`, {
        method: isFavorite ? "DELETE" : "POST",
      });
      setFavoriteIds((current) =>
        isFavorite ? current.filter((id) => id !== deal.id) : [...current, deal.id],
      );
      showToast(isFavorite ? "已取消收藏" : "已收藏优惠码", "success");
    } catch (error) {
      showToast(error.message || "收藏操作失败");
    }
  };

  const openReport = (deal) => {
    if (!requireUser()) return;
    setReportTarget(deal);
  };

  const submitReport = async (reason) => {
    if (!reportTarget || !userSession) return;
    try {
      await apiRequest("/api/user/reports", {
        method: "POST",
        body: JSON.stringify({ dealId: reportTarget.id, reason }),
      });
      setReportTarget(null);
      showToast("举报已提交，我们会尽快处理", "success");
    } catch (error) {
      showToast(error.message || "举报提交失败");
    }
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
              <span className="result-count">{totalDeals} 条优惠码</span>
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
              {deals.map((deal) => (
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

          {loading && <div className="empty-state">正在加载优惠码...</div>}
          {loadingMore && <div className="empty-state">正在加载更多优惠码...</div>}
          {!loading && deals.length === 0 && (
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
          <Tag size={12} aria-hidden="true" />
          <span title={deal.code}>{deal.code}</span>
        </button>
      </td>
      <td data-label="商户">
        <div className="store-cell">
          <FaviconAvatar website={deal.website} fallback={deal.storeName.slice(0, 1)} />
          <div>
            <div className="store-name-line">
              <strong title={deal.storeName}>{deal.storeName}</strong>
              {deal.isSponsored && <span className="sponsor-badge">赞助</span>}
            </div>
            <a
              className="store-domain"
              href={deal.website}
              target="_blank"
              rel="noreferrer"
              title={getWebsiteHostname(deal.website)}
            >
              {getWebsiteHostname(deal.website)}
            </a>
          </div>
        </div>
      </td>
      <td data-label="优惠内容">
        <div className="offer-cell">
          <strong title={deal.offer}>{deal.offer}</strong>
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
        <span
          className="terms-cell"
          title={deal.terms || "以商户官网规则为准"}
        >
          {deal.terms || "以商户官网规则为准"}
        </span>
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

function UserLogin({ navigate, onLogin, nextPath = "/user/center" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [oauthProviders, setOauthProviders] = useState([]);
  const [mailEnabled, setMailEnabled] = useState(true);

  useEffect(() => {
    apiRequest("/api/auth/user/oauth/providers")
      .then((data) => setOauthProviders(Array.isArray(data?.providers) ? data.providers : []))
      .catch(() => setOauthProviders([]));
    apiRequest("/api/settings/public")
      .then((data) => setMailEnabled(data?.mailEnabled !== false))
      .catch(() => {});
    const oauthError = new URLSearchParams(window.location.search).get("oauth_error");
    if (oauthError) {
      setError(oauthError === "unverified_email" ? "授权平台未提供已验证邮箱" : "授权登录失败，请重试");
    }
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await apiRequest("/api/auth/user/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      onLogin(data?.user || data?.data?.user || data?.data, nextPath);
    } catch (requestError) {
      setError(requestError.message || "邮箱或密码不正确");
    } finally {
      setSubmitting(false);
    }
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
        {mailEnabled && (
          <button
            className="text-button auth-forgot-link"
            type="button"
            onClick={() => navigate("/user/forgot-password")}
          >
            忘记密码？
          </button>
        )}
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button full-width" type="submit" disabled={submitting}>
          {submitting ? "登录中..." : "登录"}
          <LogIn size={16} />
        </button>
        {oauthProviders.length > 0 && (
          <div className="auth-oauth-login">
            <div className="auth-login-divider"><span>或使用授权平台登录</span></div>
            {oauthProviders.map((provider) => (
              <a
                className="secondary-button full-width auth-oauth-button"
                href={`${API_BASE_URL}/api/auth/user/oauth/${provider.id}?next=${encodeURIComponent(nextPath)}`}
                key={provider.id}
              >
                {provider.name} 登录
                <ExternalLink size={16} />
              </a>
            ))}
          </div>
        )}
        {mailEnabled ? (
          <p className="auth-switch">
            还没有账号？
            <button type="button" onClick={() => navigate("/user/register")}>
              注册
            </button>
          </p>
        ) : (
          <p className="auth-switch auth-service-disabled">邮箱服务已关闭，暂不支持注册和找回密码。</p>
        )}
      </form>
    </AuthPage>
  );
}

function UserRegister({ navigate }) {
  const [form, setForm] = useState({ email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
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
    setSubmitting(true);
    try {
      const data = await apiRequest("/api/auth/user/register", {
        method: "POST",
        body: JSON.stringify({ email, password: form.password }),
      });
      const verificationUrl = data?.verificationUrl;
      navigate(
        verificationUrl
          ? (() => {
              const parsed = new URL(verificationUrl, window.location.origin);
              return `${parsed.pathname}${parsed.search}`;
            })()
          : `/user/verify?email=${encodeURIComponent(email)}`,
      );
    } catch (requestError) {
      setError(requestError.message || "注册失败");
    } finally {
      setSubmitting(false);
    }
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
        <button className="primary-button full-width" type="submit" disabled={submitting}>
          {submitting ? "注册中..." : "注册"}
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

function UserVerify({ navigate, onLogin, showToast }) {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";
  const initialEmail = params.get("email") || "";
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    setSubmitting(true);
    apiRequest(`/api/auth/user/verify?token=${encodeURIComponent(token)}`)
      .then((data) => {
        if (cancelled) return;
        showToast("邮箱验证成功", "success");
        onLogin(data?.user || data?.data?.user || data?.data);
      })
      .catch((error) => {
        if (!cancelled) setMessage(error.message || "邮箱验证失败");
      })
      .finally(() => {
        if (!cancelled) setSubmitting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const verifyCode = async (event) => {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);
    try {
      const data = await apiRequest("/api/auth/user/verify-code", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
      });
      showToast("邮箱验证成功", "success");
      onLogin(data?.user || data?.data?.user || data?.data);
    } catch (error) {
      setMessage(error.message || "验证码验证失败");
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setMessage("");
    try {
      const data = await apiRequest("/api/auth/user/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      showToast(data?.message || "验证邮件已发送", "success");
    } catch (error) {
      setMessage(error.message || "验证邮件发送失败");
    }
  };

  return (
    <AuthPage
      eyebrow="邮箱验证"
      title="激活你的账号"
      description={token ? "正在验证邮箱，请稍候。" : "请前往邮箱点击验证链接，或输入邮件中的 6 位验证码。"}
      navigate={navigate}
    >
      {token ? (
        <div className="verify-panel">
          <div className="verify-icon"><Mail size={22} /></div>
          {submitting ? <p>正在验证邮箱...</p> : <p>{message}</p>}
        </div>
      ) : (
        <form className="auth-form" onSubmit={verifyCode}>
          <FormField
            label="邮箱"
            type="email"
            value={email}
            placeholder="name@example.com"
            onChange={setEmail}
          />
          <FormField
            label="验证码"
            value={code}
            placeholder="输入 6 位验证码"
            onChange={setCode}
          />
          {message && <p className="form-error">{message}</p>}
          <button className="primary-button full-width" type="submit" disabled={submitting}>
            {submitting ? "验证中..." : "验证邮箱"}
            <Check size={16} />
          </button>
          <button className="text-button full-width" type="button" onClick={resend}>
            重新发送验证邮件
          </button>
        </form>
      )}
    </AuthPage>
  );
}

function UserForgotPassword({ navigate, showToast }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await apiRequest("/api/auth/user/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setMessage(data?.message || "如果账号存在，重置密码邮件将会发送。");
      showToast("重置密码邮件已发送", "success");
    } catch (requestError) {
      setError(requestError.message || "请求失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPage
      eyebrow="账号安全"
      title="忘记密码"
      description="输入注册邮箱，我们会发送密码重置链接。"
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
        {error && <p className="form-error">{error}</p>}
        {message && <p className="form-success">{message}</p>}
        <button className="primary-button full-width" type="submit" disabled={submitting}>
          {submitting ? "发送中..." : "发送重置邮件"}
          <Mail size={16} />
        </button>
        <button className="text-button full-width" type="button" onClick={() => navigate("/user/login")}>
          返回登录
        </button>
      </form>
    </AuthPage>
  );
}

function UserResetPassword({ navigate, showToast }) {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (password.length < 8 || password !== confirmPassword) {
      setError(password.length < 8 ? "密码至少需要 8 位" : "两次输入的密码不一致");
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("/api/auth/user/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      showToast("密码已重置，请重新登录", "success");
      navigate("/user/login");
    } catch (requestError) {
      setError(requestError.message || "密码重置失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPage
      eyebrow="账号安全"
      title="设置新密码"
      description="请输入一个至少 8 位的新密码。"
      navigate={navigate}
    >
      <form className="auth-form" onSubmit={submit}>
        <FormField
          label="新密码"
          type="password"
          value={password}
          placeholder="至少 8 位"
          onChange={setPassword}
        />
        <FormField
          label="确认密码"
          type="password"
          value={confirmPassword}
          placeholder="再次输入新密码"
          onChange={setConfirmPassword}
        />
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button full-width" type="submit" disabled={submitting || !token}>
          {submitting ? "保存中..." : "重置密码"}
          <Check size={16} />
        </button>
      </form>
    </AuthPage>
  );
}

function UserCenter({ userSession, navigate, showToast }) {
  const [favoriteDeals, setFavoriteDeals] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([apiRequest("/api/user/favorites"), apiRequest("/api/user/reports")])
      .then(([favoritesData, reportsData]) => {
        if (cancelled) return;
        setFavoriteDeals(Array.isArray(favoritesData?.deals) ? favoritesData.deals : []);
        setReports(Array.isArray(reportsData?.reports) ? reportsData.reports : []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userSession.accountId]);

  useEffect(() => {
    const section = window.location.hash.slice(1);
    if (!section) return undefined;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const removeFavorite = async (dealId) => {
    try {
      await apiRequest(`/api/user/favorites/${dealId}`, { method: "DELETE" });
      setFavoriteDeals((current) => current.filter((deal) => deal.id !== dealId));
      showToast("已取消收藏", "success");
    } catch (error) {
      showToast(error.message || "取消收藏失败");
    }
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
          {loading ? (
            <div className="user-empty">正在加载用户数据...</div>
          ) : favoriteDeals.length ? (
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
  { path: "/admin/merchants", label: "发布者管理", icon: Users },
  { path: "/admin/placements", label: "置顶推广", icon: Pin },
  { path: "/admin/reports", label: "举报管理", icon: Flag },
  { path: "/admin/website-filter", label: "网站过滤", icon: ShieldAlert },
  { path: "/admin/announcements", label: "公告管理", icon: Megaphone },
  { path: "/admin/audit-logs", label: "操作日志", icon: FileText },
  { path: "/admin/mail", label: "邮件配置", icon: Mail },
  { path: "/admin/user-oauth", label: "第三方登录", icon: Globe2 },
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
              placeholder="admin@example.com"
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
  } else if (path === "/admin/placements") {
    page = <AdminPlacements refreshKey={refreshKey} showToast={showToast} />;
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
  } else if (path === "/admin/announcements") {
    page = <AdminAnnouncements refreshKey={refreshKey} showToast={showToast} />;
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
  } else if (path === "/admin/user-oauth") {
    page = <AdminUserOAuthSettings showToast={showToast} />;
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
  if (path.startsWith("/admin/placements")) {
    return { title: "置顶推广" };
  }
  if (path.startsWith("/admin/merchants")) {
    return { title: "发布者管理" };
  }
  if (path.startsWith("/admin/reports")) {
    return { title: "举报管理" };
  }
  if (path.startsWith("/admin/website-filter")) {
    return { title: "网站过滤" };
  }
  if (path.startsWith("/admin/announcements")) {
    return { title: "公告管理" };
  }
  if (path.startsWith("/admin/audit-logs")) {
    return { title: "操作日志" };
  }
  if (path.startsWith("/admin/mail")) {
    return { title: "邮件配置" };
  }
  if (path.startsWith("/admin/user-oauth")) {
    return { title: "第三方登录" };
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
  const [data, setData] = useState({ deals: [], merchants: [], reports: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminApiRequest("/api/admin/dashboard")
      .then((nextData) => {
        if (!cancelled) {
          setData({
            deals: Array.isArray(nextData?.deals) ? nextData.deals : [],
            merchants: Array.isArray(nextData?.merchants) ? nextData.merchants : [],
            reports: Array.isArray(nextData?.reports) ? nextData.reports : [],
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const deals = data.deals;
  const accounts = data.merchants;
  const publishedDeals = deals.filter(
    (deal) => getDealAdminStatus(deal) === "published",
  );
  const verifiedMerchants = accounts.filter((account) => account.emailVerified);
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
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    return {
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      count: deals.filter((deal) => String(deal.createdAt).slice(0, 10) === key).length,
    };
  });
  const maxDailyCount = Math.max(...dailyCounts.map((item) => item.count), 1);

  return (
    <div className="admin-page">
      <AdminPageHeader
        eyebrow="平台运营"
        title="数据概览"
        description="快速查看优惠码目录、商户和内容状态。"
      />

      {loading ? (
        <AdminPanel title="数据加载中">
          <div className="admin-empty-state">正在从数据库加载运营数据...</div>
        </AdminPanel>
      ) : (
      <>
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

        <AdminPanel title="系统状态" description="当前生产服务状态">
          <div className="admin-health-list">
            <div>
              <span><CheckCircle2 size={16} />公开目录</span>
              <strong>正常</strong>
            </div>
            <div>
              <span><CheckCircle2 size={16} />创建优惠</span>
              <strong>正常</strong>
            </div>
            <div>
              <span><Clock3 size={16} />邮件验证</span>
              <strong>已接入</strong>
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
      </>
      )}
    </div>
  );
}

function AdminPromoCodes({ refreshKey, showToast }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [merchantId, setMerchantId] = useState("all");
  const [deals, setDeals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalDeals, setTotalDeals] = useState(0);
  const [hasMoreDeals, setHasMoreDeals] = useState(false);

  const reload = (nextPage = 1) => {
    if (nextPage === 1) setLoading(true);
    else setLoadingMore(true);
    const requests = [
      adminApiRequest(`/api/admin/deals?page=${nextPage}&limit=${ADMIN_TABLE_PAGE_SIZE}`),
    ];
    if (nextPage === 1) requests.push(adminApiRequest("/api/admin/merchants"));
    return Promise.all(requests)
      .then(([dealsData, merchantsData]) => {
        const incomingDeals = Array.isArray(dealsData?.deals) ? dealsData.deals : [];
        setDeals((current) =>
          nextPage === 1
            ? incomingDeals
            : [...current, ...incomingDeals.filter((deal) => !current.some((item) => item.id === deal.id))],
        );
        setPage(nextPage);
        setTotalDeals(Number(dealsData?.total || 0));
        setHasMoreDeals(Boolean(dealsData?.hasMore));
        if (merchantsData) {
          setAccounts(Array.isArray(merchantsData?.merchants) ? merchantsData.merchants : []);
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  };

  useEffect(() => {
    reload();
  }, [refreshKey]);

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

  const updateDeal = async (deal, nextStatus) => {
    if (!window.confirm(`确认下架优惠码 ${deal.code} 吗？`)) return;
    try {
      await adminApiRequest(`/api/admin/deals/${deal.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          adminStatus: nextStatus,
          reason: nextStatus === "removed" ? "管理员下架" : "",
        }),
      });
      await reload(1);
      showToast(`优惠码 ${deal.code} 已${nextStatus === "removed" ? "下架" : "恢复"}`, "success");
    } catch (error) {
      showToast(error.message || "优惠码状态更新失败");
    }
  };

  const deleteDeal = async (deal) => {
    if (!window.confirm(`确认永久删除优惠码 ${deal.code} 吗？此操作不可恢复。`)) return;
    try {
      await adminApiRequest(`/api/admin/deals/${deal.id}`, { method: "DELETE" });
      await reload(1);
      showToast(`优惠码 ${deal.code} 已删除`, "success");
    } catch (error) {
      showToast(error.message || "优惠码删除失败");
    }
  };

  return (
    <div className="admin-page">
      <AdminPageHeader
        eyebrow="内容管理"
        title="优惠码管理"
        description="查看和处理平台内全部优惠码，发布前不需要审核。"
      />
      <AdminPanel title="全部优惠码" description={`共 ${totalDeals} 条记录，当前筛选 ${filteredDeals.length} 条`}>
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

        {loading ? (
          <div className="admin-empty-state">正在加载优惠码...</div>
        ) : <div className="admin-table-wrap">
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
                            onClick={() => updateDeal(deal, "normal")}
                          >
                            <CheckCircle2 size={15} />
                          </button>
                        ) : (
                          <button
                            className="admin-icon-button warning"
                            type="button"
                            title="下架优惠码"
                            aria-label="下架优惠码"
                            onClick={() => updateDeal(deal, "removed")}
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
          {hasMoreDeals && (
            <button
              type="button"
              className="admin-secondary-button"
              onClick={() => reload(page + 1)}
              disabled={loadingMore}
            >
              <RefreshCw size={15} className={loadingMore ? "spin" : ""} />
              {loadingMore ? "正在加载..." : "加载更多"}
            </button>
          )}
          {!filteredDeals.length && <AdminEmptyState label="没有符合条件的优惠码" />}
        </div>}
      </AdminPanel>
    </div>
  );
}

function AdminPlacements({ refreshKey, showToast }) {
  const today = getBusinessDateInputValue();
  const [placements, setPlacements] = useState([]);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dealSearch, setDealSearch] = useState("");
  const [form, setForm] = useState({
    dealId: "",
    placementType: "sponsored",
    priority: "100",
    sponsorName: "",
    startsAt: today,
    endsAt: "",
    note: "",
  });

  const reload = () => {
    setLoading(true);
    return Promise.all([
      adminApiRequest("/api/admin/placements"),
      adminApiRequest("/api/admin/placement-deals"),
    ])
      .then(([placementData, dealData]) => {
        const nextPlacements = Array.isArray(placementData?.placements)
          ? placementData.placements
          : [];
        const nextDeals = Array.isArray(dealData?.deals) ? dealData.deals : [];
        setPlacements(nextPlacements);
        setDeals(nextDeals);
        setForm((current) => ({
          ...current,
          dealId: current.dealId || nextDeals[0]?.id || "",
        }));
      })
      .catch((error) => showToast(error.message || "置顶数据加载失败"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, [refreshKey]);

  const availableDeals = deals.filter(
    (deal) => deal.status === "published" && deal.adminStatus !== "removed",
  );
  const filteredAvailableDeals = availableDeals.filter((deal) =>
    `${deal.code} ${deal.storeName}`.toLowerCase().includes(dealSearch.trim().toLowerCase()),
  );

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await adminApiRequest("/api/admin/placements", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          priority: Number(form.priority),
        }),
      });
      setForm((current) => ({
        ...current,
        dealId: "",
        sponsorName: "",
        note: "",
        startsAt: today,
        endsAt: "",
      }));
      await reload();
      showToast("置顶推广已创建", "success");
    } catch (error) {
      showToast(error.message || "置顶推广创建失败");
    } finally {
      setSubmitting(false);
    }
  };

  const togglePlacement = async (placement) => {
    try {
      await adminApiRequest(`/api/admin/placements/${placement.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: placement.status === "active" ? "paused" : "active" }),
      });
      await reload();
      showToast(placement.status === "active" ? "置顶推广已暂停" : "置顶推广已恢复", "success");
    } catch (error) {
      showToast(error.message || "置顶状态更新失败");
    }
  };

  const removePlacement = async (placement) => {
    if (!window.confirm(`确认删除 ${placement.code} 的置顶记录吗？`)) return;
    try {
      await adminApiRequest(`/api/admin/placements/${placement.id}`, { method: "DELETE" });
      await reload();
      showToast("置顶推广已删除", "success");
    } catch (error) {
      showToast(error.message || "置顶推广删除失败");
    }
  };

  return (
    <div className="admin-page">
      <AdminPageHeader
        eyebrow="商业运营"
        title="置顶推广"
        description="在统一优惠码列表中管理编辑精选和赞助置顶，前台会在商户名称旁显示赞助标识。"
      />

      <AdminPanel
        title="新增置顶推广"
        description="赞助置顶需要填写赞助名称，并设置有效期。"
      >
        <form className="placement-form" onSubmit={submit}>
          <div className="placement-form-grid">
            <label className="admin-field">
              <span>优惠码</span>
              <input
                type="search"
                value={dealSearch}
                placeholder="先搜索优惠码或商户名称"
                onChange={(event) => setDealSearch(event.target.value)}
              />
              <select
                value={form.dealId}
                required
                onChange={(event) => updateForm("dealId", event.target.value)}
              >
                <option value="">请选择优惠码</option>
                {filteredAvailableDeals.map((deal) => (
                  <option value={deal.id} key={deal.id}>
                    {deal.code} · {deal.storeName}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-field">
              <span>置顶类型</span>
              <select
                value={form.placementType}
                onChange={(event) => updateForm("placementType", event.target.value)}
              >
                <option value="sponsored">赞助置顶</option>
                <option value="editorial">编辑精选</option>
              </select>
            </label>
            <label className="admin-field">
              <span>优先级</span>
              <input
                type="number"
                min="0"
                max="1000"
                value={form.priority}
                onChange={(event) => updateForm("priority", event.target.value)}
              />
              <small className="admin-field-hint">数值越大，排序越靠前；相同数值按创建时间排序。</small>
            </label>
            <label className="admin-field">
              <span>赞助名称</span>
              <input
                value={form.sponsorName}
                placeholder="例如：Grammarly 官方赞助"
                required={form.placementType === "sponsored"}
                onChange={(event) => updateForm("sponsorName", event.target.value)}
              />
            </label>
            <label className="admin-field">
              <span>开始日期</span>
              <DateInput
                value={form.startsAt}
                required
                onChange={(event) => updateForm("startsAt", event.target.value)}
              />
            </label>
            <label className="admin-field">
              <span>结束日期</span>
              <DateInput
                value={form.endsAt}
                min={form.startsAt}
                onChange={(event) => updateForm("endsAt", event.target.value)}
              />
            </label>
          </div>
          <label className="admin-field placement-note-field">
            <span>内部备注</span>
            <input
              value={form.note}
              placeholder="仅后台可见，例如合同编号或合作说明"
              onChange={(event) => updateForm("note", event.target.value)}
            />
          </label>
          <div className="admin-settings-footer">
            <span className="admin-field-hint">同一商户同一时间只能有一个赞助置顶优惠码</span>
            <button className="admin-primary-button placement-submit-button" type="submit" disabled={submitting || !availableDeals.length}>
              <Pin size={15} />
              {submitting ? "保存中..." : "创建置顶"}
            </button>
          </div>
        </form>
      </AdminPanel>

      <AdminPanel
        title="置顶记录"
        description={`共 ${placements.length} 条记录，已过期记录不会在前台生效。`}
      >
        {loading ? (
          <div className="admin-empty-state">正在加载置顶记录...</div>
        ) : placements.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table placement-table">
              <thead>
                <tr>
                  <th>优惠码</th>
                  <th>商户</th>
                  <th>类型</th>
                  <th>有效期</th>
                  <th>优先级</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {placements.map((placement) => (
                  <tr key={placement.id}>
                    <td>
                      <span className="admin-code-chip">{placement.code}</span>
                      {placement.sponsorName && (
                        <span className="admin-table-secondary">{placement.sponsorName}</span>
                      )}
                    </td>
                    <td>
                      <strong className="admin-table-primary">{placement.storeName}</strong>
                      <span className="admin-table-secondary">{placement.ownerEmail}</span>
                    </td>
                    <td>
                      <AdminStatusBadge
                        status={placement.placementType === "sponsored" ? "active" : "pending"}
                        label={placement.placementType === "sponsored" ? "赞助置顶" : "编辑精选"}
                      />
                    </td>
                    <td>
                      {placement.startsAt || "立即"} 至 {placement.endsAt || "长期"}
                    </td>
                    <td>{placement.priority}</td>
                    <td>
                      <AdminStatusBadge
                        status={placement.status === "active" ? "published" : "disabled"}
                        label={placement.status === "active" ? "启用中" : "已暂停"}
                      />
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        <button
                          className="admin-icon-button"
                          type="button"
                          title={placement.status === "active" ? "暂停置顶" : "恢复置顶"}
                          aria-label={placement.status === "active" ? "暂停置顶" : "恢复置顶"}
                          onClick={() => togglePlacement(placement)}
                        >
                          {placement.status === "active" ? <Pause size={15} /> : <Play size={15} />}
                        </button>
                        <button
                          className="admin-icon-button danger"
                          type="button"
                          title="删除置顶"
                          aria-label="删除置顶"
                          onClick={() => removePlacement(placement)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminEmptyState label="暂无置顶推广记录" />
        )}
      </AdminPanel>
    </div>
  );
}

function AdminMerchants({ refreshKey, navigate, showToast }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    return adminApiRequest("/api/admin/merchants")
      .then((data) => setAccounts(Array.isArray(data?.merchants) ? data.merchants : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, [refreshKey]);

  const filteredAccounts = accounts.filter((account) => {
    const normalized = query.trim().toLowerCase();
    const accountStatus = getMerchantAdminStatus(account);
    const matchesQuery =
      !normalized ||
      [account.storeName, account.email, account.website].join(" ").toLowerCase().includes(normalized);
    return matchesQuery && (status === "all" || accountStatus === status);
  });

  const toggleMerchant = async (account) => {
    const currentStatus = getMerchantAdminStatus(account);
    const shouldSuspend = currentStatus !== "suspended";
    try {
      await adminApiRequest(`/api/admin/merchants/${account.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: shouldSuspend ? "suspended" : "active" }),
      });
      await reload();
      showToast(`发布者已${shouldSuspend ? "暂停" : "恢复"}`, "success");
    } catch (error) {
      showToast(error.message || "发布者状态更新失败");
    }
  };

  return (
    <div className="admin-page">
      <AdminPageHeader
        eyebrow="发布者管理"
        title="发布者管理"
        description="查看用户创建优惠时填写的网站资料、验证状态和其发布的优惠码。"
      />
      <AdminPanel title="全部发布者" description={`共 ${filteredAccounts.length} 个匹配发布者`}>
        <div className="admin-filter-bar">
          <label className="admin-search-box">
            <Search size={16} />
            <input
              value={query}
              placeholder="搜索名称、邮箱或域名"
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
        {loading ? (
          <div className="admin-empty-state">正在加载发布者...</div>
        ) : <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>发布者</th>
                <th>注册邮箱</th>
                <th>官网</th>
                <th>邮箱状态</th>
                <th>优惠码</th>
                <th>发布权限</th>
                <th>注册时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((account) => {
                const accountStatus = getMerchantAdminStatus(account);
                const dealCount = account.dealCount || 0;
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
                          title="查看发布者"
                          aria-label="查看发布者"
                          onClick={() => navigate(`/admin/merchants/${account.id}`)}
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          className={`admin-icon-button ${accountStatus === "suspended" ? "success" : "warning"}`}
                          type="button"
                          title={accountStatus === "suspended" ? "恢复发布者" : "暂停发布者"}
                          aria-label={accountStatus === "suspended" ? "恢复发布者" : "暂停发布者"}
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
        </div>}
      </AdminPanel>
    </div>
  );
}

function AdminReports({ refreshKey, showToast }) {
  const [reports, setReports] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminApiRequest("/api/admin/reports")
      .then((data) => {
        if (!cancelled) setReports(Array.isArray(data?.reports) ? data.reports : []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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

  const updateReportStatus = async (report, nextStatus) => {
    try {
      await adminApiRequest(`/api/admin/reports/${report.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setReports((current) =>
        current.map((item) =>
          item.id === report.id
            ? { ...item, status: nextStatus, handledAt: new Date().toISOString() }
            : item,
        ),
      );
      showToast(
        nextStatus === "resolved" ? "举报已标记为已处理" : "举报已忽略",
        "success",
      );
    } catch (error) {
      showToast(error.message || "举报状态更新失败");
    }
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

        {loading ? (
          <div className="admin-empty-state">正在加载举报记录...</div>
        ) : <div className="admin-table-wrap">
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
        </div>}
      </AdminPanel>
    </div>
  );
}

function AdminWebsiteFilter({ refreshKey, showToast }) {
  const [rules, setRules] = useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [form, setForm] = useState({ website: "", reason: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reload();
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

  const reload = () => {
    setLoading(true);
    return adminApiRequest("/api/admin/website-filters")
      .then((data) => setRules(Array.isArray(data?.rules) ? data.rules : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const addRule = async (event) => {
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

    const existingRule = rules.find((rule) => {
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

    try {
      await adminApiRequest("/api/admin/website-filters", {
        method: "POST",
        body: JSON.stringify({ website: input, reason: form.reason.trim() }),
      });
      setForm({ website: "", reason: "" });
      await reload();
      showToast(
        `已将${isDomainRule ? "网站域名" : "敏感词"} ${isDomainRule ? hostname : keyword} 加入黑名单`,
        "success",
      );
    } catch (requestError) {
      setError(requestError.message || "网站过滤规则保存失败");
    }
  };

  const toggleRule = async (rule) => {
    const nextStatus = rule.status === "disabled" ? "active" : "disabled";
    const ruleLabel = getWebsiteRuleLabel(rule);
    try {
      await adminApiRequest(`/api/admin/website-filters/${rule.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      await reload();
      showToast(`${ruleLabel} 已${nextStatus === "active" ? "恢复拦截" : "停用规则"}`, "success");
    } catch (error) {
      showToast(error.message || "网站过滤状态更新失败");
    }
  };

  const deleteRule = async (rule) => {
    const ruleLabel = getWebsiteRuleLabel(rule);
    if (!window.confirm(`确认永久删除 ${ruleLabel} 的过滤规则吗？`)) return;
    try {
      await adminApiRequest(`/api/admin/website-filters/${rule.id}`, { method: "DELETE" });
      await reload();
      showToast(`已删除 ${ruleLabel} 的过滤规则`, "success");
    } catch (error) {
      showToast(error.message || "网站过滤规则删除失败");
    }
  };

  return (
    <div className="admin-page">
      <AdminPageHeader
        eyebrow="风险控制"
        title="网站过滤"
        description="维护违法违规网站黑名单，命中后将阻止用户注册并隐藏相关公开优惠码。"
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
        {loading ? (
          <div className="admin-empty-state">正在加载网站过滤规则...</div>
        ) : <div className="admin-table-wrap">
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
        </div>}
      </AdminPanel>
    </div>
  );
}

function AdminMerchantDetail({ merchantId, refreshKey, navigate, showToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminApiRequest(`/api/admin/merchants/${merchantId}`)
      .then((nextData) => {
        if (!cancelled) setData(nextData);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [merchantId, refreshKey]);

  const account = data?.merchant;
  const deals = Array.isArray(data?.deals) ? data.deals : [];
  if (loading) {
    return (
      <div className="admin-page">
        <AdminPageHeader title="发布者详情" description="正在加载发布者数据..." />
      </div>
    );
  }
  if (!account) {
    return (
      <div className="admin-page">
        <AdminPageHeader title="发布者不存在" description="该发布者可能已被删除或数据尚未同步。" />
        <button className="admin-secondary-button" type="button" onClick={() => navigate("/admin/merchants")}>
          返回发布者列表
        </button>
      </div>
    );
  }

  const status = getMerchantAdminStatus(account);
  const toggleMerchant = async () => {
    const shouldSuspend = status !== "suspended";
    try {
      await adminApiRequest(`/api/admin/merchants/${account.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: shouldSuspend ? "suspended" : "active" }),
      });
      showToast(`发布者已${shouldSuspend ? "暂停" : "恢复"}`, "success");
      navigate("/admin/merchants");
    } catch (error) {
      showToast(error.message || "发布者状态更新失败");
    }
  };

  return (
    <div className="admin-page">
      <button className="admin-back-button" type="button" onClick={() => navigate("/admin/merchants")}>
        <ArrowLeft size={15} />
        返回发布者列表
      </button>
      <AdminPageHeader
        eyebrow="发布者详情"
        title={account.storeName}
        description={account.website}
        action={
          <button
            className={status === "suspended" ? "admin-primary-button" : "admin-danger-button"}
            type="button"
            onClick={toggleMerchant}
          >
            {status === "suspended" ? <Play size={15} /> : <Pause size={15} />}
            {status === "suspended" ? "恢复发布者" : "暂停发布者"}
          </button>
        }
      />
      <div className="admin-detail-grid">
        <AdminPanel title="基本资料">
          <dl className="admin-detail-list">
            <div><dt>注册邮箱</dt><dd>{account.email}</dd></div>
            <div><dt>官网地址</dt><dd><a className="admin-table-link" href={account.website} target="_blank" rel="noreferrer">{account.website}</a></dd></div>
            <div><dt>邮箱状态</dt><dd><AdminStatusBadge status={account.emailVerified ? "active" : "pending"} /></dd></div>
            <div><dt>发布权限</dt><dd><AdminStatusBadge status={status} /></dd></div>
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
      <AdminPanel title="发布的优惠码" description={`共 ${deals.length} 条记录`}>
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
          {!deals.length && <AdminEmptyState label="该发布者还没有优惠码" />}
        </div>
      </AdminPanel>
    </div>
  );
}

function AdminAnnouncements({ refreshKey, showToast }) {
  const [form, setForm] = useState(DEFAULT_ANNOUNCEMENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    adminApiRequest("/api/admin/announcement")
      .then((data) => {
        if (cancelled) return;
        const nextAnnouncement = normalizeAnnouncement(
          data?.announcement || data?.data?.announcement || data?.data || data,
        );
        setForm(nextAnnouncement);
      })
      .catch((requestError) => {
        if (cancelled) return;
        setError(requestError.message || "公告配置加载失败");
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

  const saveAnnouncement = async (event) => {
    event.preventDefault();
    setError("");

    const content = form.content.trim();
    if (form.enabled && !content) {
      setError("启用公告前请填写公告内容");
      return;
    }
    if (content.length > 200) {
      setError("公告内容不能超过 200 个字符");
      return;
    }
    if (form.link.trim()) {
      try {
        const parsed = new URL(form.link.trim());
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
      } catch {
        setError("跳转链接必须是有效的 HTTP 或 HTTPS 地址");
        return;
      }
    }
    if (form.startsAt && form.endsAt && form.startsAt > form.endsAt) {
      setError("结束日期不能早于开始日期");
      return;
    }

    const nextAnnouncement = normalizeAnnouncement({
      ...form,
      content,
      link: form.link.trim(),
      updatedAt: new Date().toISOString(),
      updatedBy: form.updatedBy || "",
    });

    setSaving(true);
    try {
      const data = await adminApiRequest("/api/admin/announcement", {
        method: "PATCH",
        body: JSON.stringify(nextAnnouncement),
      });
      const savedAnnouncement = normalizeAnnouncement(
        data?.announcement || data?.data?.announcement || data?.data || data,
      );
      setForm(savedAnnouncement);
      showToast("公告已保存", "success");
    } catch (requestError) {
      setError(requestError.message || "公告保存失败");
    } finally {
      setSaving(false);
    }
  };

  const toggleAnnouncement = async (enabled) => {
    const previous = form;
    const next = { ...form, enabled };
    if (enabled && !next.content.trim()) {
      setError("启用公告前请填写公告内容");
      return;
    }
    setForm(next);
    try {
      const data = await adminApiRequest("/api/admin/announcement", {
        method: "PATCH",
        body: JSON.stringify(normalizeAnnouncement({ ...next, updatedAt: new Date().toISOString() })),
      });
      setForm(normalizeAnnouncement(data?.announcement || data?.data?.announcement || data));
      showToast(enabled ? "公告已开启" : "公告已关闭", "success");
    } catch (requestError) {
      setForm(previous);
      setError(requestError.message || "公告开关保存失败");
    }
  };

  const previewAnnouncement = normalizeAnnouncement(form);

  return (
    <div className="admin-page">
      <AdminPageHeader
        eyebrow="内容管理"
        title="公告管理"
        description="创建一条全站公告，展示在公开站点登录和注册工具栏上方。"
        action={
          <span className={`admin-announcement-state ${isAnnouncementActive(previewAnnouncement) ? "active" : ""}`}>
            <span />
            {isAnnouncementActive(previewAnnouncement) ? "前台展示中" : "当前未展示"}
          </span>
        }
      />

      {error && <p className="admin-page-error" role="alert">{error}</p>}

      {loading ? (
        <AdminPanel title="公告配置">
          <div className="admin-empty-state">正在加载公告配置...</div>
        </AdminPanel>
      ) : (
        <form className="admin-announcement-layout" onSubmit={saveAnnouncement}>
          <AdminPanel
            title="公告内容"
            description="建议控制在一行内，最多 200 个字符。"
          >
            <div className="admin-setting-fields">
              <label className="admin-field">
                <span>公告内容</span>
                <textarea
                  className="admin-textarea"
                  value={form.content}
                  maxLength={200}
                  placeholder="例如：平台将于今晚 22:00 进行短暂维护。"
                  onChange={(event) => updateField("content", event.target.value)}
                />
                <small className="admin-field-hint">{form.content.length}/200</small>
              </label>
              <label className="admin-field">
                <span>跳转链接（可选）</span>
                <input
                  type="url"
                  value={form.link}
                  placeholder="https://example.com/notice"
                  onChange={(event) => updateField("link", event.target.value)}
                />
              </label>
              <label className="admin-field">
                <span>公告级别</span>
                <select
                  value={form.level}
                  onChange={(event) => updateField("level", event.target.value)}
                >
                  <option value="normal">普通公告</option>
                  <option value="important">重要公告</option>
                  <option value="risk">风险提示</option>
                </select>
              </label>
            </div>
          </AdminPanel>

          <AdminPanel
            title="展示规则"
            description="不填写日期表示立即生效或长期展示。"
          >
            <div className="admin-setting-fields">
              <label className="admin-toggle-row admin-announcement-toggle">
                <span>
                  <strong>启用公告</strong>
                  <small>启用后，符合日期条件的公告会显示在公开站点。</small>
                </span>
                <Switch
                  checked={form.enabled}
                  label="启用公告"
                  onChange={toggleAnnouncement}
                />
              </label>
              <div className="admin-announcement-date-grid">
                <label className="admin-field">
                  <span>开始日期</span>
                  <input
                    type="date"
                    value={form.startsAt}
                    onChange={(event) => updateField("startsAt", event.target.value)}
                  />
                </label>
                <label className="admin-field">
                  <span>结束日期</span>
                  <input
                    type="date"
                    value={form.endsAt}
                    onChange={(event) => updateField("endsAt", event.target.value)}
                  />
                </label>
              </div>
              <div className="admin-announcement-rule-note">
                <Megaphone size={16} />
                 <span>用户关闭公告后仅在当前页面隐藏；更新公告内容后会重新显示。</span>
              </div>
            </div>
          </AdminPanel>

          <AdminPanel
            title="前台预览"
            description="预览当前表单内容，不代表已经保存。"
            className="admin-announcement-preview-panel"
          >
            <div className={`announcement-bar announcement-${previewAnnouncement.level} admin-announcement-preview`}>
              <div className="announcement-inner">
                <div className="announcement-copy">
                  <Megaphone size={15} />
                  <span className="announcement-label">
                    {previewAnnouncement.level === "risk"
                      ? "风险提示"
                      : previewAnnouncement.level === "important"
                        ? "重要公告"
                        : "公告"}
                  </span>
                  <span>{previewAnnouncement.content || "这里显示公告内容"}</span>
                </div>
              </div>
            </div>
          </AdminPanel>

          <div className="admin-settings-footer">
            <button className="admin-primary-button" type="submit" disabled={saving}>
              {saving ? "保存中..." : "保存公告"}
              <Check size={16} />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function AdminAuditLogs({ refreshKey }) {
  const [query, setQuery] = useState("");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminApiRequest("/api/admin/audit-logs")
      .then((data) => {
        if (!cancelled) setLogs(Array.isArray(data?.logs) ? data.logs : []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const filteredLogs = logs.filter((log) => {
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
        {loading ? (
          <div className="admin-empty-state">正在加载操作日志...</div>
        ) : <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>时间</th><th>管理员</th><th>操作</th><th>目标</th><th>说明</th></tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
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
          {!filteredLogs.length && <AdminEmptyState label="暂无操作日志" />}
        </div>}
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

  const toggleMailService = async (enabled) => {
    const previous = form;
    setForm({ ...form, enabled });
    setError("");
    setSaving(true);
    try {
      const data = await adminApiRequest("/api/admin/mail-settings", {
        method: "PUT",
        body: JSON.stringify({ enabled }),
      });
      const settings = data?.settings || data?.data?.settings || data?.data || data;
      setForm({ ...DEFAULT_MAIL_SETTINGS, ...normalizeMailSettings(settings) });
      showToast(enabled ? "邮件服务已开启" : "邮件服务已关闭", "success");
    } catch (requestError) {
      setForm(previous);
      setError(requestError.message || "邮件开关保存失败");
    } finally {
      setSaving(false);
    }
  };

  const toggleMailField = async (field, value) => {
    const previous = form;
    setForm({ ...form, [field]: value });
    setSaving(true);
    setError("");
    try {
      const data = await adminApiRequest("/api/admin/mail-settings", {
        method: "PUT",
        body: JSON.stringify({ smtp: { verifySsl: value } }),
      });
      const settings = data?.settings || data?.data?.settings || data?.data || data;
      setForm({ ...DEFAULT_MAIL_SETTINGS, ...normalizeMailSettings(settings) });
      showToast(value ? "开关已开启" : "开关已关闭", "success");
    } catch (requestError) {
      setForm(previous);
      setError(requestError.message || "开关保存失败");
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    setError("");

    if (form.enabled && !form.fromAddress.trim()) {
      setError("请填写发件地址");
      return;
    }

    if (form.enabled && form.driver === "smtp") {
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
            <label className="admin-toggle-row">
              <span>
                <strong>启用邮件服务</strong>
                <small>关闭后平台不会发送邮件。</small>
              </span>
              <Switch
                checked={form.enabled}
                label="启用邮件服务"
                disabled={saving || testing}
                onChange={toggleMailService}
              />
            </label>
            <div className="admin-setting-fields">
              <label className="admin-field">
                <span>发件地址</span>
                <input
                  type="email"
                  value={form.fromAddress}
                  placeholder="no-reply@example.com"
                  required={form.enabled}
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
                  <option value="smtp">smtp</option>
                  <option value="log">log</option>
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
                <Switch
                checked={form.smtpVerifySsl}
                label="验证 SSL 证书"
                disabled={saving || testing}
                onChange={(value) => toggleMailField("smtpVerifySsl", value)}
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

function AdminUserOAuthSettings({ showToast }) {
  const siteOrigin = window.location.origin;
  const apiOrigin = API_BASE_URL || siteOrigin;
  const emptyProvider = { enabled: false, issuer: "", clientId: "", redirectUri: "", clientSecret: "", hasClientSecret: false };
  const [providers, setProviders] = useState({ google: emptyProvider, custom: emptyProvider });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApiRequest("/api/admin/user-oauth")
      .then((data) => {
        const next = { google: emptyProvider, custom: emptyProvider };
        for (const provider of data?.providers || []) next[provider.provider] = { ...next[provider.provider], ...provider, clientSecret: "" };
        setProviders(next);
      })
      .catch((requestError) => setError(requestError.message || "加载授权配置失败"))
      .finally(() => setLoading(false));
  }, []);

  const update = (provider, field, value) => setProviders((current) => ({
    ...current,
    [provider]: { ...current[provider], [field]: value },
  }));

  const toggleProvider = async (id, enabled) => {
    const previous = providers;
    const next = { ...providers, [id]: { ...providers[id], enabled } };
    setProviders(next);
    setSaving(true);
    setError("");
    try {
      const data = await adminApiRequest("/api/admin/user-oauth", {
        method: "PATCH",
        body: JSON.stringify(next),
      });
      const saved = { ...next };
      for (const provider of data?.providers || []) saved[provider.provider] = { ...saved[provider.provider], ...provider, clientSecret: "" };
      setProviders(saved);
      showToast(enabled ? "第三方登录已开启" : "第三方登录已关闭", "success");
    } catch (requestError) {
      setProviders(previous);
      setError(requestError.message || "第三方登录开关保存失败");
    } finally {
      setSaving(false);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = await adminApiRequest("/api/admin/user-oauth", {
        method: "PATCH",
        body: JSON.stringify(providers),
      });
      const next = { ...providers };
      for (const provider of data?.providers || []) next[provider.provider] = { ...next[provider.provider], ...provider, clientSecret: "" };
      setProviders(next);
      showToast("第三方登录配置已保存", "success");
    } catch (requestError) {
      setError(requestError.message || "授权配置保存失败");
    } finally {
      setSaving(false);
    }
  };

  const providerForm = (id, title, defaultIssuer, callback) => {
    const provider = providers[id];
    return (
      <AdminPanel title={title} description="启用后，前台用户登录页会显示该授权入口。">
        <label className="admin-toggle-row">
          <span><strong>启用 {title}</strong><small>仅创建或登录普通用户，不授予后台权限。</small></span>
          <Switch
            checked={provider.enabled}
            label={`启用 ${title}`}
            disabled={saving}
            onChange={(value) => toggleProvider(id, value)}
          />
        </label>
        <div className="admin-setting-fields">
          <label className="admin-field"><span>Issuer / Discovery 地址</span><small>{id === "google" ? "Google 通常填写 https://accounts.google.com。" : "填写论坛授权中心提供的 Issuer 根地址，系统会自动读取 /.well-known/openid-configuration。"}</small><input value={provider.issuer} onChange={(event) => update(id, "issuer", event.target.value)} placeholder={defaultIssuer} /></label>
          <label className="admin-field"><span>客户端 ID</span><input value={provider.clientId} onChange={(event) => update(id, "clientId", event.target.value)} /></label>
          <label className="admin-field"><span>客户端密钥</span><input type="password" value={provider.clientSecret} placeholder={provider.hasClientSecret ? "已保存，留空保持不变" : "请输入客户端密钥"} autoComplete="new-password" onChange={(event) => update(id, "clientSecret", event.target.value)} /></label>
          <label className="admin-field"><span>回调地址</span><input value={provider.redirectUri} onChange={(event) => update(id, "redirectUri", event.target.value)} placeholder={callback} /></label>
        </div>
      </AdminPanel>
    );
  };

  if (loading) return <div className="admin-page"><AdminPageHeader title="第三方登录" /><AdminPanel title="登录配置"><div className="admin-empty-state">正在加载配置...</div></AdminPanel></div>;

  return <div className="admin-page">
    <AdminPageHeader eyebrow="用户访问" title="第三方登录" description="配置普通用户使用 Google 或自建身份平台登录。" />
    <form className="admin-settings-layout" onSubmit={save}>
      {providerForm("google", "Google", "https://accounts.google.com", `${apiOrigin}/api/auth/user/oauth/google/callback`)}
      {providerForm("custom", "自建身份平台", "https://forum.example.com", `${apiOrigin}/api/auth/user/oauth/custom/callback`)}
      {error && <p className="admin-form-error">{error}</p>}
      <div className="admin-settings-footer"><button className="admin-primary-button" type="submit" disabled={saving}>{saving ? "保存中..." : "保存配置"}<Check size={16} /></button></div>
    </form>
  </div>;
}

function AdminSettings({ session, showToast }) {
  const [settings, setSettings] = useState(DEFAULT_ADMIN_SETTINGS);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    adminApiRequest("/api/admin/settings")
      .then((data) => {
        if (cancelled) return;
        const nextSettings = {
          ...DEFAULT_ADMIN_SETTINGS,
          ...(data?.settings || data?.data?.settings || data?.data || data),
        };
        setSettings(nextSettings);
      })
      .catch((requestError) => setError(requestError.message || "系统设置加载失败"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

    const nextSettings = {
      ...settings,
      merchantDealTotalLimit: normalizeLimitValue(
        settings.merchantDealTotalLimit,
        DEFAULT_ADMIN_SETTINGS.merchantDealTotalLimit,
      ),
      merchantDealPublicLimit: normalizeLimitValue(
        settings.merchantDealPublicLimit,
        DEFAULT_ADMIN_SETTINGS.merchantDealPublicLimit,
      ),
      merchantDealDailyLimit: normalizeLimitValue(
        settings.merchantDealDailyLimit,
        DEFAULT_ADMIN_SETTINGS.merchantDealDailyLimit,
      ),
      preventDuplicateMerchantCodes: settings.preventDuplicateMerchantCodes !== false,
      showGithubLink: settings.showGithubLink !== false,
      githubUrl: GITHUB_REPOSITORY_URL,
    };

    setSaving(true);
    try {
      await adminApiRequest("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({
          ...nextSettings,
          ...(password ? { password } : {}),
        }),
      });
      setSettings(nextSettings);
      setPassword("");
      setPasswordConfirm("");
      showToast("系统设置已保存", "success");
    } catch (requestError) {
      setError(requestError.message || "系统设置保存失败");
    } finally {
      setSaving(false);
    }
  };

  const updateLimitSetting = (field, value) => {
    setSettings({
      ...settings,
      [field]: normalizeLimitValue(value, DEFAULT_ADMIN_SETTINGS[field]),
    });
  };

  const toggleSetting = async (field, value) => {
    const previous = settings;
    const next = { ...settings, [field]: value };
    setSettings(next);
    setSaving(true);
    setError("");
    try {
      await adminApiRequest("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ [field]: value }),
      });
      showToast(value ? "开关已开启" : "开关已关闭", "success");
    } catch (requestError) {
      setSettings(previous);
      setError(requestError.message || "开关保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="admin-page"><AdminPageHeader title="系统设置" /><AdminPanel title="系统设置"><div className="admin-empty-state">正在加载配置...</div></AdminPanel></div>;

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
              <strong>允许用户注册</strong>
              <small>关闭后，公开站点将暂时停止创建新账号。</small>
            </span>
            <Switch
              checked={settings.allowUserRegistration}
              label="允许用户注册"
              disabled={saving}
              onChange={(value) => toggleSetting("allowUserRegistration", value)}
            />
          </label>
          <div className="admin-setting-status">
            <span className="admin-system-dot" />
            公开站点状态：{settings.siteStatus}
          </div>
        </AdminPanel>
        <AdminPanel title="站点信息" description="管理公开站点顶部的项目入口和版本信息。">
          <label className="admin-toggle-row">
            <span>
              <strong>显示 GitHub 仓库入口</strong>
              <small>关闭后，公开站点顶部将隐藏 GitHub 图标。</small>
            </span>
            <Switch
              checked={settings.showGithubLink !== false}
              label="显示 GitHub 仓库入口"
              disabled={saving}
              onChange={(value) => toggleSetting("showGithubLink", value)}
            />
          </label>
          <div className="admin-setting-fields admin-site-info-fields">
            <label className="admin-field">
              <span>GitHub 仓库地址</span>
              <input value={GITHUB_REPOSITORY_URL} readOnly />
            </label>
            <label className="admin-field">
              <span>当前版本</span>
              <input value={`v${APP_VERSION}`} readOnly />
            </label>
          </div>
        </AdminPanel>
        <AdminPanel
          title="创建优惠限制"
          description="控制单个用户可保留和公开展示的优惠码数量。"
        >
          <div className="admin-setting-fields">
            <label className="admin-field">
              <span>累计优惠码上限</span>
              <input
                type="number"
                min="0"
                value={settings.merchantDealTotalLimit}
                onChange={(event) =>
                  updateLimitSetting("merchantDealTotalLimit", event.target.value)
                }
              />
            </label>
            <label className="admin-field">
              <span>公开展示上限</span>
              <input
                type="number"
                min="0"
                value={settings.merchantDealPublicLimit}
                onChange={(event) =>
                  updateLimitSetting("merchantDealPublicLimit", event.target.value)
                }
              />
            </label>
            <label className="admin-field">
              <span>每日新增上限</span>
              <input
                type="number"
                min="0"
                value={settings.merchantDealDailyLimit}
                onChange={(event) =>
                  updateLimitSetting("merchantDealDailyLimit", event.target.value)
                }
              />
            </label>
            <label className="admin-toggle-row admin-setting-inline-toggle">
              <span>
                <strong>禁止同商户重复优惠码</strong>
                <small>同一商户下，相同 code 只能保留一条。</small>
              </span>
              <Switch
                checked={settings.preventDuplicateMerchantCodes !== false}
                label="禁止同商户重复优惠码"
                disabled={saving}
                onChange={(value) => toggleSetting("preventDuplicateMerchantCodes", value)}
              />
            </label>
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

function MerchantDashboard({ session, navigate, showToast }) {
  const [account, setAccount] = useState({
    id: session.accountId,
    email: session.email,
    storeName: session.merchant?.storeName || session.storeName || "",
    website: session.merchant?.website || "",
  });
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => createEmptyDealForm(account));

  const refresh = () => {
    setLoading(true);
    return apiRequest("/api/user/deals")
      .then((data) => {
        const merchant = data?.merchant;
        if (merchant) {
          setAccount(merchant);
          setForm((current) => ({
            ...current,
            storeName: current.storeName || merchant.storeName || "",
            website: current.website || merchant.website || "",
          }));
        }
        setDeals(Array.isArray(data?.deals) ? data.deals : []);
      })
      .catch((error) => showToast(error.message || "优惠码加载失败"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, [session.accountId]);

  const submit = async (event) => {
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

    setSubmitting(true);
    try {
      const data = await apiRequest(
        editing ? `/api/user/deals/${editing}` : "/api/user/deals",
        {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify({
            storeName,
            website,
            code: form.code.trim(),
            offer: form.offer.trim(),
            dealType: form.dealType,
            discountValue: form.discountValue.trim(),
            terms: form.terms.trim(),
            endAt: form.endAt || null,
          }),
        },
      );
      const updatedAccount = data?.merchant || account;
      setAccount(updatedAccount);
      setForm(createEmptyDealForm(updatedAccount));
      setEditing(null);
      await refresh();
      showToast(editing ? "优惠码已更新" : "优惠码已发布", "success");
    } catch (error) {
      showToast(error.message || "优惠码保存失败");
    } finally {
      setSubmitting(false);
    }
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

  const toggleDeal = async (id) => {
    try {
      await apiRequest(`/api/user/deals/${id}/toggle`, { method: "POST" });
      await refresh();
      showToast("优惠码状态已更新", "success");
    } catch (error) {
      showToast(error.message || "优惠码状态更新失败");
    }
  };

  return (
    <main className="merchant-main">
      <section className="merchant-topline">
        <div className="wrapper merchant-topline-inner">
          <div>
            <p className="eyebrow">用户中心</p>
            <h1>{account?.storeName || form.storeName || session.storeName || "用户中心"}</h1>
            <p>管理你创建的优惠码，保存后立即公开展示。</p>
          </div>
        </div>
      </section>

      <section className="merchant-workspace wrapper">
        <div className="form-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">{editing ? "编辑优惠码" : "新增优惠码"}</span>
              <h2>{editing ? "编辑优惠码" : "创建优惠码"}</h2>
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
                官网地址：{form.website || "请填写 HTTPS 官网地址"}
              </span>
              <button className="primary-button" type="submit" disabled={submitting}>
                {submitting ? "保存中..." : editing ? "保存修改" : "立即创建"}
                <Plus size={16} />
              </button>
            </div>
          </form>
        </div>

        <div className="merchant-list-section">
          <div className="section-heading compact">
            <div>
              <span className="section-kicker">我的优惠码</span>
              <h2>我的优惠码</h2>
            </div>
            <span className="result-count">{deals.length} 条</span>
          </div>
          {loading ? (
            <div className="merchant-empty">正在加载优惠码...</div>
          ) : deals.length === 0 ? (
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
