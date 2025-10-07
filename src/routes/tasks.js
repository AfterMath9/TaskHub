import { Router } from "express";
import { ensureAuth, ensureAdmin } from "../middleware/auth.js";
import db from "../models/db.js";

const router = Router();

/* Create user task */
// Standard user-owned task creation (prevent empty titles on submit).
router.post("/", ensureAuth, async (req, res) => {
  const { title, description, category_id } = req.body;
  if (!title || !title.trim()) { req.session.error = "Task title required."; return res.redirect("/"); }
  const dbh = await db;
  await dbh.run(
    "INSERT INTO tasks (user_id, category_id, title, description, is_primary, created_by) VALUES (?, ?, ?, ?, 0, ?)",
    [req.session.user.id, category_id || null, title.trim(), (description || "").trim(), req.session.user.id]
  );
  res.redirect("/");
});

/* Admin: create primary task (visible to all) */
router.post("/primary", ensureAdmin, async (req, res) => {
  const { title, description, category_id } = req.body;
  const dbh = await db;
  await dbh.run(
    "INSERT INTO tasks (user_id, category_id, title, description, is_primary, created_by) VALUES (NULL, ?, ?, ?, 1, ?)",
    [category_id || null, title.trim(), (description || "").trim(), req.session.user.id]
  );
  res.redirect("/");
});

/* Update (owner or admin if primary) */
router.post("/:id", ensureAuth, async (req, res) => {
  const { id } = req.params;
  const { title = "", description = "", completed, category_id } = req.body;
  const dbh = await db;

  const task = await dbh.get("SELECT * FROM tasks WHERE id = ?", [id]);
  if (!task) return res.redirect("/");

  const user = req.session.user;
  const isOwner = task.user_id === user.id;
  const isEditablePrimary = task.is_primary === 1 && user.role === "admin";
  if (!isOwner && !isEditablePrimary) { req.session.error = "Not allowed."; return res.redirect("/"); }

  const done = completed ? 1 : 0;
  const cat = category_id ? Number(category_id) : null;

  await dbh.run(
    `UPDATE tasks
     SET title=?, description=?, completed=?, category_id=?, updated_at=CURRENT_TIMESTAMP
     WHERE id=?`,
    [title.trim(), (description || "").trim(), done, cat, id]
  );
  res.redirect("/");
});

/* Delete */
router.post("/:id/delete", ensureAuth, async (req, res) => {
  const { id } = req.params;
  const dbh = await db;
  const task = await dbh.get("SELECT * FROM tasks WHERE id = ?", [id]);
  if (!task) return res.redirect("/");
  const user = req.session.user;
  const isOwner = task.user_id === user.id;
  const isPrimaryAdmin = task.is_primary === 1 && user.role === "admin";
  if (!isOwner && !isPrimaryAdmin) { req.session.error = "Not allowed."; return res.redirect("/"); }
  await dbh.run("DELETE FROM tasks WHERE id = ?", [id]);
  res.redirect("/");
});

export default router;
