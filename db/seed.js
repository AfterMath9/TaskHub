import sqlite3 from "sqlite3";
import { open } from "sqlite";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "app.sqlite");

export async function ensureAdminSeeded() { // also seeds categories and sample workshops
  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  const schemaSql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  await db.exec(schemaSql);

  // ensure expected columns exist for legacy databases
  const userCols = await db.all("PRAGMA table_info(users)");
  const columnExists = (name) => userCols.some((col) => col.name === name);

  if (!columnExists("username")) { 
    await db.exec("ALTER TABLE users ADD COLUMN username TEXT");
  }
  await db.run("UPDATE users SET username = LOWER(email) WHERE username IS NULL OR username = ''");
  await db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)");

  if (!columnExists("name")) {
    await db.exec("ALTER TABLE users ADD COLUMN name TEXT");
  }
  if (!columnExists("nickname")) {
    await db.exec("ALTER TABLE users ADD COLUMN nickname TEXT");
  }
  if (!columnExists("avatar_path")) {
    await db.exec("ALTER TABLE users ADD COLUMN avatar_path TEXT");
  }

  // admin user
  const adminIdentifier = "admin";
  const adminEmail = "admin@admin.com";
  const adminPassword = "wdf#2025";
  const admin = await db.get(
    "SELECT * FROM users WHERE username = ? OR email = ?",
    [adminIdentifier, adminEmail]
  );
  const adminHash = await bcrypt.hash(adminPassword, 10);
  if (!admin) {
    await db.run(
      "INSERT INTO users (username, email, phone, name, nickname, avatar_path, password_hash, role) VALUES (?, ?, ?, ?, ?, ?, ?, 'admin')",
      [adminIdentifier, adminEmail, "0000000000", "Administrator", "admin", null, adminHash]
    );
    console.log("🔐 Seeded admin / wdf#2025");
  } else {
    await db.run(
      "UPDATE users SET username = ?, email = ?, phone = ?, name = COALESCE(name, ?), nickname = COALESCE(nickname, ?), password_hash = ?, role = 'admin' WHERE id = ?",
      [
        adminIdentifier,
        adminEmail,
        admin.phone || "0000000000",
        admin.name || "Administrator",
        admin.nickname || "admin",
        adminHash,
        admin.id
      ]
    );
    console.log("🔄 Ensured admin credentials are up to date.");
  }

  // categories
  const catRows = await db.all("SELECT name FROM categories");
  const existingCats = new Set(catRows.map((r) => r.name));
  const categorySeeds = [
    "General",
    "School",
    "Work",
    "Personal",
    "Urgent",
    "Health",
    "Finance",
    "Shopping",
    "Travel",
    "Learning",
    "Family"
  ];
  let inserted = 0;
  for (const name of categorySeeds) {
    if (!existingCats.has(name)) {
      await db.run("INSERT INTO categories (name) VALUES (?)", [name]);
      inserted++;
    }
  }
  if (inserted > 0) {
    console.log(`📚 Seeded ${inserted} categories.`);
  }

  // tasks
  const workshopExisting = await db.all("SELECT slug FROM workshops");
  const workshopHas = new Set(workshopExisting.map((row) => row.slug));
  const simpleWorkshops = [
      { slug: "intro-html", title: "Intro to HTML", summary: "Build your first web page.", description: "Learn the building blocks of the web including tags, images, and links while creating a simple landing page.", start_date: "February 17, 2025", location: "Lab 1", capacity: 28 },
      { slug: "css-layouts", title: "CSS Layouts", summary: "Flexbox and Grid basics.", description: "Understand how Flexbox and CSS Grid help you position elements responsively with hands-on exercises.", start_date: "February 24, 2025", location: "Lab 1", capacity: 26 },
      { slug: "js-fundamentals", title: "JavaScript Fundamentals", summary: "Make pages interactive.", description: "Cover variables, functions, arrays, and DOM updates to add simple interactivity to your projects.", start_date: "March 3, 2025", location: "Room 3", capacity: 30 },
      { slug: "node-basics", title: "Node Basics", summary: "Server-side JavaScript.", description: "Spin up a tiny API with Express and understand routing, middleware, and JSON responses.", start_date: "March 10, 2025", location: "Room 4", capacity: 27 },
      { slug: "express-routes", title: "Express Routes", summary: "Clean routing patterns.", description: "Structure your Express application with controllers, validation, and helpful utilities for maintainable backends.", start_date: "March 17, 2025", location: "Room 4", capacity: 25 },
      { slug: "handlebars-views", title: "Handlebars Views", summary: "Templating made easy.", description: "Bind server data to dynamic templates and reuse layouts, partials, and helpers effectively.", start_date: "March 24, 2025", location: "Studio 2", capacity: 29 },
      { slug: "sqlite-basics", title: "SQLite Basics", summary: "Store web data simply.", description: "Create tables, run joins, and connect SQLite with Express using parameterised queries.", start_date: "March 31, 2025", location: "Lab 2", capacity: 30 },
      { slug: "auth-patterns", title: "Auth Patterns", summary: "Sessions and hashing.", description: "Implement secure logins with bcrypt, Express sessions, and middleware guards step-by-step.", start_date: "April 7, 2025", location: "Lab 2", capacity: 28 },
      { slug: "ui-polish", title: "UI Polish", summary: "Responsive finishing touches.", description: "Use modern CSS to make layouts shine across breakpoints with reusable utility styles.", start_date: "April 14, 2025", location: "Design Lab", capacity: 27 },
      { slug: "deploy-checklist", title: "Deploy Checklist", summary: "Prepare for production.", description: "Review environment variables, logging, error handling, and backups before you go live.", start_date: "April 21, 2025", location: "Online", capacity: 30 }
    ];
  let seededWorkshops = 0;
  for (const w of simpleWorkshops) {
    if (!workshopHas.has(w.slug)) {
      await db.run(
        "INSERT INTO workshops (slug, title, summary, description, start_date, location, capacity) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [w.slug, w.title, w.summary, w.description, w.start_date, w.location, w.capacity]
      );
      workshopHas.add(w.slug);
      seededWorkshops++;
    }
  }

  if (seededWorkshops) console.log(`🎟️ Seeded ${seededWorkshops} sample workshops.`);

  // Preload a mentor roster that can be edited/removed by the admin later.
  const teamExisting = await db.all("SELECT name FROM team_members");
  const teamHas = new Set(teamExisting.map((row) => row.name));
  const teamSeeds = [
      { name: "Amrou 1", role: "Full Stack Developer", bio: "Builds end-to-end features and keeps deployments smooth." },
      { name: "Amrou 2", role: "Frontend Specialist", bio: "Crafts accessible interfaces with modern CSS and JavaScript." },
      { name: "Amrou 3", role: "Backend Specialist", bio: "Designs clean APIs and reliable data flows for the team." },
      { name: "Amrou 4", role: "Database Expert", bio: "Tunes queries and keeps our schemas scalable and safe." },
      { name: "Amrou 5", role: "DevOps Engineer", bio: "Automates pipelines and monitors performance round the clock." },
      { name: "Hamid 1", role: "Full Stack Developer", bio: "Pairs with designers and engineers to ship polished features." },
      { name: "Hamid 2", role: "Frontend Specialist", bio: "Keeps the UI fast, responsive, and delightful on every device." },
      { name: "Hamid 3", role: "Backend Specialist", bio: "Implements secure endpoints and clear business logic." },
      { name: "Hamid 4", role: "Database Expert", bio: "Models data, seeds fixtures, and documents migrations." },
      { name: "Hamid 5", role: "DevOps Engineer", bio: "Prepares release checklists and disaster-recovery drills." }
    ];
  let seededMembers = 0;
  for (const member of teamSeeds) {
    if (!teamHas.has(member.name)) {
      await db.run(
        "INSERT INTO team_members (name, role, bio, avatar_path) VALUES (?, ?, ?, ?)",
        [member.name, member.role, member.bio, null]
      );
      teamHas.add(member.name);
      seededMembers++;
    }
  }

  if (seededMembers) console.log(`👥 Seeded ${seededMembers} team members.`);

  await db.close();
}

// allow `node db/seed.js`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  ensureAdminSeeded().then(() => process.exit(0));
}
