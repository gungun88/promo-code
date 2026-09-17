import { createServer } from "node:http";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import nodemailer from "nodemailer";
import { closeDatabase, initDatabase, query, withTransaction } from "./db.mjs";

const PORT = Number(process.env.API_PORT || 8000);
const NODE_ENV = process.env.NODE_ENV || "development";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const MAX_BODY_BYTES = 1_048_576;
const VERIFY_CODE_MAX_ATTEMPTS = 5;
const VERIFY_CODE_LOCK_SECONDS = 15 * 60;
const VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;
const PASSWORD_RESET_COOLDOWN_SECONDS = 60;
const AUTH_IP_WINDOW_MS = 15 * 60 * 1000;
const authRateBuckets = new Map();
const ADMIN_EMAIL = String(
  process.env.ADMIN_EMAIL || (NODE_ENV === "production" ? "" : "admin@promo-code.local"),
)
  .trim()
  .toLowerCase();
const ADMIN_PASSWORD = String(
  process.env.ADMIN_PASSWORD || (NODE_ENV === "production" ? "" : "admin123456"),
);
const MAIL_DRIVER = String(
  process.env.MAIL_DRIVER || (NODE_ENV === "production" ? "smtp" : "log"),
).trim().toLowerCase();
const GITHUB_REPOSITORY_URL = "https://github.com/lowseekai/promo-code";
const FRONTEND_ORIGINS = new Set(
  (process.env.FRONTEND_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

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

if (NODE_ENV === "production" && (!ADMIN_EMAIL || ADMIN_PASSWORD.length < 16)) {
  throw new Error("Production requires ADMIN_EMAIL and an ADMIN_PASSWORD with at least 16 characters.");
}

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString("hex");
}

function createPasswordRecord(password) {
  const salt = randomBytes(16).toString("hex");
  return { salt, hash: hashPassword(password, salt) };
}

function verifyPassword(password, row) {
  if (!row?.password_hash || !row?.password_salt) return false;
  const actual = Buffer.from(hashPassword(password, row.password_salt), "hex");
  const expected = Buffer.from(row.password_hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function makeToken() {
  return randomBytes(32).toString("hex");
}

function getClientAddress(request) {
  const remoteAddress = request.socket?.remoteAddress || "unknown";
  const forwardedFor = String(request.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  if (
    forwardedFor &&
    (remoteAddress === "127.0.0.1" ||
      remoteAddress === "::1" ||
      remoteAddress === "::ffff:127.0.0.1")
  ) {
    return forwardedFor;
  }
  return remoteAddress;
}

function consumeAuthIpLimit(request, action, maxAttempts) {
  const now = Date.now();
  const key = `${action}:${getClientAddress(request)}`;
  const current = authRateBuckets.get(key);
  if (!current || current.resetAt <= now) {
    authRateBuckets.set(key, { count: 1, resetAt: now + AUTH_IP_WINDOW_MS });
  } else {
    current.count += 1;
    if (current.count > maxAttempts) {
      return Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    }
  }

  if (authRateBuckets.size > 10_000) {
    for (const [bucketKey, bucket] of authRateBuckets) {
      if (bucket.resetAt <= now) authRateBuckets.delete(bucketKey);
    }
  }
  return 0;
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeWebsite(value) {
  const input = String(value || "").trim();
  if (!input) throw new Error("官网地址不能为空");
  const parsed = new URL(input);
  if (parsed.protocol !== "https:") throw new Error("官网地址必须使用 HTTPS");
  if (!parsed.hostname || !/^[a-z0-9.-]+$/i.test(parsed.hostname)) {
    throw new Error("官网地址格式不正确");
  }
  return parsed.toString().replace(/\/$/, "");
}

function normalizeHostname(value) {
  return new URL(normalizeWebsite(value)).hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function dateOnly(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : value;
}

function parsePagination(url, defaultLimit = 20, maxLimit = 100) {
  const requestedPage = Number.parseInt(url.searchParams.get("page") || "1", 10);
  const requestedLimit = Number.parseInt(
    url.searchParams.get("limit") || String(defaultLimit),
    10,
  );
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit =
    Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, maxLimit)
      : defaultLimit;
  return { page, limit, offset: (page - 1) * limit };
}

function merchantFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    storeName: row.store_name,
    website: row.website,
    emailVerified: row.email_verified,
    status: row.status,
    adminStatus: row.admin_status,
    dealCount: Number(row.deal_count || 0),
    createdAt: toIso(row.created_at),
  };
}

function userFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    emailVerified: row.email_verified === true,
    createdAt: toIso(row.created_at),
  };
}

function dealFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    storeName: row.store_name,
    website: row.website,
    code: row.code,
    offer: row.offer,
    dealType: row.deal_type,
    discountValue: String(row.discount_value),
    terms: row.terms,
    endAt: dateOnly(row.end_at),
    status: row.status,
    adminStatus: row.admin_status,
    adminRemovalReason: row.admin_removal_reason,
    copyCount: row.copy_count,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    ownerEmail: row.owner_email,
    ownerId: row.merchant_id,
  };
}

function reportFromRow(row) {
  return {
    id: row.id,
    dealId: row.promo_code_id,
    code: row.code,
    storeName: row.store_name,
    website: row.website,
    userEmail: row.user_email,
    reason: row.reason,
    status: row.status,
    createdAt: toIso(row.created_at),
    handledAt: toIso(row.handled_at),
  };
}

function filterFromRow(row) {
  return {
    id: row.id,
    matchType: row.match_type,
    hostname: row.hostname,
    keyword: row.keyword,
    reason: row.reason,
    status: row.status,
    createdBy: row.created_by_email || "system",
    createdAt: toIso(row.created_at),
  };
}

function getCookies(request) {
  return Object.fromEntries(
    (request.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return index < 0
          ? [part, ""]
          : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

function getToken(request, type) {
  const authorization = request.headers.authorization || "";
  if (authorization.startsWith("Bearer ")) return authorization.slice(7);
  return getCookies(request)[`${type}_session`] || "";
}

async function getPrincipal(request, type) {
  const token = getToken(request, type);
  if (!token) return null;
  const result = await query(
    `SELECT principal_id
       FROM sessions
      WHERE token_hash = $1 AND principal_type = $2 AND expires_at > now()`,
    [hashToken(token), type],
  );
  return result.rows[0]?.principal_id || null;
}

async function getAdmin(request) {
  const id = await getPrincipal(request, "admin");
  if (!id) return null;
  const result = await query("SELECT * FROM admin_users WHERE id = $1", [id]);
  return result.rows[0] || null;
}

async function getMerchant(request) {
  const user = await getUser(request);
  if (!user || user.email_verified !== true) return null;
  const result = await query("SELECT * FROM merchants WHERE user_id = $1", [user.id]);
  if (result.rows[0]) return result.rows[0];
  return withTransaction((client) => getOrCreateUserMerchant(client, user, "", ""));
}

async function getUser(request) {
  const id = await getPrincipal(request, "user");
  if (!id) return null;
  const result = await query("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows[0] || null;
}

async function getOrCreateUserMerchant(client, user, storeName, website) {
  const existing = await client.query(
    "SELECT * FROM merchants WHERE user_id = $1 FOR UPDATE",
    [user.id],
  );
  if (existing.rowCount) {
    const current = existing.rows[0];
    if (storeName || website) {
      const updated = await client.query(
        `UPDATE merchants
            SET store_name = COALESCE(NULLIF($1, ''), store_name),
                website = COALESCE(NULLIF($2, ''), website)
          WHERE id = $3
        RETURNING *`,
        [storeName, website, current.id],
      );
      return updated.rows[0];
    }
    return current;
  }

  const legacy = await client.query(
    "SELECT * FROM merchants WHERE email = $1 AND user_id IS NULL FOR UPDATE",
    [user.email],
  );
  if (legacy.rowCount) {
    const linked = await client.query(
      `UPDATE merchants
          SET user_id = $1, store_name = COALESCE(NULLIF($2, ''), store_name),
              website = COALESCE(NULLIF($3, ''), website),
              email_verified = true, status = 'active'
        WHERE id = $4
      RETURNING *`,
      [user.id, storeName, website, legacy.rows[0].id],
    );
    return linked.rows[0];
  }

  const inserted = await client.query(
    `INSERT INTO merchants
      (user_id, email, password_hash, password_salt, store_name, website, email_verified, status)
     VALUES ($1, $2, $3, $4, $5, $6, true, 'active')
     RETURNING *`,
    [user.id, user.email, user.password_hash, user.password_salt, storeName, website],
  );
  return inserted.rows[0];
}

function setSessionCookie(response, type, token) {
  const secure = NODE_ENV === "production" ? " Secure;" : "";
  response.setHeader(
    "Set-Cookie",
    `${type}_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS};${secure}`,
  );
}

function clearSessionCookie(response, type) {
  response.setHeader(
    "Set-Cookie",
    `${type}_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
  );
}

function sendJson(response, status, payload, request) {
  const origin = request.headers.origin;
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  };
  if (origin && (FRONTEND_ORIGINS.has(origin) || NODE_ENV !== "production")) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }
  response.writeHead(status, headers);
  response.end(JSON.stringify(payload));
}

function sendError(response, status, message, request) {
  sendJson(response, status, { message }, request);
}

function sendRateLimitError(response, retryAfterSeconds, message, request) {
  response.setHeader("Retry-After", String(retryAfterSeconds));
  sendError(response, 429, message, request);
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function readBody(request, maxBytes = MAX_BODY_BYTES) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      throw httpError(413, "请求体过大");
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  let value;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw httpError(400, "请求体必须是有效 JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw httpError(400, "请求体必须是 JSON 对象");
  }
  return value;
}

function requirePrincipal(principal, response, request, message) {
  if (principal) return true;
  sendError(response, 401, message, request);
  return false;
}

async function createSession(type, principalId, response) {
  const token = makeToken();
  await query(
    `INSERT INTO sessions (token_hash, principal_type, principal_id, expires_at)
     VALUES ($1, $2, $3, now() + interval '8 hours')`,
    [hashToken(token), type, principalId],
  );
  setSessionCookie(response, type, token);
}

async function destroySession(request, response, type) {
  const token = getToken(request, type);
  if (token) await query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
  clearSessionCookie(response, type);
}

async function getSetting(key, fallback) {
  const result = await query("SELECT value FROM app_settings WHERE key = $1", [key]);
  return result.rows[0]?.value ?? fallback;
}

function defaultMailSettings() {
  return {
    fromAddress: process.env.MAIL_FROM || "",
    contentFormat: "multipart",
    driver: MAIL_DRIVER,
    smtp: {
      host: process.env.MAIL_HOST || "",
      port: Number(process.env.MAIL_PORT || 587),
      encryption: process.env.MAIL_ENCRYPTION || "tls",
      username: process.env.MAIL_USERNAME || "",
      password: process.env.MAIL_PASSWORD || "",
      verifySsl: true,
    },
    testRecipient: "",
  };
}

function normalizeMailSettings(value = {}, fallback = defaultMailSettings()) {
  const smtp = value.smtp || {};
  const fallbackSmtp = fallback.smtp || {};
  const driver = String(value.driver || fallback.driver || MAIL_DRIVER).trim().toLowerCase();
  return {
    fromAddress: String(value.fromAddress ?? fallback.fromAddress ?? "").trim(),
    contentFormat: ["multipart", "plain", "html"].includes(value.contentFormat)
      ? value.contentFormat
      : fallback.contentFormat,
    driver: ["smtp", "log", "null"].includes(driver) ? driver : fallback.driver || "smtp",
    smtp: {
      host: String(smtp.host ?? fallbackSmtp.host ?? "").trim(),
      port: Number.isInteger(Number(smtp.port ?? fallbackSmtp.port ?? 587))
        ? Number(smtp.port ?? fallbackSmtp.port ?? 587)
        : 587,
      encryption: ["tls", "ssl", ""].includes(smtp.encryption)
        ? smtp.encryption
        : fallbackSmtp.encryption || "tls",
      username: String(smtp.username ?? fallbackSmtp.username ?? "").trim(),
      password: String(smtp.password ?? fallbackSmtp.password ?? ""),
      verifySsl: smtp.verifySsl !== false,
    },
    testRecipient: String(value.testRecipient ?? fallback.testRecipient ?? "").trim(),
  };
}

async function getMailSettings() {
  const stored = await getSetting("mailSettings", null);
  return normalizeMailSettings(stored || {}, defaultMailSettings());
}

function safeMailSettings(settings) {
  const safe = structuredClone(settings);
  if (safe.smtp) {
    safe.smtp.hasPassword = Boolean(safe.smtp.password);
    delete safe.smtp.password;
  }
  return safe;
}

async function getAdminSettingsPayload() {
  return {
    allowUserRegistration: await getSetting(
      "allowUserRegistration",
      await getSetting("allowMerchantRegistration", true),
    ),
    siteStatus: await getSetting("siteStatus", "正常运行"),
    showGithubLink: await getSetting("showGithubLink", true),
    merchantDealTotalLimit: await getSetting("merchantDealTotalLimit", 50),
    merchantDealPublicLimit: await getSetting("merchantDealPublicLimit", 10),
    merchantDealDailyLimit: await getSetting("merchantDealDailyLimit", 5),
    preventDuplicateMerchantCodes: await getSetting("preventDuplicateMerchantCodes", true),
    githubUrl: GITHUB_REPOSITORY_URL,
  };
}

async function setSetting(key, value) {
  await query(
    `INSERT INTO app_settings (key, value) VALUES ($1, $2::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    [key, JSON.stringify(value)],
  );
}

function normalizeAnnouncement(value = {}) {
  return {
    ...DEFAULT_ANNOUNCEMENT,
    ...(value || {}),
    id: "site-announcement",
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

function isAnnouncementActive(announcement) {
  if (!announcement.enabled || !announcement.content) return false;
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

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

async function addAuditLog(admin, action, targetType, targetId, description) {
  await query(
    `INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, description)
     VALUES ($1, $2, $3, $4, $5)`,
    [admin?.id || null, action, targetType, String(targetId), description],
  );
}

async function getActiveFilters() {
  const result = await query(
    `SELECT f.*, a.email AS created_by_email
       FROM website_filters f
       LEFT JOIN admin_users a ON a.id = f.created_by
      WHERE f.status = 'active'
      ORDER BY f.created_at DESC`,
  );
  return result.rows;
}

function matchesFilter(website, filters) {
  const normalizedWebsite = String(website || "").toLowerCase();
  let hostname = "";
  try {
    hostname = new URL(website).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return true;
  }
  return filters.some((filter) => {
    if (filter.match_type === "keyword") {
      return filter.keyword && normalizedWebsite.includes(filter.keyword.toLowerCase());
    }
    return (
      filter.hostname &&
      (hostname === filter.hostname || hostname.endsWith(`.${filter.hostname}`))
    );
  });
}

async function sendMail(to, subject, text, html) {
  const settings = await getMailSettings();
  const driver = settings.driver;
  if (driver === "null") return;
  if (driver === "log") {
    console.log(`[mail] ${to}: ${text}`);
    return;
  }

  const host = settings.smtp.host;
  const port = settings.smtp.port;
  const username = settings.smtp.username;
  const password = settings.smtp.password;
  const from = settings.fromAddress || username;
  if (!host || !username || !password || !from) {
    throw new Error("邮箱服务未配置，请先配置 MAIL_HOST、MAIL_USERNAME、MAIL_PASSWORD 和 MAIL_FROM");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: settings.smtp.encryption === "ssl" || port === 465,
    requireTLS: settings.smtp.encryption !== "ssl" && port !== 465,
    auth: { user: username, pass: password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    tls: { rejectUnauthorized: settings.smtp.verifySsl },
  });
  await transporter.sendMail({ from, to, subject, text, html });
}

async function sendUserVerificationEmail(email, token, code) {
  const baseUrl = String(
    process.env.EMAIL_VERIFICATION_BASE_URL || process.env.FRONTEND_ORIGINS?.split(",")[0] || "",
  ).replace(/\/$/, "");
  const url = `${baseUrl}/user/verify?token=${encodeURIComponent(token)}`;
  await sendMail(
    email,
    "验证你的 promo-code 用户账号",
    `请使用验证码 ${code}，或打开以下链接完成邮箱验证：${url}`,
    `<p>你的 promo-code 邮箱验证码是：</p><p><strong>${code}</strong></p><p><a href="${url}">点击完成邮箱验证</a></p>`,
  );
  return url;
}

async function sendPasswordResetEmail(email, token) {
  const baseUrl = String(
    process.env.EMAIL_VERIFICATION_BASE_URL || process.env.FRONTEND_ORIGINS?.split(",")[0] || "",
  ).replace(/\/$/, "");
  const url = `${baseUrl}/user/reset-password?token=${encodeURIComponent(token)}`;
  await sendMail(
    email,
    "重置你的 promo-code 密码",
    `请打开以下链接重置密码：${url}`,
    `<p>请点击以下链接重置你的 promo-code 密码：</p><p><a href="${url}">重置密码</a></p>`,
  );
  return url;
}

async function ensureAdmin() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    if (NODE_ENV === "production") throw new Error("管理员账号未配置");
    return;
  }
  const existing = await query("SELECT id FROM admin_users LIMIT 1");
  if (existing.rowCount) return;
  const record = createPasswordRecord(ADMIN_PASSWORD);
  await query(
    `INSERT INTO admin_users (email, name, password_hash, password_salt)
     VALUES ($1, $2, $3, $4)`,
    [ADMIN_EMAIL, "平台管理员", record.hash, record.salt],
  );
}

async function ensureDevelopmentAccounts() {
  if (NODE_ENV === "production") return;

  const userEmail = "user@promo-code.local";
  const userExists = await query("SELECT id FROM users WHERE email = $1", [userEmail]);
  if (!userExists.rowCount) {
    const record = createPasswordRecord("user123456");
    await query(
      `INSERT INTO users (email, password_hash, password_salt, email_verified)
       VALUES ($1, $2, $3, true)`,
      [userEmail, record.hash, record.salt],
    );
  }
  await query("UPDATE users SET email_verified = true WHERE email = $1", [userEmail]);

  const userResult = await query("SELECT * FROM users WHERE email = $1", [userEmail]);
  const user = userResult.rows[0];
  await withTransaction(async (client) => {
    const merchant = await getOrCreateUserMerchant(
      client,
      user,
      "Grammarly",
      "https://www.grammarly.com",
    );
    const demoDeals = [
      {
        code: "WELCOME20",
        offer: "新用户首单 8 折",
        discountValue: 20,
        terms: "本地演示数据，仅供查看效果",
        endAt: "2026-12-31",
      },
      {
        code: "PRO15",
        offer: "Pro 方案立减 15%",
        discountValue: 15,
        terms: "本地演示数据，结算页以官网规则为准",
        endAt: "2026-11-30",
      },
      {
        code: "STUDENT10",
        offer: "学生用户额外 9 折",
        discountValue: 10,
        terms: "本地演示数据，仅限符合条件的用户",
        endAt: "2027-01-31",
      },
    ];

    for (const deal of demoDeals) {
      await client.query(
        `INSERT INTO promo_codes
          (merchant_id, code, offer, deal_type, discount_value, terms, end_at, status, admin_status)
         VALUES ($1, $2, $3, 'percentage', $4, $5, $6, 'published', 'normal')
         ON CONFLICT (merchant_id, lower(code)) DO UPDATE
           SET offer = EXCLUDED.offer,
               deal_type = EXCLUDED.deal_type,
               discount_value = EXCLUDED.discount_value,
               terms = EXCLUDED.terms,
               end_at = EXCLUDED.end_at,
               status = 'published',
               admin_status = 'normal',
               admin_removal_reason = ''`,
        [
          merchant.id,
          deal.code,
          deal.offer,
          deal.discountValue,
          deal.terms,
          deal.endAt,
        ],
      );
    }
  });
}

async function getPublicDeals(url, request) {
  const params = [];
  const conditions = [
    "p.status = 'published'",
    "p.admin_status <> 'removed'",
    "m.email_verified = true",
    "m.status = 'active'",
    "m.admin_status <> 'suspended'",
    "(p.end_at IS NULL OR p.end_at >= CURRENT_DATE)",
    `NOT EXISTS (
      SELECT 1
        FROM website_filters f
       WHERE f.status = 'active'
         AND (
           (
             f.match_type = 'keyword'
             AND f.keyword <> ''
             AND lower(m.website) LIKE '%' || lower(f.keyword) || '%'
           )
           OR (
             f.match_type = 'domain'
             AND f.hostname <> ''
             AND (
               lower(regexp_replace(regexp_replace(regexp_replace(regexp_replace(m.website, '^https?://', ''), '^www\\.', ''), '/.*$', ''), ':.*$', '')) = lower(f.hostname)
               OR lower(regexp_replace(regexp_replace(regexp_replace(regexp_replace(m.website, '^https?://', ''), '^www\\.', ''), '/.*$', ''), ':.*$', '')) LIKE '%.' || lower(f.hostname)
             )
           )
         )
    )`,
  ];
  const search = String(url.searchParams.get("q") || "").trim().toLowerCase();
  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(lower(p.code) LIKE $${params.length} OR lower(p.offer) LIKE $${params.length} OR lower(m.store_name) LIKE $${params.length} OR lower(p.terms) LIKE $${params.length})`,
    );
  }
  const { page, limit, offset } = parsePagination(url, 20, 100);
  const sort = url.searchParams.get("sort");
  const orderBy =
    sort === "ending"
      ? "p.end_at ASC NULLS LAST, p.created_at DESC"
      : sort === "latest"
        ? "p.created_at DESC"
        : "p.discount_value DESC, p.created_at DESC";
  const whereSql = conditions.join(" AND ");
  params.push(limit, offset);
  const result = await query(
    `SELECT p.*, m.store_name, m.website, m.email AS owner_email
       FROM promo_codes p
       JOIN merchants m ON m.id = p.merchant_id
      WHERE ${whereSql}
      ORDER BY ${orderBy}
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const total = await query(
    `SELECT COUNT(*)::int AS total
       FROM promo_codes p
       JOIN merchants m ON m.id = p.merchant_id
      WHERE ${whereSql}`,
    params.slice(0, -2),
  );
  const deals = result.rows.map(dealFromRow);
  const user = await getUser(request);
  let favoriteIds = [];
  if (user) {
    const favorites = await query("SELECT promo_code_id FROM favorites WHERE user_id = $1", [user.id]);
    favoriteIds = favorites.rows.map((row) => row.promo_code_id);
  }
  const totalCount = Number(total.rows[0]?.total || 0);
  return {
    deals,
    favoriteIds,
    page,
    limit,
    total: totalCount,
    hasMore: offset + deals.length < totalCount,
  };
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const path = url.pathname;

  if (request.method === "OPTIONS") {
    sendJson(response, 204, {}, request);
    return;
  }

  if (request.method === "GET" && path === "/api/health") {
    await query("SELECT 1");
    sendJson(response, 200, { ok: true }, request);
    return;
  }

  if (request.method === "GET" && path === "/api/settings/public") {
    sendJson(
      response,
      200,
      {
        allowUserRegistration: await getSetting(
          "allowUserRegistration",
          await getSetting("allowMerchantRegistration", true),
        ),
        showGithubLink: await getSetting("showGithubLink", true),
        githubUrl: GITHUB_REPOSITORY_URL,
      },
      request,
    );
    return;
  }

  if (request.method === "GET" && path === "/api/announcement") {
    const announcement = normalizeAnnouncement(
      await getSetting("announcement", DEFAULT_ANNOUNCEMENT),
    );
    sendJson(
      response,
      200,
      {
        announcement: isAnnouncementActive(announcement)
          ? announcement
          : DEFAULT_ANNOUNCEMENT,
      },
      request,
    );
    return;
  }

  if (request.method === "GET" && path === "/api/deals") {
    sendJson(response, 200, await getPublicDeals(url, request), request);
    return;
  }

  const copyMatch = path.match(/^\/api\/deals\/([^/]+)\/copy$/);
  if (request.method === "POST" && copyMatch) {
    const result = await query(
      `UPDATE promo_codes
          SET copy_count = copy_count + 1, updated_at = now()
        WHERE id = $1
      RETURNING copy_count`,
      [copyMatch[1]],
    );
    if (!result.rowCount) {
      sendError(response, 404, "优惠码不存在", request);
      return;
    }
    sendJson(response, 200, { copyCount: result.rows[0].copy_count }, request);
    return;
  }

  if (request.method === "POST" && path === "/api/auth/user/register") {
    const body = await readBody(request);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!isEmail(email) || password.length < 8) {
      sendError(response, 400, "请输入有效邮箱和至少 8 位密码", request);
      return;
    }
    if (
      !(await getSetting(
        "allowUserRegistration",
        await getSetting("allowMerchantRegistration", true),
      ))
    ) {
      sendError(response, 403, "平台暂时关闭了用户注册", request);
      return;
    }
    const mailSettings = await getMailSettings();
    if (
      NODE_ENV === "production" &&
      (mailSettings.driver !== "smtp" ||
        !mailSettings.smtp.host ||
        !mailSettings.smtp.username ||
        !mailSettings.smtp.password ||
        !(mailSettings.fromAddress || mailSettings.smtp.username))
    ) {
      sendError(response, 503, "邮箱服务尚未配置", request);
      return;
    }
    const record = createPasswordRecord(password);
    const token = makeToken();
    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    try {
      const result = await withTransaction(async (client) => {
        const inserted = await client.query(
          `INSERT INTO users (email, password_hash, password_salt, email_verified)
           VALUES ($1, $2, $3, false)
           RETURNING *`,
          [email, record.hash, record.salt],
        );
        await client.query(
          `UPDATE verification_tokens
              SET used_at = now()
            WHERE user_id = $1 AND used_at IS NULL`,
          [inserted.rows[0].id],
        );
        await client.query(
          `INSERT INTO verification_tokens
            (token_hash, user_id, verification_code, expires_at)
           VALUES ($1, $2, $3, now() + interval '24 hours')`,
          [hashToken(token), inserted.rows[0].id, verificationCode],
        );
        await client.query(
          "UPDATE users SET verification_sent_at = now() WHERE id = $1",
          [inserted.rows[0].id],
        );
        const verificationUrl = await sendUserVerificationEmail(email, token, verificationCode);
        return { user: inserted.rows[0], verificationUrl };
      });
      sendJson(
        response,
        201,
        {
          user: userFromRow(result.user),
          message: "注册成功，请前往邮箱激活账号或输入验证码",
          ...(NODE_ENV !== "production"
            ? { verificationUrl: result.verificationUrl, verificationCode }
            : {}),
        },
        request,
      );
    } catch (error) {
      if (error.code === "23505") sendError(response, 409, "这个邮箱已经注册", request);
      else throw error;
    }
    return;
  }

  if (request.method === "GET" && path === "/api/auth/user/verify") {
    const token = String(url.searchParams.get("token") || "");
    if (!token) {
      sendError(response, 400, "验证链接无效", request);
      return;
    }
    const result = await query(
      `UPDATE users u
          SET email_verified = true,
              verified_at = now(),
              verification_failed_attempts = 0,
              verification_locked_until = NULL
        FROM verification_tokens v
       WHERE v.token_hash = $1
         AND v.user_id = u.id
         AND v.used_at IS NULL
         AND v.expires_at > now()
      RETURNING u.*`,
      [hashToken(token)],
    );
    if (!result.rowCount) {
      sendError(response, 400, "验证链接已失效或已使用", request);
      return;
    }
    await query("UPDATE verification_tokens SET used_at = now() WHERE token_hash = $1", [
      hashToken(token),
    ]);
    await createSession("user", result.rows[0].id, response);
    sendJson(response, 200, { user: userFromRow(result.rows[0]) }, request);
    return;
  }

  if (request.method === "POST" && path === "/api/auth/user/verify-code") {
    const body = await readBody(request);
    const email = String(body.email || "").trim().toLowerCase();
    const code = String(body.code || "").trim();
    if (!isEmail(email) || !/^\d{6}$/.test(code)) {
      sendError(response, 400, "请输入有效邮箱和 6 位验证码", request);
      return;
    }
    const retryAfter = consumeAuthIpLimit(request, "verify-code", 30);
    if (retryAfter) {
      sendRateLimitError(response, retryAfter, "验证请求过于频繁，请稍后再试", request);
      return;
    }
    const result = await withTransaction(async (client) => {
      const userResult = await client.query(
        "SELECT * FROM users WHERE email = $1 FOR UPDATE",
        [email],
      );
      const user = userResult.rows[0];
      if (!user) return { kind: "invalid" };
      if (user.email_verified) return { kind: "verified", user };
      if (
        user.verification_locked_until &&
        new Date(user.verification_locked_until).getTime() > Date.now()
      ) {
        return {
          kind: "locked",
          retryAfter: Math.max(
            1,
            Math.ceil((new Date(user.verification_locked_until).getTime() - Date.now()) / 1000),
          ),
        };
      }

      const tokenResult = await client.query(
        `SELECT token_hash
           FROM verification_tokens
          WHERE user_id = $1
            AND verification_code = $2
            AND used_at IS NULL
            AND expires_at > now()
          ORDER BY expires_at DESC
          LIMIT 1`,
        [user.id, code],
      );
      if (!tokenResult.rowCount) {
        const failedAttempts = Number(user.verification_failed_attempts || 0) + 1;
        const locked = failedAttempts >= VERIFY_CODE_MAX_ATTEMPTS;
        await client.query(
          `UPDATE users
              SET verification_failed_attempts = $1,
                  verification_locked_until = CASE
                    WHEN $2 THEN now() + ($3 * interval '1 second')
                    ELSE NULL
                  END
            WHERE id = $4`,
          [locked ? 0 : failedAttempts, locked, VERIFY_CODE_LOCK_SECONDS, user.id],
        );
        return {
          kind: locked ? "locked" : "invalid",
          retryAfter: locked ? VERIFY_CODE_LOCK_SECONDS : 0,
        };
      }

      const verifiedUser = await client.query(
        `UPDATE users
            SET email_verified = true,
                verified_at = now(),
                verification_failed_attempts = 0,
                verification_locked_until = NULL
          WHERE id = $1
        RETURNING *`,
        [user.id],
      );
      await client.query(
        "UPDATE verification_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL",
        [user.id],
      );
      return { kind: "verified", user: verifiedUser.rows[0] };
    });
    if (result.kind === "locked") {
      sendRateLimitError(
        response,
        result.retryAfter || VERIFY_CODE_LOCK_SECONDS,
        "验证码错误次数过多，请稍后再试",
        request,
      );
      return;
    }
    if (result.kind !== "verified") {
      sendError(response, 400, "验证码错误或已过期", request);
      return;
    }
    await createSession("user", result.user.id, response);
    sendJson(response, 200, { user: userFromRow(result.user) }, request);
    return;
  }

  if (request.method === "POST" && path === "/api/auth/user/resend-verification") {
    const body = await readBody(request);
    const email = String(body.email || "").trim().toLowerCase();
    if (!isEmail(email)) {
      sendError(response, 400, "请输入有效邮箱", request);
      return;
    }
    const retryAfter = consumeAuthIpLimit(request, "resend-verification", 10);
    if (retryAfter) {
      sendRateLimitError(response, retryAfter, "请求过于频繁，请稍后再试", request);
      return;
    }
    const userResult = await query("SELECT * FROM users WHERE email = $1", [email]);
    const user = userResult.rows[0];
    if (!user || user.email_verified) {
      sendJson(response, 200, { message: "如果账号存在，验证邮件将会发送" }, request);
      return;
    }
    if (user.verification_sent_at) {
      const elapsedSeconds =
        (Date.now() - new Date(user.verification_sent_at).getTime()) / 1000;
      if (elapsedSeconds < VERIFICATION_RESEND_COOLDOWN_SECONDS) {
        sendRateLimitError(
          response,
          Math.ceil(VERIFICATION_RESEND_COOLDOWN_SECONDS - elapsedSeconds),
          "验证邮件发送过于频繁，请稍后再试",
          request,
        );
        return;
      }
    }
    const token = makeToken();
    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    const verificationUrl = await withTransaction(async (client) => {
      await client.query(
        `UPDATE verification_tokens
            SET used_at = now()
          WHERE user_id = $1 AND used_at IS NULL`,
        [user.id],
      );
      await client.query(
        `INSERT INTO verification_tokens
          (token_hash, user_id, verification_code, expires_at)
         VALUES ($1, $2, $3, now() + interval '24 hours')`,
        [hashToken(token), user.id, verificationCode],
      );
      await client.query(
        "UPDATE users SET verification_sent_at = now() WHERE id = $1",
        [user.id],
      );
      return sendUserVerificationEmail(email, token, verificationCode);
    });
    sendJson(
      response,
      200,
      {
        message: "验证邮件已发送",
        ...(NODE_ENV !== "production" ? { verificationUrl, verificationCode } : {}),
      },
      request,
    );
    return;
  }

  if (request.method === "POST" && path === "/api/auth/user/login") {
    const body = await readBody(request);
    const email = String(body.email || "").trim().toLowerCase();
    const result = await query("SELECT * FROM users WHERE email = $1", [email]);
    const user = result.rows[0];
    if (!user || !verifyPassword(String(body.password || ""), user)) {
      sendError(response, 401, "邮箱或密码不正确", request);
      return;
    }
    if (!user.email_verified) {
      sendError(response, 403, "请先前往邮箱激活账号", request);
      return;
    }
    await createSession("user", user.id, response);
    sendJson(response, 200, { user: userFromRow(user) }, request);
    return;
  }

  if (request.method === "POST" && path === "/api/auth/user/forgot-password") {
    const body = await readBody(request);
    const email = String(body.email || "").trim().toLowerCase();
    if (!isEmail(email)) {
      sendError(response, 400, "请输入有效邮箱", request);
      return;
    }
    const retryAfter = consumeAuthIpLimit(request, "forgot-password", 10);
    if (retryAfter) {
      sendRateLimitError(response, retryAfter, "请求过于频繁，请稍后再试", request);
      return;
    }
    const result = await query("SELECT * FROM users WHERE email = $1", [email]);
    const user = result.rows[0];
    let resetUrl = "";
    if (user) {
      if (user.password_reset_sent_at) {
        const elapsedSeconds =
          (Date.now() - new Date(user.password_reset_sent_at).getTime()) / 1000;
        if (elapsedSeconds < PASSWORD_RESET_COOLDOWN_SECONDS) {
          sendRateLimitError(
            response,
            Math.ceil(PASSWORD_RESET_COOLDOWN_SECONDS - elapsedSeconds),
            "重置邮件发送过于频繁，请稍后再试",
            request,
          );
          return;
        }
      }
      const token = makeToken();
      resetUrl = await withTransaction(async (client) => {
        await client.query(
          `UPDATE password_reset_tokens
              SET used_at = now()
            WHERE user_id = $1 AND used_at IS NULL`,
          [user.id],
        );
        await client.query(
          `INSERT INTO password_reset_tokens (token_hash, user_id, expires_at)
           VALUES ($1, $2, now() + interval '1 hour')`,
          [hashToken(token), user.id],
        );
        await client.query(
          "UPDATE users SET password_reset_sent_at = now() WHERE id = $1",
          [user.id],
        );
        return sendPasswordResetEmail(email, token);
      });
    }
    sendJson(
      response,
      200,
      {
        message: "如果账号存在，密码重置邮件将会发送",
        ...(NODE_ENV !== "production" && resetUrl ? { resetUrl } : {}),
      },
      request,
    );
    return;
  }

  if (request.method === "POST" && path === "/api/auth/user/reset-password") {
    const body = await readBody(request);
    const token = String(body.token || "");
    const password = String(body.password || "");
    if (!token || password.length < 8) {
      sendError(response, 400, "重置链接无效或密码少于 8 位", request);
      return;
    }
    const record = createPasswordRecord(password);
    const result = await query(
      `UPDATE users u
          SET password_hash = $1, password_salt = $2
        FROM password_reset_tokens r
       WHERE r.token_hash = $3
         AND r.user_id = u.id
         AND r.used_at IS NULL
         AND r.expires_at > now()
      RETURNING u.*`,
      [record.hash, record.salt, hashToken(token)],
    );
    if (!result.rowCount) {
      sendError(response, 400, "重置链接已失效或已使用", request);
      return;
    }
    await query("UPDATE password_reset_tokens SET used_at = now() WHERE token_hash = $1", [
      hashToken(token),
    ]);
    await query("DELETE FROM sessions WHERE principal_type = 'user' AND principal_id = $1", [
      result.rows[0].id,
    ]);
    sendJson(response, 200, { user: userFromRow(result.rows[0]) }, request);
    return;
  }
  if (request.method === "GET" && path === "/api/auth/user/me") {
    const user = await getUser(request);
    const merchant = user
      ? (await query("SELECT * FROM merchants WHERE user_id = $1", [user.id])).rows[0]
      : null;
    sendJson(response, 200, {
      user: userFromRow(user),
      merchant: merchant ? merchantFromRow(merchant) : null,
    }, request);
    return;
  }

  if (request.method === "POST" && path === "/api/auth/user/logout") {
    await destroySession(request, response, "user");
    sendJson(response, 200, { ok: true }, request);
    return;
  }

  if (
    request.method === "GET" &&
    path === "/api/user/deals"
  ) {
    const merchant = await getMerchant(request);
    if (!requirePrincipal(merchant, response, request, "请先登录")) return;
    const result = await query(
      `SELECT p.*, m.store_name, m.website, m.email AS owner_email
         FROM promo_codes p JOIN merchants m ON m.id = p.merchant_id
        WHERE p.merchant_id = $1 ORDER BY p.created_at DESC`,
      [merchant.id],
    );
    sendJson(response, 200, { merchant: merchantFromRow(merchant), deals: result.rows.map(dealFromRow) }, request);
    return;
  }

  if (
    request.method === "POST" &&
    path === "/api/user/deals"
  ) {
    const merchant = await getMerchant(request);
    if (!requirePrincipal(merchant, response, request, "请先登录")) return;
    if (merchant.status !== "active" || merchant.admin_status === "suspended") {
      sendError(response, 403, "当前账号不可创建优惠码", request);
      return;
    }
    const body = await readBody(request);
    const storeName = String(body.storeName || "").trim();
    let website;
    try {
      website = normalizeWebsite(body.website);
    } catch (error) {
      sendError(response, 400, error.message || "官网地址格式不正确", request);
      return;
    }
    const code = String(body.code || "").trim().toUpperCase();
    const offer = String(body.offer || "").trim();
    const dealType = body.dealType === "fixed_amount" ? "fixed_amount" : "percentage";
    const discountValue = Number(body.discountValue);
    const terms = String(body.terms || "").trim();
    const endAt = parseDate(body.endAt);
    if (!storeName || !code || !offer || !Number.isFinite(discountValue) || discountValue < 0) {
      sendError(response, 400, "请完整填写网站信息和优惠码信息", request);
      return;
    }
    if (dealType === "percentage" && discountValue > 100) {
      sendError(response, 400, "百分比折扣不能超过 100", request);
      return;
    }
    if (await getActiveFilters().then((filters) => matchesFilter(website, filters))) {
      sendError(response, 403, "该官网地址命中了网站过滤规则", request);
      return;
    }
    const totalLimit = Number(await getSetting("merchantDealTotalLimit", 50));
    const dailyLimit = Number(await getSetting("merchantDealDailyLimit", 5));
    const publicLimit = Number(await getSetting("merchantDealPublicLimit", 10));
    try {
      const result = await withTransaction(async (client) => {
        const lockedMerchant = await client.query(
          "SELECT * FROM merchants WHERE id = $1 FOR UPDATE",
          [merchant.id],
        );
        if (!lockedMerchant.rowCount) throw httpError(404, "发布者资料不存在");
        if (
          lockedMerchant.rows[0].status !== "active" ||
          lockedMerchant.rows[0].admin_status === "suspended"
        ) {
          throw httpError(403, "当前账号不可创建优惠码");
        }
        const counts = await client.query(
          `SELECT
             COUNT(*)::int AS total_count,
             COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS daily_count,
             COUNT(*) FILTER (
               WHERE status = 'published'
                 AND admin_status <> 'removed'
                 AND (end_at IS NULL OR end_at >= CURRENT_DATE)
             )::int AS public_count
           FROM promo_codes
          WHERE merchant_id = $1`,
          [merchant.id],
        );
        const count = counts.rows[0];
        if (Number.isFinite(totalLimit) && Number(count.total_count) >= totalLimit) {
          throw httpError(409, `单个发布者最多保留 ${totalLimit} 条优惠码`);
        }
        if (Number.isFinite(dailyLimit) && Number(count.daily_count) >= dailyLimit) {
          throw httpError(409, `单个发布者每日最多新增 ${dailyLimit} 条优惠码`);
        }
        if (Number.isFinite(publicLimit) && Number(count.public_count) >= publicLimit) {
          throw httpError(409, `单个发布者最多同时公开展示 ${publicLimit} 条优惠码`);
        }
        const merchantResult = await client.query(
          "UPDATE merchants SET store_name = $1, website = $2 WHERE id = $3 RETURNING *",
          [storeName, website, merchant.id],
        );
        const dealResult = await client.query(
          `INSERT INTO promo_codes
            (merchant_id, code, offer, deal_type, discount_value, terms, end_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [merchant.id, code, offer, dealType, discountValue, terms, endAt],
        );
        return { merchant: merchantResult.rows[0], deal: dealResult.rows[0] };
      });
      sendJson(
        response,
        201,
        {
          merchant: merchantFromRow(result.merchant),
          deal: dealFromRow({
            ...result.deal,
            store_name: storeName,
            website,
            owner_email: merchant.email,
          }),
        },
        request,
      );
    } catch (error) {
      if (error.code === "23505") sendError(response, 409, "该发布者已经发布过相同优惠码", request);
      else throw error;
    }
    return;
  }

  const merchantDealMatch = path.match(/^\/api\/user\/deals\/([^/]+)$/);
  if ((request.method === "PUT" || request.method === "PATCH") && merchantDealMatch) {
    const merchant = await getMerchant(request);
    if (!requirePrincipal(merchant, response, request, "请先登录")) return;
    if (merchant.status !== "active" || merchant.admin_status === "suspended") {
      sendError(response, 403, "当前账号不可编辑优惠码", request);
      return;
    }
    const body = await readBody(request);
    const storeName = String(body.storeName || "").trim();
    let website;
    try {
      website = normalizeWebsite(body.website);
    } catch (error) {
      sendError(response, 400, error.message || "官网地址格式不正确", request);
      return;
    }
    const code = String(body.code || "").trim().toUpperCase();
    const offer = String(body.offer || "").trim();
    const dealType = body.dealType === "fixed_amount" ? "fixed_amount" : "percentage";
    const discountValue = Number(body.discountValue);
    const terms = String(body.terms || "").trim();
    const endAt = parseDate(body.endAt);
    if (!storeName || !code || !offer || !Number.isFinite(discountValue) || discountValue < 0) {
      sendError(response, 400, "请完整填写网站信息和优惠码信息", request);
      return;
    }
    if (dealType === "percentage" && discountValue > 100) {
      sendError(response, 400, "百分比折扣不能超过 100", request);
      return;
    }
    if (await getActiveFilters().then((filters) => matchesFilter(website, filters))) {
      sendError(response, 403, "该官网地址命中了网站过滤规则", request);
      return;
    }
    try {
      const result = await query(
        `UPDATE promo_codes p
            SET code = $1, offer = $2, deal_type = $3, discount_value = $4,
                terms = $5, end_at = $6, updated_at = now()
          WHERE p.id = $7 AND p.merchant_id = $8
        RETURNING p.*`,
        [code, offer, dealType, discountValue, terms, endAt, merchantDealMatch[1], merchant.id],
      );
      if (!result.rowCount) {
        sendError(response, 404, "优惠码不存在", request);
        return;
      }
      await query("UPDATE merchants SET store_name = $1, website = $2 WHERE id = $3", [
        storeName,
        website,
        merchant.id,
      ]);
      sendJson(
        response,
        200,
        {
          deal: dealFromRow({
            ...result.rows[0],
            store_name: storeName,
            website,
            owner_email: merchant.email,
          }),
        },
        request,
      );
    } catch (error) {
      if (error.code === "23505") sendError(response, 409, "该发布者已经发布过相同优惠码", request);
      else throw error;
    }
    return;
  }

  const merchantToggleMatch = path.match(/^\/api\/user\/deals\/([^/]+)\/toggle$/);
  if (request.method === "POST" && merchantToggleMatch) {
    const merchant = await getMerchant(request);
    if (!requirePrincipal(merchant, response, request, "请先登录")) return;
    if (merchant.status !== "active" || merchant.admin_status === "suspended") {
      sendError(response, 403, "当前账号不可修改优惠码", request);
      return;
    }
    const publicLimit = Number(await getSetting("merchantDealPublicLimit", 10));
    const result = await withTransaction(async (client) => {
      const lockedMerchant = await client.query(
        "SELECT * FROM merchants WHERE id = $1 FOR UPDATE",
        [merchant.id],
      );
      if (!lockedMerchant.rowCount) throw httpError(404, "发布者资料不存在");
      if (
        lockedMerchant.rows[0].status !== "active" ||
        lockedMerchant.rows[0].admin_status === "suspended"
      ) {
        throw httpError(403, "当前账号不可修改优惠码");
      }
      const current = await client.query(
        "SELECT status FROM promo_codes WHERE id = $1 AND merchant_id = $2 FOR UPDATE",
        [merchantToggleMatch[1], merchant.id],
      );
      if (!current.rowCount) throw httpError(404, "优惠码不存在");
      if (current.rows[0].status === "paused") {
        const count = await client.query(
          `SELECT COUNT(*)::int AS public_count
             FROM promo_codes
            WHERE merchant_id = $1
              AND status = 'published'
              AND admin_status <> 'removed'
              AND (end_at IS NULL OR end_at >= CURRENT_DATE)`,
          [merchant.id],
        );
        if (Number.isFinite(publicLimit) && Number(count.rows[0].public_count) >= publicLimit) {
          throw httpError(409, `单个发布者最多同时公开展示 ${publicLimit} 条优惠码`);
        }
      }
      const updated = await client.query(
        `UPDATE promo_codes
            SET status = CASE WHEN status = 'paused' THEN 'published' ELSE 'paused' END,
                updated_at = now()
          WHERE id = $1 AND merchant_id = $2
        RETURNING *`,
        [merchantToggleMatch[1], merchant.id],
      );
      return { deal: updated.rows[0], merchant: lockedMerchant.rows[0] };
    });
    sendJson(response, 200, {
      deal: dealFromRow({
        ...result.deal,
        store_name: result.merchant.store_name,
        website: result.merchant.website,
        owner_email: result.merchant.email,
      }),
    }, request);
    return;
  }

  if (request.method === "GET" && path === "/api/user/favorites") {
    const user = await getUser(request);
    if (!requirePrincipal(user, response, request, "请先登录用户账号")) return;
    const result = await query(
      `SELECT p.*, m.store_name, m.website, m.email AS owner_email
         FROM favorites f
         JOIN promo_codes p ON p.id = f.promo_code_id
         JOIN merchants m ON m.id = p.merchant_id
        WHERE f.user_id = $1 ORDER BY f.created_at DESC`,
      [user.id],
    );
    sendJson(response, 200, { deals: result.rows.map(dealFromRow) }, request);
    return;
  }

  const favoriteMatch = path.match(/^\/api\/user\/favorites\/([^/]+)$/);
  if (favoriteMatch && (request.method === "POST" || request.method === "DELETE")) {
    const user = await getUser(request);
    if (!requirePrincipal(user, response, request, "请先登录用户账号")) return;
    try {
      if (request.method === "POST") {
        await query(
          "INSERT INTO favorites (user_id, promo_code_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [user.id, favoriteMatch[1]],
        );
      } else {
        await query("DELETE FROM favorites WHERE user_id = $1 AND promo_code_id = $2", [
          user.id,
          favoriteMatch[1],
        ]);
      }
    } catch (error) {
      if (error.code === "23503") {
        sendError(response, 404, "优惠码不存在", request);
        return;
      }
      throw error;
    }
    sendJson(response, 200, { ok: true }, request);
    return;
  }

  if (request.method === "GET" && path === "/api/user/reports") {
    const user = await getUser(request);
    if (!requirePrincipal(user, response, request, "请先登录用户账号")) return;
    const result = await query(
      `SELECT r.*, p.code, m.store_name, m.website, u.email AS user_email
         FROM reports r
         JOIN promo_codes p ON p.id = r.promo_code_id
         JOIN merchants m ON m.id = p.merchant_id
         JOIN users u ON u.id = r.user_id
        WHERE r.user_id = $1 ORDER BY r.created_at DESC`,
      [user.id],
    );
    sendJson(response, 200, { reports: result.rows.map(reportFromRow) }, request);
    return;
  }

  if (request.method === "POST" && path === "/api/user/reports") {
    const user = await getUser(request);
    if (!requirePrincipal(user, response, request, "请先登录用户账号")) return;
    const body = await readBody(request);
    const dealId = String(body.dealId || "");
    const reason = String(body.reason || "").trim();
    if (!dealId || !reason) {
      sendError(response, 400, "举报信息不完整", request);
      return;
    }
    try {
      const result = await query(
        `INSERT INTO reports (user_id, promo_code_id, reason)
         VALUES ($1, $2, $3) RETURNING id`,
        [user.id, dealId, reason],
      );
      sendJson(response, 201, { id: result.rows[0].id }, request);
    } catch (error) {
      if (error.code === "23505") sendError(response, 409, "你已经举报过这条优惠码", request);
      else if (error.code === "23503") sendError(response, 404, "优惠码不存在", request);
      else throw error;
    }
    return;
  }

  if (request.method === "POST" && path === "/api/admin/login") {
    const body = await readBody(request);
    const email = String(body.email || "").trim().toLowerCase();
    const result = await query("SELECT * FROM admin_users WHERE email = $1", [email]);
    const admin = result.rows[0];
    if (!admin || !verifyPassword(String(body.password || ""), admin)) {
      sendError(response, 401, "管理员邮箱或密码不正确", request);
      return;
    }
    await createSession("admin", admin.id, response);
    sendJson(response, 200, {
      admin: { id: admin.id, email: admin.email, name: admin.name },
    }, request);
    return;
  }

  if (request.method === "POST" && path === "/api/admin/logout") {
    await destroySession(request, response, "admin");
    sendJson(response, 200, { ok: true }, request);
    return;
  }

  if (request.method === "GET" && path === "/api/admin/me") {
    const admin = await getAdmin(request);
    sendJson(response, 200, {
      admin: admin ? { id: admin.id, email: admin.email, name: admin.name } : null,
    }, request);
    return;
  }

  const admin = await getAdmin(request);
  if (path.startsWith("/api/admin/") && !requirePrincipal(admin, response, request, "管理员会话已失效，请重新登录")) {
    return;
  }

  const isAdminAnnouncementPath =
    path === "/api/admin/announcement" || path === "/api/admin/announcements";

  if (request.method === "PATCH" && isAdminAnnouncementPath) {
    const body = await readBody(request);
    const announcement = normalizeAnnouncement({
      ...body,
      updatedAt: new Date().toISOString(),
      updatedBy: admin.email,
    });
    if (announcement.content.length > 200) {
      sendError(response, 400, "公告内容不能超过 200 个字符", request);
      return;
    }
    if (announcement.link && !isHttpUrl(announcement.link)) {
      sendError(response, 400, "跳转链接必须是有效的 HTTP 或 HTTPS 地址", request);
      return;
    }
    if (announcement.startsAt && announcement.endsAt && announcement.startsAt > announcement.endsAt) {
      sendError(response, 400, "结束日期不能早于开始日期", request);
      return;
    }
    await setSetting("announcement", announcement);
    await addAuditLog(admin, "update_announcement", "announcement", announcement.id, "更新站点公告");
    sendJson(response, 200, { announcement }, request);
    return;
  }

  if (request.method === "GET" && isAdminAnnouncementPath) {
    sendJson(
      response,
      200,
      { announcement: normalizeAnnouncement(await getSetting("announcement", DEFAULT_ANNOUNCEMENT)) },
      request,
    );
    return;
  }

  if (request.method === "GET" && path === "/api/admin/dashboard") {
    const [deals, merchants, reports] = await Promise.all([
      query(
        `SELECT p.*, m.store_name, m.website, m.email AS owner_email
           FROM promo_codes p JOIN merchants m ON m.id = p.merchant_id
          ORDER BY p.created_at DESC`,
      ),
      query("SELECT * FROM merchants ORDER BY created_at DESC"),
      query(
        `SELECT r.*, p.code, m.store_name, m.website, u.email AS user_email
           FROM reports r
           JOIN promo_codes p ON p.id = r.promo_code_id
           JOIN merchants m ON m.id = p.merchant_id
           JOIN users u ON u.id = r.user_id
          ORDER BY r.created_at DESC`,
      ),
    ]);
    sendJson(response, 200, {
      deals: deals.rows.map(dealFromRow),
      merchants: merchants.rows.map(merchantFromRow),
      reports: reports.rows.map(reportFromRow),
    }, request);
    return;
  }

  if (request.method === "GET" && path === "/api/admin/deals") {
    const { page, limit, offset } = parsePagination(url, 50, 200);
    const result = await query(
      `SELECT p.*, m.store_name, m.website, m.email AS owner_email
         FROM promo_codes p JOIN merchants m ON m.id = p.merchant_id
        ORDER BY p.created_at DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    const total = await query("SELECT COUNT(*)::int AS total FROM promo_codes");
    const totalCount = Number(total.rows[0]?.total || 0);
    sendJson(response, 200, {
      deals: result.rows.map(dealFromRow),
      page,
      limit,
      total: totalCount,
      hasMore: offset + result.rows.length < totalCount,
    }, request);
    return;
  }

  const adminDealMatch = path.match(/^\/api\/admin\/deals\/([^/]+)$/);
  if (adminDealMatch && request.method === "PATCH") {
    const body = await readBody(request);
    const removed = body.adminStatus === "removed";
    const result = await query(
      `UPDATE promo_codes
          SET admin_status = $1,
              admin_removal_reason = CASE WHEN $1 = 'removed' THEN COALESCE($2, admin_removal_reason) ELSE '' END,
              updated_at = now()
        WHERE id = $3 RETURNING *`,
      [removed ? "removed" : "normal", body.reason || null, adminDealMatch[1]],
    );
    if (!result.rowCount) {
      sendError(response, 404, "优惠码不存在", request);
      return;
    }
    const deal = await query(
      `SELECT p.*, m.store_name, m.website, m.email AS owner_email
         FROM promo_codes p JOIN merchants m ON m.id = p.merchant_id
        WHERE p.id = $1`,
      [adminDealMatch[1]],
    );
    await addAuditLog(admin, removed ? "remove_promo_code" : "restore_promo_code", "promo_code", adminDealMatch[1], "更新优惠码后台状态");
    sendJson(response, 200, { deal: dealFromRow(deal.rows[0]) }, request);
    return;
  }

  if (adminDealMatch && request.method === "DELETE") {
    const result = await query("DELETE FROM promo_codes WHERE id = $1 RETURNING id", [adminDealMatch[1]]);
    if (!result.rowCount) {
      sendError(response, 404, "优惠码不存在", request);
      return;
    }
    await addAuditLog(admin, "delete_promo_code", "promo_code", adminDealMatch[1], "永久删除优惠码");
    sendJson(response, 200, { ok: true }, request);
    return;
  }

  if (request.method === "GET" && path === "/api/admin/merchants") {
    const result = await query(
      `SELECT m.*, COUNT(p.id)::int AS deal_count
         FROM merchants m
         LEFT JOIN promo_codes p ON p.merchant_id = m.id
        GROUP BY m.id
        ORDER BY m.created_at DESC`,
    );
    sendJson(response, 200, { merchants: result.rows.map(merchantFromRow) }, request);
    return;
  }

  const adminMerchantMatch = path.match(/^\/api\/admin\/merchants\/([^/]+)$/);
  if (adminMerchantMatch && request.method === "GET") {
    const merchantResult = await query("SELECT * FROM merchants WHERE id = $1", [adminMerchantMatch[1]]);
    if (!merchantResult.rowCount) {
      sendError(response, 404, "发布者资料不存在", request);
      return;
    }
    const deals = await query(
      `SELECT p.*, m.store_name, m.website, m.email AS owner_email
         FROM promo_codes p JOIN merchants m ON m.id = p.merchant_id
        WHERE p.merchant_id = $1 ORDER BY p.created_at DESC`,
      [adminMerchantMatch[1]],
    );
    sendJson(response, 200, {
      merchant: merchantFromRow(merchantResult.rows[0]),
      deals: deals.rows.map(dealFromRow),
    }, request);
    return;
  }

  if (adminMerchantMatch && request.method === "PATCH") {
    const body = await readBody(request);
    const suspended = body.status === "suspended" || body.adminStatus === "suspended";
    const result = await query(
      "UPDATE merchants SET admin_status = $1 WHERE id = $2 RETURNING *",
      [suspended ? "suspended" : "normal", adminMerchantMatch[1]],
    );
    if (!result.rowCount) {
      sendError(response, 404, "发布者资料不存在", request);
      return;
    }
    await addAuditLog(admin, suspended ? "suspend_merchant" : "resume_merchant", "merchant", adminMerchantMatch[1], "更新商户状态");
    sendJson(response, 200, { merchant: merchantFromRow(result.rows[0]) }, request);
    return;
  }

  if (request.method === "GET" && path === "/api/admin/reports") {
    const result = await query(
      `SELECT r.*, p.code, m.store_name, m.website, u.email AS user_email
         FROM reports r
         JOIN promo_codes p ON p.id = r.promo_code_id
         JOIN merchants m ON m.id = p.merchant_id
         JOIN users u ON u.id = r.user_id
        ORDER BY r.created_at DESC`,
    );
    sendJson(response, 200, { reports: result.rows.map(reportFromRow) }, request);
    return;
  }

  const adminReportMatch = path.match(/^\/api\/admin\/reports\/([^/]+)$/);
  if (adminReportMatch && request.method === "PATCH") {
    const body = await readBody(request);
    const status = ["pending", "resolved", "dismissed"].includes(body.status) ? body.status : "pending";
    const result = await query(
      `UPDATE reports
          SET status = $1,
              handled_at = CASE WHEN $1 = 'pending' THEN NULL ELSE now() END,
              handled_by = CASE WHEN $1 = 'pending' THEN NULL ELSE $2::uuid END
        WHERE id = $3 RETURNING id`,
      [status, admin.id, adminReportMatch[1]],
    );
    if (!result.rowCount) {
      sendError(response, 404, "举报记录不存在", request);
      return;
    }
    await addAuditLog(admin, `${status}_report`, "report", adminReportMatch[1], "更新举报处理状态");
    sendJson(response, 200, { ok: true }, request);
    return;
  }

  if (request.method === "GET" && path === "/api/admin/website-filters") {
    const result = await query(
      `SELECT f.*, a.email AS created_by_email
         FROM website_filters f LEFT JOIN admin_users a ON a.id = f.created_by
        ORDER BY f.created_at DESC`,
    );
    sendJson(response, 200, { rules: result.rows.map(filterFromRow) }, request);
    return;
  }

  if (request.method === "POST" && path === "/api/admin/website-filters") {
    const body = await readBody(request);
    const input = String(body.website || body.keyword || "").trim();
    let hostname = "";
    try {
      hostname = normalizeHostname(input);
    } catch {
      hostname = "";
    }
    const isDomainRule = Boolean(hostname && hostname.includes("."));
    const keyword = input.toLowerCase();
    if (!isDomainRule && keyword.length < 2) {
      sendError(response, 400, "请输入完整域名或至少 2 个字符的敏感词", request);
      return;
    }
    if (!String(body.reason || "").trim()) {
      sendError(response, 400, "请填写违规原因", request);
      return;
    }
    const result = await query(
      `INSERT INTO website_filters (match_type, hostname, keyword, reason, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        isDomainRule ? "domain" : "keyword",
        isDomainRule ? hostname : "",
        isDomainRule ? "" : keyword,
        String(body.reason).trim(),
        admin.id,
      ],
    );
    await addAuditLog(admin, "add_website_filter", "website", isDomainRule ? hostname : keyword, "添加网站过滤规则");
    sendJson(response, 201, {
      rule: filterFromRow({ ...result.rows[0], created_by_email: admin.email }),
    }, request);
    return;
  }

  const adminFilterMatch = path.match(/^\/api\/admin\/website-filters\/([^/]+)$/);
  if (adminFilterMatch && request.method === "PATCH") {
    const body = await readBody(request);
    const result = await query(
      "UPDATE website_filters SET status = $1 WHERE id = $2 RETURNING *",
      [body.status === "disabled" ? "disabled" : "active", adminFilterMatch[1]],
    );
    if (!result.rowCount) {
      sendError(response, 404, "过滤规则不存在", request);
      return;
    }
    await addAuditLog(admin, "update_website_filter", "website", adminFilterMatch[1], "更新网站过滤规则状态");
    sendJson(response, 200, { rule: filterFromRow(result.rows[0]) }, request);
    return;
  }

  if (adminFilterMatch && request.method === "DELETE") {
    await query("DELETE FROM website_filters WHERE id = $1", [adminFilterMatch[1]]);
    await addAuditLog(admin, "delete_website_filter", "website", adminFilterMatch[1], "删除网站过滤规则");
    sendJson(response, 200, { ok: true }, request);
    return;
  }

  if (request.method === "GET" && path === "/api/admin/audit-logs") {
    const result = await query(
      `SELECT l.*, a.email AS admin_email
         FROM admin_audit_logs l LEFT JOIN admin_users a ON a.id = l.admin_id
        ORDER BY l.created_at DESC LIMIT 200`,
    );
    sendJson(response, 200, {
      logs: result.rows.map((row) => ({
        id: row.id,
        adminEmail: row.admin_email || "system",
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        description: row.description,
        createdAt: toIso(row.created_at),
      })),
    }, request);
    return;
  }

  if (request.method === "GET" && path === "/api/admin/settings") {
    sendJson(response, 200, { settings: await getAdminSettingsPayload() }, request);
    return;
  }

  if (request.method === "PATCH" && path === "/api/admin/settings") {
    const body = await readBody(request);
    if (typeof body.allowUserRegistration === "boolean") {
      await setSetting("allowUserRegistration", body.allowUserRegistration);
    } else if (typeof body.allowMerchantRegistration === "boolean") {
      await setSetting("allowUserRegistration", body.allowMerchantRegistration);
    }
    if (typeof body.showGithubLink === "boolean") {
      await setSetting("showGithubLink", body.showGithubLink);
    }
    if (body.siteStatus) await setSetting("siteStatus", String(body.siteStatus));
    for (const key of [
      "merchantDealTotalLimit",
      "merchantDealPublicLimit",
      "merchantDealDailyLimit",
    ]) {
      if (body[key] !== undefined) {
        const value = Number(body[key]);
        if (!Number.isInteger(value) || value < 0) {
          sendError(response, 400, `${key} 必须是非负整数`, request);
          return;
        }
        await setSetting(key, value);
      }
    }
    if (typeof body.preventDuplicateMerchantCodes === "boolean") {
      await setSetting("preventDuplicateMerchantCodes", body.preventDuplicateMerchantCodes);
    }
    if (body.password) {
      if (String(body.password).length < 8) {
        sendError(response, 400, "新密码至少需要 8 位", request);
        return;
      }
      const record = createPasswordRecord(String(body.password));
      await query("UPDATE admin_users SET password_hash = $1, password_salt = $2 WHERE id = $3", [
        record.hash,
        record.salt,
        admin.id,
      ]);
    }
    await addAuditLog(admin, "update_settings", "system", "settings", "更新系统设置");
    sendJson(response, 200, { settings: await getAdminSettingsPayload() }, request);
    return;
  }

  if (path === "/api/admin/mail-settings" || path === "/api/admin/mail-settings/test") {
    if (request.method === "GET" && path === "/api/admin/mail-settings") {
      sendJson(response, 200, { settings: safeMailSettings(await getMailSettings()) }, request);
      return;
    }

    if (request.method === "PUT" && path === "/api/admin/mail-settings") {
      const existing = await getMailSettings();
      const body = await readBody(request);
      const settings = normalizeMailSettings(body, existing);
      if (!body.smtp || body.smtp.password === undefined || body.smtp.password === "") {
        settings.smtp.password = existing.smtp.password || "";
      }
      await setSetting("mailSettings", settings);
      await addAuditLog(admin, "update_mail_settings", "system", "mail", "更新邮件配置");
      sendJson(response, 200, { settings: safeMailSettings(settings) }, request);
      return;
    }

    if (request.method === "POST" && path === "/api/admin/mail-settings/test") {
      const body = await readBody(request);
      const recipient = String(body.recipient || admin.email).trim();
      await sendMail(recipient, "promo-code 测试邮件", "这是一封测试邮件。", "<p>这是一封测试邮件。</p>");
      sendJson(response, 200, { message: "测试邮件已发送" }, request);
      return;
    }
  }

  sendError(response, 404, "接口不存在", request);
}

await initDatabase();
await ensureAdmin();
await ensureDevelopmentAccounts();

const server = createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    console.error(error);
    const status = Number(error.statusCode || 500);
    const message = status >= 500 ? "服务器内部错误" : error.message || "请求处理失败";
    if (!response.headersSent) sendError(response, status, message, request);
    else response.end();
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`API server listening on http://0.0.0.0:${PORT}`);
});

process.on("SIGTERM", async () => {
  server.close();
  await closeDatabase();
});
