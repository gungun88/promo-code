import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.API_PORT || 8000);
const DATA_DIR = resolve(__dirname, ".data");
const DATA_FILE = resolve(DATA_DIR, "admin-state.json");
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@promo-code.local";
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123456";
const FRONTEND_ORIGINS = new Set(
  (process.env.FRONTEND_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const DEFAULT_MAIL_SETTINGS = {
  fromAddress: "",
  contentFormat: "multipart",
  driver: "smtp",
  smtp: {
    host: "",
    port: 587,
    encryption: "tls",
    username: "",
    password: "",
    verifySsl: true,
  },
  testRecipient: "",
};

let state;
let saveQueue = Promise.resolve();

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString("hex");
}

function createPasswordRecord(password) {
  const salt = randomBytes(16).toString("hex");
  return { salt, hash: hashPassword(password, salt) };
}

function createInitialState() {
  const password = createPasswordRecord(DEFAULT_ADMIN_PASSWORD);
  return {
    admin: {
      id: "admin-1",
      email: DEFAULT_ADMIN_EMAIL.toLowerCase(),
      name: "平台管理员",
      passwordHash: password.hash,
      passwordSalt: password.salt,
    },
    mailSettings: structuredClone(DEFAULT_MAIL_SETTINGS),
    settings: {
      allowMerchantRegistration: true,
      siteStatus: "正常运行",
    },
    sessions: {},
    auditLogs: [],
  };
}

async function loadState() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    state = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
  } catch {
    state = createInitialState();
    await persistState();
  }
  state.settings ||= {
    allowMerchantRegistration: true,
    siteStatus: "正常运行",
  };
  state.sessions ||= {};
  state.auditLogs ||= [];
}

function persistState() {
  saveQueue = saveQueue.then(async () => {
    const temporaryFile = `${DATA_FILE}.tmp`;
    await fs.writeFile(temporaryFile, JSON.stringify(state, null, 2), "utf8");
    await fs.rename(temporaryFile, DATA_FILE);
  });
  return saveQueue;
}

function sendJson(response, status, payload, request) {
  const origin = request.headers.origin;
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
  };
  if (origin && (FRONTEND_ORIGINS.has(origin) || process.env.NODE_ENV !== "production")) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }
  response.writeHead(status, headers);
  response.end(JSON.stringify(payload));
}

function sendError(response, status, message, request) {
  sendJson(response, status, { message }, request);
}

function getCookies(request) {
  return Object.fromEntries(
    (request.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        return separator < 0
          ? [part, ""]
          : [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
      }),
  );
}

function getSessionToken(request) {
  const authorization = request.headers.authorization || "";
  if (authorization.startsWith("Bearer ")) return authorization.slice(7);
  return getCookies(request).admin_session;
}

function getAdmin(request) {
  const token = getSessionToken(request);
  const session = token && state.sessions[token];
  if (!session || session.expiresAt < Date.now()) return null;
  return state.admin.id === session.adminId ? state.admin : null;
}

function setSessionCookie(response, token) {
  response.setHeader(
    "Set-Cookie",
    `admin_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`,
  );
}

function clearSessionCookie(response) {
  response.setHeader("Set-Cookie", "admin_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
}

function safeMailSettings() {
  const { password, ...safeSmtp } = state.mailSettings.smtp;
  return {
    ...state.mailSettings,
    smtp: {
      ...safeSmtp,
      hasPassword: Boolean(password),
    },
  };
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("请求体必须是有效 JSON");
  }
}

function addAuditLog(admin, action, description) {
  state.auditLogs.unshift({
    id: randomUUID(),
    adminEmail: admin.email,
    action,
    targetType: "system",
    targetId: "mail-settings",
    description,
    createdAt: new Date().toISOString(),
  });
  state.auditLogs = state.auditLogs.slice(0, 200);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function sendTestEmail(settings, recipient) {
  if (settings.driver === "log") {
    console.log(`[mail:test] ${settings.fromAddress} -> ${recipient}`);
    return "测试邮件已写入服务端日志";
  }

  if (settings.driver === "null") {
    return "当前发件方式为 null，未实际发送邮件";
  }

  if (settings.driver !== "smtp") {
    throw new Error(`当前暂不支持 ${settings.driver} 发件方式，请使用 SMTP 或 log`);
  }

  const smtp = settings.smtp;
  if (!smtp.host || !smtp.port || !smtp.username || !smtp.password) {
    throw new Error("请先完整配置 SMTP 服务器、用户名和密码");
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: Number(smtp.port),
    secure: smtp.encryption === "ssl",
    requireTLS: smtp.encryption === "tls",
    auth: {
      user: smtp.username,
      pass: smtp.password,
    },
    tls: {
      rejectUnauthorized: smtp.verifySsl !== false,
    },
  });

  await transporter.sendMail({
    from: settings.fromAddress,
    to: recipient,
    subject: "promo-code 邮件服务测试",
    text: "这是一封来自 promo-code 后台的测试邮件。",
    html: "<p>这是一封来自 promo-code 后台的测试邮件。</p>",
  });

  return "测试邮件已发送";
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (request.method === "OPTIONS") {
    sendJson(response, 204, {}, request);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, { ok: true }, request);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/admin/login") {
    try {
      const body = await readBody(request);
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const admin = state.admin;
      const passwordHash = hashPassword(password, admin.passwordSalt);
      const validPassword = timingSafeEqual(
        Buffer.from(passwordHash, "hex"),
        Buffer.from(admin.passwordHash, "hex"),
      );

      if (email !== admin.email || !validPassword) {
        sendError(response, 401, "管理员邮箱或密码不正确", request);
        return;
      }

      const token = randomBytes(32).toString("hex");
      state.sessions[token] = {
        adminId: admin.id,
        expiresAt: Date.now() + SESSION_TTL_MS,
      };
      await persistState();
      setSessionCookie(response, token);
      sendJson(response, 200, {
        admin: { id: admin.id, email: admin.email, name: admin.name },
      }, request);
    } catch (error) {
      sendError(response, 400, error.message, request);
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/admin/logout") {
    const token = getSessionToken(request);
    if (token) delete state.sessions[token];
    await persistState();
    clearSessionCookie(response);
    sendJson(response, 200, { ok: true }, request);
    return;
  }

  if (request.method === "PATCH" && url.pathname === "/api/admin/settings") {
    const admin = getAdmin(request);
    if (!admin) {
      sendError(response, 401, "管理员会话已失效，请重新登录", request);
      return;
    }

    try {
      const body = await readBody(request);
      if (body.password !== undefined) {
        const password = String(body.password);
        if (password.length < 8) throw new Error("新密码至少需要 8 位");
        const passwordRecord = createPasswordRecord(password);
        state.admin.passwordHash = passwordRecord.hash;
        state.admin.passwordSalt = passwordRecord.salt;
      }
      state.settings = {
        ...state.settings,
        ...(typeof body.allowMerchantRegistration === "boolean"
          ? { allowMerchantRegistration: body.allowMerchantRegistration }
          : {}),
        ...(body.siteStatus ? { siteStatus: String(body.siteStatus) } : {}),
      };
      addAuditLog(admin, "update_settings", "更新后台系统设置");
      await persistState();
      sendJson(response, 200, { settings: state.settings }, request);
    } catch (error) {
      sendError(response, 400, error.message, request);
    }
    return;
  }

  if (
    url.pathname === "/api/admin/mail-settings" ||
    url.pathname === "/api/admin/mail-settings/test"
  ) {
    const admin = getAdmin(request);
    if (!admin) {
      sendError(response, 401, "管理员会话已失效，请重新登录", request);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/admin/mail-settings") {
      sendJson(response, 200, { settings: safeMailSettings() }, request);
      return;
    }

    if (request.method === "PUT" && url.pathname === "/api/admin/mail-settings") {
      try {
        const body = await readBody(request);
        const smtp = body.smtp || {};
        const fromAddress = String(body.fromAddress || "").trim();
        const contentFormat = String(body.contentFormat || "multipart");
        const driver = String(body.driver || "smtp");
        const testRecipient = body.testRecipient ? String(body.testRecipient).trim() : "";

        if (!isEmail(fromAddress)) throw new Error("发件地址格式不正确");
        if (!["multipart", "plain", "html"].includes(contentFormat)) {
          throw new Error("内容格式不正确");
        }
        if (!["mail", "mailgun", "postmark", "log", "smtp", "null"].includes(driver)) {
          throw new Error("发件方式不正确");
        }
        if (testRecipient && !isEmail(testRecipient)) {
          throw new Error("测试收件地址格式不正确");
        }

        const nextSmtp = {
          ...state.mailSettings.smtp,
          host: String(smtp.host || "").trim(),
          port: Number(smtp.port || 587),
          encryption: smtp.encryption ? String(smtp.encryption) : "",
          username: String(smtp.username || "").trim(),
          verifySsl: smtp.verifySsl !== false,
        };
        if (smtp.password) nextSmtp.password = String(smtp.password);
        if (!Number.isInteger(nextSmtp.port) || nextSmtp.port < 1 || nextSmtp.port > 65535) {
          throw new Error("SMTP 端口格式不正确");
        }

        state.mailSettings = {
          fromAddress,
          contentFormat,
          driver,
          smtp: nextSmtp,
          testRecipient,
        };
        addAuditLog(admin, "update_mail_settings", "更新邮件服务配置");
        await persistState();
        sendJson(response, 200, { settings: safeMailSettings() }, request);
      } catch (error) {
        sendError(response, 400, error.message, request);
      }
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/admin/mail-settings/test") {
      try {
        const body = await readBody(request);
        const recipient = String(body.recipient || state.mailSettings.testRecipient || admin.email).trim();
        if (!isEmail(recipient)) throw new Error("测试收件地址格式不正确");
        const message = await sendTestEmail(state.mailSettings, recipient);
        addAuditLog(admin, "send_test_mail", `向 ${recipient} 发送测试邮件`);
        await persistState();
        sendJson(response, 200, { message }, request);
      } catch (error) {
        sendError(response, 400, error.message, request);
      }
      return;
    }
  }

  sendError(response, 404, "接口不存在", request);
}

await loadState();
const server = createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    console.error(error);
    sendError(response, 500, "服务器内部错误", request);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`API server listening on http://localhost:${PORT}`);
  console.log(`Admin account: ${DEFAULT_ADMIN_EMAIL}`);
});
