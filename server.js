require("dotenv").config();
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";
if (isProduction && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error("Ustaw SESSION_SECRET o długości co najmniej 32 znaków.");
}
if (isProduction) app.set("trust proxy", 1);

const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "ornaldetailing.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    service TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
const findUserByEmail = db.prepare("SELECT * FROM users WHERE email = ?");
const createUser = db.prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)");
const publicUser = user => ({ id: user.id, name: user.name, email: user.email, createdAt: user.created_at });

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));
app.use(session({
  store: new SQLiteStore({ db: "sessions.sqlite", dir: dataDir }),
  secret: process.env.SESSION_SECRET || "development-only-change-this-secret-before-deploying",
  resave: false,
  saveUninitialized: false,
  name: "ornaldetailing.sid",
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false });
const contactLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false });
const requireAuth = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: "Zaloguj się, aby kontynuować." });
  next();
};

app.post("/api/register", authLimiter, async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (name.length < 2 || name.length > 70) return res.status(400).json({ error: "Imię i nazwisko musi mieć od 2 do 70 znaków." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) return res.status(400).json({ error: "Podaj poprawny adres e-mail." });
  if (password.length < 10 || password.length > 72) return res.status(400).json({ error: "Hasło musi mieć od 10 do 72 znaków." });
  if (findUserByEmail.get(email)) return res.status(409).json({ error: "Konto z tym adresem e-mail już istnieje." });
  try {
    const hash = await bcrypt.hash(password, 12);
    const result = createUser.run(name, email, hash);
    req.session.userId = Number(result.lastInsertRowid);
    res.status(201).json({ user: { id: Number(result.lastInsertRowid), name, email } });
  } catch (error) {
    if (String(error.code).includes("SQLITE_CONSTRAINT")) return res.status(409).json({ error: "Konto z tym adresem e-mail już istnieje." });
    console.error(error);
    res.status(500).json({ error: "Nie udało się utworzyć konta." });
  }
});

app.post("/api/login", authLimiter, async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = findUserByEmail.get(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Nieprawidłowy e-mail lub hasło." });
  }
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: "Nie udało się rozpocząć sesji." });
    req.session.userId = user.id;
    res.json({ user: publicUser(user) });
  });
});

app.get("/api/me", (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = db.prepare("SELECT id, name, email, created_at FROM users WHERE id = ?").get(req.session.userId);
  if (!user) {
    return req.session.destroy(() => res.json({ user: null }));
  }
  res.json({ user: publicUser(user) });
});

app.post("/api/logout", requireAuth, (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: "Nie udało się wylogować." });
    res.clearCookie("ornaldetailing.sid", { httpOnly: true, sameSite: "lax", secure: isProduction });
    res.json({ ok: true });
  });
});

app.post("/api/contact", contactLimiter, (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const service = String(req.body.service || "").trim();
  const message = String(req.body.message || "").trim();
  if (name.length < 2 || name.length > 70) return res.status(400).json({ error: "Podaj imię (2–70 znaków)." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) return res.status(400).json({ error: "Podaj poprawny e-mail." });
  if (service.length < 2 || service.length > 80) return res.status(400).json({ error: "Wybierz usługę." });
  if (message.length < 10 || message.length > 2000) return res.status(400).json({ error: "Wiadomość musi mieć od 10 do 2000 znaków." });
  db.prepare("INSERT INTO messages (name, email, service, message) VALUES (?, ?, ?, ?)").run(name, email, service, message);
  res.status(201).json({ ok: true, message: "Dziękujemy! Wiadomość została zapisana." });
});

app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => console.log(`OrnalDetailing działa: http://localhost:${PORT}`));
