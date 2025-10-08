import { Router } from "express";
import { ensureAuth } from "../middleware/auth.js";
import db from "../models/db.js";

const router = Router();

/* HOME (protected) with JOIN + pagination */
// Shows dashboard widgets + paginated personal tasks with category lookup.
router.get("/", ensureAuth, async (req, res) => {
  const userId = req.session.user.id;
  const dbh = await db;

  const primary = await dbh.all(
    `SELECT t.*, c.name AS category_name, u.email AS creator_email
     FROM tasks t
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN users u ON t.created_by = u.id
     WHERE t.is_primary = 1
     ORDER BY t.created_at DESC`
  );

  const perPage = 3;
  const page = Math.max(1, parseInt(req.query.p || "1", 10));
  const { cnt } = await dbh.get("SELECT COUNT(*) AS cnt FROM tasks WHERE user_id=?", [userId]);
  const pages = Math.max(1, Math.ceil(cnt / perPage));
  const offset = (page - 1) * perPage;

  const mine = await dbh.all(
    `SELECT t.*, c.name AS category_name
     FROM tasks t
     LEFT JOIN categories c ON t.category_id = c.id
     WHERE t.user_id = ?
     ORDER BY t.created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, perPage, offset]
  );

  const categories = await dbh.all("SELECT id, name FROM categories ORDER BY name ASC");

  res.render("home", {
    title: "Home",
    primary,
    mine,
    categories,
    pagination: { page, pages, perPage, count: cnt }
  });
});

/* PUBLIC: auth entry pages */
router.get("/login", (req, res) => res.render("login", { title: "Login" }));
router.get("/register", (req, res) => res.render("register", { title: "Register" }));

/* PROTECTED pages */
// Remaining authenticated pages: contact, about, list + detail.
router.get("/contact", ensureAuth, (req, res) => {
  res.render("contact", { title: "Contact" });
});
router.get("/about", ensureAuth, async (req, res) => {
  const dbh = await db;
  const { total: totalWorkshops } = await dbh.get("SELECT COUNT(*) AS total FROM workshops");
  const { total: totalMembers } = await dbh.get("SELECT COUNT(*) AS total FROM team_members");

  const teamPerPage = 4;
  const requestedPage = Math.max(1, parseInt(req.query.teamPage || "1", 10));
  const totalPages = Math.max(1, Math.ceil(totalMembers / teamPerPage));
  const teamPage = Math.min(requestedPage, totalPages);
  const teamOffset = (teamPage - 1) * teamPerPage;

  const team = await dbh.all(
    "SELECT id, name, role, bio, avatar_path FROM team_members ORDER BY name ASC LIMIT ? OFFSET ?",
    [teamPerPage, teamOffset]
  );
  const teamPageNumbers = Array.from({ length: totalPages }, (_v, idx) => idx + 1);
  res.render("about", {
    title: "About",
    team,
    metrics: { workshops: totalWorkshops, members: totalMembers },
    teamPagination: {
      page: teamPage,
      pages: totalPages,
      perPage: teamPerPage,
      total: totalMembers,
      hasPrev: teamPage > 1,
      hasNext: teamPage < totalPages,
      pageNumbers: teamPageNumbers
    }
  });
});

router.get("/list", ensureAuth, async (req, res) => {
  const dbh = await db;
  const perPage = 4;
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const { total } = await dbh.get("SELECT COUNT(*) AS total FROM workshops");
  const pages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(page, pages);
  const offset = (currentPage - 1) * perPage;

  const workshops = await dbh.all(
    "SELECT id, slug, title, summary, description, start_date, location, capacity FROM workshops ORDER BY start_date LIMIT ? OFFSET ?",
    [perPage, offset]
  );

  const pageNumbers = Array.from({ length: pages }, (_v, idx) => idx + 1);

  res.render("list", {
    title: "Workshops",
    workshops,
    pagination: {
      page: currentPage,
      pages,
      perPage,
      total,
      hasPrev: currentPage > 1,
      hasNext: currentPage < pages
    },
    pageNumbers
  });
});

router.get("/list/:slug", ensureAuth, async (req, res) => {
  const dbh = await db;
  const workshop = await dbh.get("SELECT * FROM workshops WHERE slug = ?", [req.params.slug]);
  if (!workshop) return res.status(404).send("Not found");
  const suggestions = await dbh.all(
    "SELECT slug, title, summary FROM workshops WHERE slug != ? ORDER BY start_date LIMIT 3",
    [req.params.slug]
  );
  res.render("list_detail", { title: workshop.title, workshop, suggestions });
});

export default router;
