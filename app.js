import express from "express";
import session from "express-session";
import SQLiteStoreFactory from "connect-sqlite3";
import { engine } from "express-handlebars";
import methodOverride from "method-override";
import path from "path";
import { fileURLToPath } from "url";

import { ensureAdminSeeded } from "./db/seed.js";
import { hbsHelpers } from "./src/helpers.js";

// Central entry point that wires middleware, templating, routes, and database seeding
import pageRoutes from "./src/routes/pages.js";
import authRoutes from "./src/routes/auth.js";
import taskRoutes from "./src/routes/tasks.js";
import adminRoutes from "./src/routes/admin.js";
import accountRoutes from "./src/routes/account.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SQLiteStore = SQLiteStoreFactory(session);
const app = express();

/* ---------- Handlebars ---------- */
// Register layouts, partials, and helpers so views have consistent chrome.
app.engine("hbs", engine({
  extname: ".hbs",
  defaultLayout: "main",
  layoutsDir: path.join(__dirname, "views", "layouts"),
  partialsDir: path.join(__dirname, "views", "partials"),
  helpers: hbsHelpers
}));
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

/* ---------- Static & parsers ---------- */
// Parse incoming form/JSON payloads and expose assets under /public.
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public"))); // serves /css and /js

/* ---------- Sessions ---------- */
// Store sessions on disk via SQLite so logins survive restarts during review.
const sessionStore = new SQLiteStore({ db: "sessions.sqlite", dir: path.join(__dirname, "db") });
sessionStore.clear((err) => {
  if (err) console.error("Failed to clear session store on boot", err);
});

app.use(session({
  store: sessionStore,
  secret: "change_this_secret_now",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 } // 8 hours
}));

/* expose user + flash to all views */
// Idle middleware that injects the logged-in user and flash messages in every view.
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.success = req.session.success; delete req.session.success;
  res.locals.error = req.session.error; delete req.session.error;
  next();
});

/* ---------- Routes ---------- */
// Mount route groups by feature area for easier maintenance.
app.use("/", pageRoutes);
app.use("/auth", authRoutes);
app.use("/tasks", taskRoutes);
app.use("/admin", adminRoutes);
app.use("/account", accountRoutes);

/* 404 */
app.use((req, res) => res.status(404).send("Not found"));

// Ensure schema + admin seed are ready prior to serving traffic.
await ensureAdminSeeded();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ http://localhost:${PORT}`));
