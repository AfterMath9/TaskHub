import { Router } from "express";
import bcrypt from "bcryptjs";
import validator from "validator";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { ensureAdmin } from "../middleware/auth.js";
import db from "../models/db.js";

const router = Router();

// ----- shared helpers ----------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const teamUploadDir = path.join(__dirname, "../../public/uploads/team");
fs.mkdirSync(teamUploadDir, { recursive: true });

const teamStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, teamUploadDir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  }
});

const teamUpload = multer({
  storage: teamStorage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = [".png", ".jpg", ".jpeg"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error("Only PNG or JPG images are allowed."));
    }
    cb(null, true);
  }
});

const usernamePattern = /^[a-zA-Z0-9_]{3,20}$/;
const phonePattern = /^\+?\d{7,15}$/;
const teamRedirectTargets = new Set(["/admin/team", "/about"]);
const workshopRedirectTargets = new Set(["/admin/workshops", "/list"]);

// Utility functions -------------------------------------------------------

function slugify(input) {
  return (input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 60);
}

function removeTeamAvatar(filePath) {
  if (!filePath) return;
  const publicRoot = path.join(__dirname, "../../public");
  const absolute = path.isAbsolute(filePath)
    ? filePath
    : path.join(publicRoot, filePath.startsWith("/") ? filePath.slice(1) : filePath);
  if (!absolute.startsWith(publicRoot)) return;
  fs.promises.unlink(absolute).catch(() => {});
}

function resolveTeamRedirect(req, fallback = "/admin/team") {
  let target = "";
  if (req.body && typeof req.body.redirect_to === "string") {
    target = req.body.redirect_to.trim();
  }
  if (teamRedirectTargets.has(target)) return target;

  const referer = req.get("referer") || "";
  if (referer.includes("/about")) return "/about";
  if (referer.includes("/admin/team")) return "/admin/team";
  return fallback;
}

function resolveWorkshopRedirect(req, fallback = "/admin/workshops") {
  let target = "";
  if (req.body && typeof req.body.redirect_to === "string") {
    target = req.body.redirect_to.trim();
  }
  if (workshopRedirectTargets.has(target)) return target;

  const referer = req.get("referer") || "";
  if (referer.includes("/list")) return "/list";
  if (referer.includes("/admin/workshops")) return "/admin/workshops";
  return fallback;
}

async function ensureUniqueSlug(dbh, slug, ignoreId = null) {
  const base = slug && slug.length ? slug : "workshop";
  let candidate = base;
  let attempt = 1;
  while (true) {
    const row = ignoreId
      ? await dbh.get("SELECT id FROM workshops WHERE slug = ? AND id != ?", [candidate, ignoreId])
      : await dbh.get("SELECT id FROM workshops WHERE slug = ?", [candidate]);
    if (!row) return candidate;
    attempt += 1;
    const suffix = `-${attempt}`;
    const sliceLen = Math.max(0, 60 - suffix.length);
    candidate = `${base.slice(0, sliceLen)}${suffix}`;
  }
}

// Enforce consistent password strength before allowing admin changes.
// Enforce consistent password strength before allowing admin changes.
function validatePassword(password) {
  if (!password || password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password needs an uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password needs a lowercase letter.";
  if (!/\d/.test(password)) return "Password needs a number.";
  if (!/[!@#$%^&*(),.?":{}|<>_\-]/.test(password)) return "Password needs a symbol.";
  return null;
}

// ----- user management ---------------------------------------------------

router.get("/users", ensureAdmin, async (req, res) => {
  const dbh = await db;
  const users = await dbh.all("SELECT id, username, email, phone, name, nickname, avatar_path, role, created_at FROM users ORDER BY created_at DESC");
  res.render("users", { title: "Users List", users });
});

router.post("/users", ensureAdmin, async (req, res) => {
  const dbh = await db;
  const username = (req.body.username || "").trim().toLowerCase();
  const email = (req.body.email || "").trim().toLowerCase();
  const phone = (req.body.phone || "").trim();
  const name = (req.body.name || "").trim();
  const nickname = (req.body.nickname || "").trim();
  const role = req.body.role === "admin" ? "admin" : "user";
  const password = req.body.password || "";

  const errors = [];
  if (!usernamePattern.test(username)) errors.push("Invalid username.");
  if (!validator.isEmail(email)) errors.push("Invalid email.");
  if (!phonePattern.test(phone)) errors.push("Invalid phone number.");
  if (name.length > 60) errors.push("Name must be 60 characters or fewer.");
  if (nickname.length > 30) errors.push("Nickname must be 30 characters or fewer.");
  const passwordError = validatePassword(password);
  if (passwordError) errors.push(passwordError);

  if (errors.length) {
    req.session.error = errors.join(" ");
    return res.redirect("/admin/users");
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    await dbh.run(
      "INSERT INTO users (username, email, phone, name, nickname, password_hash, role) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [username, email, phone, name || null, nickname || null, hash, role]
    );
    req.session.success = `Created user ${username}.`;
  } catch (e) {
    req.session.error = e.message.includes("UNIQUE") ? "Username or email already exists." : "Failed to create user.";
  }
  res.redirect("/admin/users");
});

router.post("/users/:id/update", ensureAdmin, async (req, res) => {
  const { id } = req.params;
  const dbh = await db;

  const username = (req.body.username || "").trim().toLowerCase();
  const email = (req.body.email || "").trim().toLowerCase();
  const phone = (req.body.phone || "").trim();
  const name = (req.body.name || "").trim();
  const nickname = (req.body.nickname || "").trim();
  const role = req.body.role === "admin" ? "admin" : "user";
  const password = req.body.password || "";

  const errors = [];
  if (!usernamePattern.test(username)) errors.push("Invalid username.");
  if (!validator.isEmail(email)) errors.push("Invalid email.");
  if (!phonePattern.test(phone)) errors.push("Invalid phone number.");
  if (name.length > 60) errors.push("Name must be 60 characters or fewer.");
  if (nickname.length > 30) errors.push("Nickname must be 30 characters or fewer.");
  if (password) {
    const passwordError = validatePassword(password);
    if (passwordError) errors.push(passwordError);
  }

  if (Number(id) === req.session.user.id && role !== "admin") {
    errors.push("You cannot downgrade your own admin role.");
  }

  if (errors.length) {
    req.session.error = errors.join(" ");
    return res.redirect("/admin/users");
  }

  const updates = [username, email, phone, name || null, nickname || null, role];
  let query = "UPDATE users SET username = ?, email = ?, phone = ?, name = ?, nickname = ?, role = ?";
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    query += ", password_hash = ?";
    updates.push(hash);
  }
  updates.push(id);
  query += " WHERE id = ?";

  try {
    const result = await dbh.run(query, updates);
    if (result.changes === 0) {
      req.session.error = "User not found.";
      return res.redirect("/admin/users");
    }
    const updatedUser = await dbh.get("SELECT id, username, email, role, name, nickname, avatar_path FROM users WHERE id = ?", [id]);
    if (req.session.user && Number(id) === req.session.user.id && updatedUser) {
      req.session.user = {
        ...req.session.user,
        username: updatedUser.username,
        email: updatedUser.email,
        role: updatedUser.role,
        name: updatedUser.name,
        nickname: updatedUser.nickname,
        avatar_path: updatedUser.avatar_path
      };
    }
    req.session.success = "User updated.";
  } catch (e) {
    req.session.error = e.message.includes("UNIQUE") ? "Username or email already exists." : "Failed to update user.";
  }

  res.redirect("/admin/users");
});

router.post("/users/:id/delete", ensureAdmin, async (req, res) => {
  const { id } = req.params;
  if (Number(id) === req.session.user.id) {
    req.session.error = "You cannot delete your own admin account.";
    return res.redirect("/admin/users");
  }
  const dbh = await db;
  await dbh.run("DELETE FROM users WHERE id = ?", [id]);
  req.session.success = "User deleted.";
  res.redirect("/admin/users");
});

// ----- workshop management ----------------------------------------------

router.get("/workshops", ensureAdmin, async (_req, res) => {
  const dbh = await db;
  const workshops = await dbh.all("SELECT * FROM workshops ORDER BY start_date ASC, created_at DESC");
  res.render("admin_workshops", { title: "Manage Workshops", workshops });
});

router.post("/workshops", ensureAdmin, async (req, res) => {
  const dbh = await db;
  const title = (req.body.title || "").trim();
  const summary = (req.body.summary || "").trim();
  const description = (req.body.description || "").trim();
  const startDate = (req.body.start_date || "").trim();
  const location = (req.body.location || "").trim();
  const capacity = parseInt(req.body.capacity, 10);
  const slugInput = (req.body.slug || title).trim();

  const errors = [];
  if (title.length < 3) errors.push("Title must be at least 3 characters.");
  if (summary.length < 10) errors.push("Summary must be at least 10 characters.");
  if (description.length < 20) errors.push("Description must be at least 20 characters.");
  if (!startDate) errors.push("Start date is required.");
  if (!location) errors.push("Location is required.");
  if (Number.isNaN(capacity) || capacity <= 0) errors.push("Capacity must be a positive number.");

  const redirectTo = resolveWorkshopRedirect(req);

  if (errors.length) {
    req.session.error = errors.join(" ");
    return res.redirect(redirectTo);
  }

  const baseSlug = slugify(slugInput) || slugify(title) || `workshop-${Date.now()}`;

  try {
    const uniqueSlug = await ensureUniqueSlug(dbh, baseSlug);
    await dbh.run(
      "INSERT INTO workshops (slug, title, summary, description, start_date, location, capacity) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [uniqueSlug, title, summary, description, startDate, location, capacity]
    );
    req.session.success = "Workshop created.";
  } catch (e) {
    req.session.error = "Failed to create workshop.";
  }
  res.redirect(redirectTo);
});

router.post("/workshops/:id/update", ensureAdmin, async (req, res) => {
  const idNum = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(idNum)) {
    req.session.error = "Invalid workshop id.";
    return res.redirect(resolveWorkshopRedirect(req));
  }
  const dbh = await db;
  const title = (req.body.title || "").trim();
  const summary = (req.body.summary || "").trim();
  const description = (req.body.description || "").trim();
  const startDate = (req.body.start_date || "").trim();
  const location = (req.body.location || "").trim();
  const capacity = parseInt(req.body.capacity, 10);
  const slugInput = (req.body.slug || title).trim();

  const errors = [];
  if (title.length < 3) errors.push("Title must be at least 3 characters.");
  if (summary.length < 10) errors.push("Summary must be at least 10 characters.");
  if (description.length < 20) errors.push("Description must be at least 20 characters.");
  if (!startDate) errors.push("Start date is required.");
  if (!location) errors.push("Location is required.");
  if (Number.isNaN(capacity) || capacity <= 0) errors.push("Capacity must be a positive number.");

  const redirectTo = resolveWorkshopRedirect(req);

  if (errors.length) {
    req.session.error = errors.join(" ");
    return res.redirect(redirectTo);
  }

  const baseSlug = slugify(slugInput) || slugify(title) || `workshop-${Date.now()}`;

  try {
    const uniqueSlug = await ensureUniqueSlug(dbh, baseSlug, idNum);
    const result = await dbh.run(
      `UPDATE workshops
       SET slug = ?, title = ?, summary = ?, description = ?, start_date = ?, location = ?, capacity = ?
       WHERE id = ?`,
      [uniqueSlug, title, summary, description, startDate, location, capacity, idNum]
    );
    if (result.changes === 0) {
      req.session.error = "Workshop not found.";
    } else {
      req.session.success = "Workshop updated.";
    }
  } catch {
    req.session.error = "Failed to update workshop.";
  }

  res.redirect(redirectTo);
});

router.post("/workshops/:id/delete", ensureAdmin, async (req, res) => {
  const idNum = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(idNum)) {
    req.session.error = "Invalid workshop id.";
    return res.redirect(resolveWorkshopRedirect(req));
  }
  const dbh = await db;
  await dbh.run("DELETE FROM workshops WHERE id = ?", [idNum]);
  req.session.success = "Workshop deleted.";
  res.redirect(resolveWorkshopRedirect(req));
});

// ----- team management ---------------------------------------------------

router.get("/team", ensureAdmin, async (_req, res) => {
  const dbh = await db;
  const members = await dbh.all("SELECT * FROM team_members ORDER BY created_at DESC");
  res.render("admin_team", { title: "Manage Team", members });
});

router.post("/team", ensureAdmin, teamUpload.single("avatar"), async (req, res) => {
  const dbh = await db;
  const name = (req.body.name || "").trim();
  const role = (req.body.role || "").trim();
  const bio = (req.body.bio || "").trim();
  const redirectTo = resolveTeamRedirect(req);

  const errors = [];
  if (name.length < 3) errors.push("Name must be at least 3 characters.");
  if (role.length < 2) errors.push("Role must be at least 2 characters.");
  if (bio.length < 10) errors.push("Bio must be at least 10 characters.");

  let avatarPath = null;
  if (req.file) {
    avatarPath = `/uploads/team/${req.file.filename}`;
  }

  if (errors.length) {
    if (req.file) removeTeamAvatar(req.file.path);
    req.session.error = errors.join(" ");
    return res.redirect(redirectTo);
  }

  try {
    await dbh.run(
      "INSERT INTO team_members (name, role, bio, avatar_path) VALUES (?, ?, ?, ?)",
      [name, role, bio, avatarPath]
    );
    req.session.success = "Team member added.";
  } catch {
    if (req.file) removeTeamAvatar(req.file.path);
    req.session.error = "Failed to add team member.";
  }
  res.redirect(redirectTo);
});

router.post("/team/:id/update", ensureAdmin, teamUpload.single("avatar"), async (req, res) => {
  const idNum = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(idNum)) {
    req.session.error = "Invalid team member id.";
    return res.redirect(resolveTeamRedirect(req));
  }
  const dbh = await db;
  const name = (req.body.name || "").trim();
  const role = (req.body.role || "").trim();
  const bio = (req.body.bio || "").trim();
  const removeAvatar = req.body.remove_avatar === "1";
  const redirectTo = resolveTeamRedirect(req);

  const errors = [];
  if (name.length < 3) errors.push("Name must be at least 3 characters.");
  if (role.length < 2) errors.push("Role must be at least 2 characters.");
  if (bio.length < 10) errors.push("Bio must be at least 10 characters.");

  if (errors.length) {
    if (req.file) removeTeamAvatar(req.file.path);
    req.session.error = errors.join(" ");
    return res.redirect(redirectTo);
  }

  try {
    const existing = await dbh.get("SELECT avatar_path FROM team_members WHERE id = ?", [idNum]);
    if (!existing) {
      if (req.file) removeTeamAvatar(req.file.path);
      req.session.error = "Team member not found.";
      return res.redirect(redirectTo);
    }

    let avatarPath = existing.avatar_path;
    if (req.file) {
      avatarPath = `/uploads/team/${req.file.filename}`;
    }
    if (removeAvatar) {
      if (!req.file && existing.avatar_path) removeTeamAvatar(existing.avatar_path);
      avatarPath = null;
    }
    if (req.file && existing.avatar_path) removeTeamAvatar(existing.avatar_path);

    const result = await dbh.run(
      "UPDATE team_members SET name = ?, role = ?, bio = ?, avatar_path = ? WHERE id = ?",
      [name, role, bio, avatarPath, idNum]
    );
    if (result.changes === 0) {
      if (req.file) removeTeamAvatar(`/uploads/team/${req.file.filename}`);
      req.session.error = "Team member not found.";
    } else {
      req.session.success = "Team member updated.";
    }
  } catch {
    if (req.file) removeTeamAvatar(req.file.path);
    req.session.error = "Failed to update team member.";
  }
  res.redirect(redirectTo);
});

router.post("/team/:id/delete", ensureAdmin, async (req, res) => {
  const idNum = Number.parseInt(req.params.id, 10);
  const redirectTo = resolveTeamRedirect(req);
  if (Number.isNaN(idNum)) {
    req.session.error = "Invalid team member id.";
    return res.redirect(redirectTo);
  }
  const dbh = await db;
  const existing = await dbh.get("SELECT avatar_path FROM team_members WHERE id = ?", [idNum]);
  await dbh.run("DELETE FROM team_members WHERE id = ?", [idNum]);
  if (existing && existing.avatar_path) removeTeamAvatar(existing.avatar_path);
  req.session.success = "Team member removed.";
  res.redirect(redirectTo);
});

// Bubble Multer errors into flash messages instead of crashing the request.
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    req.session.error = "File too large. Max 4MB.";
    return res.redirect(resolveTeamRedirect(req));
  }
  if (err && err.message && err.message.includes("Only PNG or JPG")) {
    req.session.error = err.message;
    return res.redirect(resolveTeamRedirect(req));
  }
  next(err);
});

export default router;
