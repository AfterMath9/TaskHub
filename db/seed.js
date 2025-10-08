import sqlite3 from "sqlite3";
import { open } from "sqlite";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "app.sqlite");

// This helper fills the database with starter data so the app works right away.
export async function ensureAdminSeeded() { // also seeds categories and sample workshops
  // Open the database so we can run queries.
  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  // Read the schema file to make sure tables exist.
  const schemaSql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  await db.exec(schemaSql);

  // ensure expected columns exist for legacy databases
  const userCols = await db.all("PRAGMA table_info(users)");
  // Helper to check if a column is already present.
  const columnExists = (name) => userCols.some((col) => col.name === name);

  // Add missing user columns if someone is using an older DB.
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
  // Make sure the default admin account exists so we can log in.
  const adminIdentifier = "admin";
  const adminEmail = "admin@admin.com";
  const adminPassword = "wdf#2025";
  const admin = await db.get(
    "SELECT * FROM users WHERE username = ? OR email = ?",
    [adminIdentifier, adminEmail]
  );
  // Hash the password so we store it safely.
  const adminHash = await bcrypt.hash(adminPassword, 10);
  if (!admin) {
    // Create the admin if they are missing.
    await db.run(
      "INSERT INTO users (username, email, phone, name, nickname, avatar_path, password_hash, role) VALUES (?, ?, ?, ?, ?, ?, ?, 'admin')",
      [adminIdentifier, adminEmail, "0000000000", "Administrator", "admin", null, adminHash]
    );
    console.log(" Seeded admin / wdf#2025");
  } else {
    // Otherwise update the old admin record with the new values.
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
    console.log(" Ensured admin credentials are up to date.");
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
  let inserted = 0; // tracks how many new categories we add
  for (const name of categorySeeds) {
    // Only insert categories that are not already there.
    if (!existingCats.has(name)) {
      await db.run("INSERT INTO categories (name) VALUES (?)", [name]);
      inserted++;
    }
  }
  if (inserted > 0) {
    console.log(` Seeded ${inserted} categories.`);
  }

  // sample workshops
  // List of workshops I want to exist when the app starts.
  const simpleWorkshops = [
      { slug: "html", title: "HTML", summary: "Build your web page.", description: "Learn the building of the web including tags, images, and links while.", start_date: "February 17, 2025", location: "Lab 1", capacity: 28 },
      { slug: "css", title: "CSS", summary: "Flexbox and Grid.", description: "Understand how Flexbox and CSS Grid helps you.", start_date: "February 24, 2025", location: "Lab 1", capacity: 26 },
      { slug: "js", title: "JavaScript", summary: "Make pages interactive.", description: "Covers variables, functions and arrays.", start_date: "March 3, 2025", location: "Room 3", capacity: 30 },
      { slug: "node-js", title: "Node JS", summary: "Server-side JavaScript.", description: "API with Express, routing and JSON responses.", start_date: "March 10, 2025", location: "Room 4", capacity: 27 },
      { slug: "express-routes", title: "Express Routes", summary: "Routing.", description: "Structure your Express application.", start_date: "March 17, 2025", location: "Room 4", capacity: 25 },
      { slug: "handlebars", title: "Handlebars", summary: "Template.", description: "Link server data to dynamic templates.", start_date: "March 24, 2025", location: "Studio 2", capacity: 29 },
      { slug: "sqlite", title: "SQLite", summary: "Store web data.", description: "Create tables, run joins, and connect SQLite with Express.", start_date: "March 31, 2025", location: "Lab 2", capacity: 30 },
      { slug: "auth", title: "Authintication", summary: "hashing.", description: "Implement secure logins with bcrypt step-by-step.", start_date: "April 7, 2025", location: "Lab 2", capacity: 28 },
      { slug: "ui-design", title: "UI Design", summary: "Responsive UI.", description: "Use modern CSS to make layouts.", start_date: "April 14, 2025", location: "Design Lab", capacity: 27 },
      { slug: "deploy", title: "Deploy", summary: "Ready to publish.", description: "Review variables, error handling, and backups before you publish web apps.", start_date: "April 21, 2025", location: "Online", capacity: 30 }
    ];
  let seededWorkshops = 0; // new workshops we insert
  let updatedWorkshops = 0; // workshops we already had and just change
  for (const w of simpleWorkshops) {
    const existingWorkshop = await db.get("SELECT id FROM workshops WHERE slug = ?", [w.slug]);
    if (existingWorkshop) {
      // Update the workshop if the slug already exists.
      await db.run(
        "UPDATE workshops SET title = ?, summary = ?, description = ?, start_date = ?, location = ?, capacity = ? WHERE id = ?",
        [w.title, w.summary, w.description, w.start_date, w.location, w.capacity, existingWorkshop.id]
      );
      updatedWorkshops++;
    } else {
      // Add the new workshop if it is not there yet.
      await db.run(
        "INSERT INTO workshops (slug, title, summary, description, start_date, location, capacity) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [w.slug, w.title, w.summary, w.description, w.start_date, w.location, w.capacity]
      );
      seededWorkshops++;
    }
  }

  if (seededWorkshops) console.log(` Seeded ${seededWorkshops} sample workshops.`);
  if (updatedWorkshops) console.log(` Updated ${updatedWorkshops} workshops from seed data.`);

  const workshopSlugs = simpleWorkshops.map((w) => w.slug);
  // Remove any workshops that are no longer in the seed list.
  if (workshopSlugs.length) {
    const placeholders = workshopSlugs.map(() => "?").join(", ");
    await db.run(`DELETE FROM workshops WHERE slug NOT IN (${placeholders})`, workshopSlugs);
  } else {
    await db.run("DELETE FROM workshops");
  }

  // team members
  // Sample team roster to show on the About page.
  const teamSeeds = [
      { name: "Amrou 1", role: "Full Stack Developer", bio: "Builds end-to-end." },
      { name: "Amrou 2", role: "Frontend", bio: "Creates interfaces with modern CSS and JavaScript." },
      { name: "Amrou 3", role: "Backend", bio: "Designs APIs and data for the team." },
      { name: "Amrou 4", role: "Database", bio: "Creates queries and schemas." },
      { name: "Amrou 5", role: "DevOps Engineer", bio: "Dev0ps." },
      { name: "Hamid 1", role: "Full Stack Developer", bio: "Works with designers and engineers to ship great features." },
      { name: "Hamid 2", role: "Frontend", bio: "Makes the UI responsive on every device." },
      { name: "Hamid 3", role: "Backend", bio: "Adds secure endpoints." },
      { name: "Hamid 4", role: "Database", bio: "Creates queries and schemas." },
      { name: "Hamid 5", role: "DevOps Engineer", bio: "Dev0ps." }
    ];
  let seededMembers = 0; // counts brand new teammates we add
  let updatedMembers = 0; // counts teammates we refresh
  for (const member of teamSeeds) {
    const existingMember = await db.get("SELECT id FROM team_members WHERE name = ?", [member.name]);
    if (existingMember) {
      // Update the teammate if they already exist.
      await db.run(
        "UPDATE team_members SET role = ?, bio = ?, avatar_path = ? WHERE id = ?",
        [member.role, member.bio, member.avatar_path ?? null, existingMember.id]
      );
      updatedMembers++;
    } else {
      await db.run(
        "INSERT INTO team_members (name, role, bio, avatar_path) VALUES (?, ?, ?, ?)",
        [member.name, member.role, member.bio, member.avatar_path ?? null]
      );
      seededMembers++;
    }
  }

  if (seededMembers) console.log(` Seeded ${seededMembers} team members.`);
  if (updatedMembers) console.log(` Updated ${updatedMembers} team members from seed data.`);

  const teamNames = teamSeeds.map((member) => member.name);
  // Clean up any team members that were removed from the list.
  if (teamNames.length) {
    const placeholders = teamNames.map(() => "?").join(", ");
    await db.run(`DELETE FROM team_members WHERE name NOT IN (${placeholders})`, teamNames);
  } else {
    await db.run("DELETE FROM team_members");
  }

  // Close the connection when we are done.
  await db.close();
}

// If I run `node db/seed.js` directly, this kicks off the seeding.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  ensureAdminSeeded().then(() => process.exit(0));
}
