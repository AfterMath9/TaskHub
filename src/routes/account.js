import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import validator from "validator";

import { ensureAuth } from "../middleware/auth.js";
import db from "../models/db.js";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, "../../public/uploads/avatars");

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  }
});

function fileFilter(_req, file, cb) {
  const allowed = [".png", ".jpg", ".jpeg"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowed.includes(ext)) {
    return cb(new Error("Only PNG or JPG images are allowed."));
  }
  cb(null, true);
}

// Multer pipeline used for profile avatar uploads.
const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 }, // 12MB
  fileFilter
});

const usernamePattern = /^[a-zA-Z0-9_]{3,20}$/;
const phonePattern = /^\+?\d{7,15}$/;

function validatePassword(password) {
  if (!password || password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password needs an uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password needs a lowercase letter.";
  if (!/\d/.test(password)) return "Password needs a number.";
  if (!/[!@#$%^&*(),.?":{}|<>_\-]/.test(password)) return "Password needs a symbol.";
  return null;
}

function removeAvatarFile(avatarPath) {
  if (!avatarPath) return;
  const publicRoot = path.join(__dirname, "../../public");
  const resolved = path.isAbsolute(avatarPath)
    ? avatarPath
    : path.join(publicRoot, avatarPath.startsWith("/") ? avatarPath.slice(1) : avatarPath);
  if (!resolved.startsWith(publicRoot)) return;
  fs.promises.unlink(resolved).catch(() => {});
}

// Render profile settings along with the current account snapshot.
router.get("/", ensureAuth, async (req, res) => {
  const dbh = await db;
  const profile = await dbh.get(
    `SELECT id, username, email, phone, name, nickname, avatar_path, role, created_at
     FROM users WHERE id = ?`,
    [req.session.user.id]
  );

  if (!profile) {
    req.session.error = "Account not found.";
    return res.redirect("/login");
  }

  res.render("account", { title: "Account Settings", profile });
});

// Persist profile updates including optional avatar/password changes.
router.post("/", ensureAuth, upload.single("avatar"), async (req, res) => {
  const dbh = await db;
  const userId = req.session.user.id;
  const current = await dbh.get("SELECT * FROM users WHERE id = ?", [userId]);
  if (!current) {
    req.session.error = "Account not found.";
    return res.redirect("/login");
  }

  const username = (req.body.username || "").trim().toLowerCase();
  const email = (req.body.email || "").trim().toLowerCase();
  const phone = (req.body.phone || "").trim();
  const name = (req.body.name || "").trim();
  const nickname = (req.body.nickname || "").trim();
  const password = req.body.password || "";
  const confirm = req.body.confirm || "";
  const removeAvatar = req.body.remove_avatar === "1";

  const errors = [];
  if (!usernamePattern.test(username)) errors.push("Invalid username.");
  if (!validator.isEmail(email)) errors.push("Invalid email.");
  if (!phonePattern.test(phone)) errors.push("Invalid phone number.");
  if (name && name.length > 60) errors.push("Name must be 60 characters or fewer.");
  if (nickname && nickname.length > 30) errors.push("Nickname must be 30 characters or fewer.");
  if (password) {
    const passError = validatePassword(password);
    if (passError) errors.push(passError);
    if (password !== confirm) errors.push("Passwords do not match.");
  }

  let avatarPath = current.avatar_path;

  if (req.file) {
    avatarPath = `/uploads/avatars/${req.file.filename}`;
  }

  if (removeAvatar && !req.file) {
    avatarPath = null;
  }

  if (errors.length) {
    if (req.file) removeAvatarFile(path.join(uploadDir, req.file.filename));
    req.session.error = errors.join(" ");
    return res.redirect("/account");
  }

  const updates = [username, email, phone, name || null, nickname || null];
  let updateSql = "UPDATE users SET username = ?, email = ?, phone = ?, name = ?, nickname = ?";

  if (req.file || removeAvatar) {
    updateSql += ", avatar_path = ?";
    updates.push(avatarPath);
  }

  if (password) {
    const hash = await bcrypt.hash(password, 10);
    updateSql += ", password_hash = ?";
    updates.push(hash);
  }

  updateSql += " WHERE id = ?";
  updates.push(userId);

  try {
    await dbh.run(updateSql, updates);
    if (req.file && current.avatar_path) {
      removeAvatarFile(current.avatar_path);
    } else if (removeAvatar && current.avatar_path) {
      removeAvatarFile(current.avatar_path);
    }

    req.session.user = {
      ...req.session.user,
      username,
      email,
      name: name || null,
      nickname: nickname || null,
      avatar_path: avatarPath,
      role: current.role
    };

    req.session.success = "Account updated.";
  } catch (e) {
    if (req.file) removeAvatarFile(path.join(uploadDir, req.file.filename));
    const uniqueError = e.message && e.message.includes("UNIQUE");
    req.session.error = uniqueError ? "Username or email already exists." : "Failed to update account.";
  }

  res.redirect("/account");
});

router.post("/avatar/delete", ensureAuth, async (req, res) => {
  const dbh = await db;
  const userId = req.session.user.id;
  const current = await dbh.get("SELECT avatar_path FROM users WHERE id = ?", [userId]);
  if (!current) {
    req.session.error = "Account not found.";
    return res.redirect("/login");
  }
  if (!current.avatar_path) {
    req.session.success = "No avatar to remove.";
    return res.redirect("/account");
  }
  await dbh.run("UPDATE users SET avatar_path = NULL WHERE id = ?", [userId]);
  removeAvatarFile(current.avatar_path);
  req.session.user = { ...req.session.user, avatar_path: null };
  req.session.success = "Avatar removed.";
  res.redirect("/account");
});

router.use((err, req, res, next) => {
  if (err) {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      req.session.error = "File too large. Max 12MB.";
      return res.redirect("/account");
    }
    if (err.message && err.message.includes("Only PNG or JPG")) {
      req.session.error = err.message;
      return res.redirect("/account");
    }
  }
  next(err);
});

export default router;
