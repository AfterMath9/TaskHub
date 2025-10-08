import { Router } from "express";
import bcrypt from "bcryptjs";
import db from "../models/db.js";
import { ensureGuest } from "../middleware/auth.js";
import { validateRegister, validateLogin } from "../middleware/validate.js";

const router = Router();

// Public routes that handle signup/signin before redirecting into the app.

// Handle the register form after it passes the middleware checks.
router.post("/register", ensureGuest, validateRegister, async (req, res) => {
  const { username, email, phone, password, name, nickname } = req.body;
  const usernameNormalized = (username || "").trim().toLowerCase();
  const emailNormalized = (email || "").trim().toLowerCase();
  const phoneNormalized = (phone || "").trim();
  const nameTrimmed = (name || "").trim();
  const nicknameTrimmed = (nickname || "").trim();
  const dbh = await db;
  try {
    // Hash the password and create the new user.
    const hash = await bcrypt.hash(password, 10);
    await dbh.run(
      "INSERT INTO users (username, email, phone, name, nickname, password_hash, role) VALUES (?, ?, ?, ?, ?, ?, 'user')",
      [usernameNormalized, emailNormalized, phoneNormalized, nameTrimmed || null, nicknameTrimmed || null, hash]
    );
    req.session.success = "Registered. Please login.";
    res.redirect("/login");
  } catch (e) {
    req.session.error = e.message.includes("UNIQUE") ? "Username or email already exists." : "Registration failed.";
    res.redirect("/register");
  }
});

// Handle the login form after validator middleware passes it.
router.post("/login", ensureGuest, validateLogin, async (req, res) => {
  const { identifier, password } = req.body;
  const dbh = await db;
  const ident = (identifier || "").trim().toLowerCase();
  const user = await dbh.get(
    "SELECT * FROM users WHERE username = ? OR email = ?",
    [ident, ident]
  );
  // If we don't find the user, bail out with an error.
  if (!user) { req.session.error = "Invalid credentials."; return res.redirect("/login"); }
  const ok = await bcrypt.compare(password, user.password_hash);
  // Wrong password means show the same error for security.
  if (!ok) { req.session.error = "Invalid credentials."; return res.redirect("/login"); }
  // Store only the data the app needs in the session.
  req.session.user = {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    name: user.name,
    nickname: user.nickname,
    avatar_path: user.avatar_path
  };
  res.redirect("/");
});

// Simple logout: wipe the session and go to login.
router.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

export default router;
