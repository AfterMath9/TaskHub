// Makes sure the user is logged in before letting them continue.
export function ensureAuth(req, res, next) {
  if (!req.session.user) {
    req.session.error = "Please login first.";
    return res.redirect("/login");
  }
  next();
}

// Only admins should reach routes protected by this middleware.
export function ensureAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    req.session.error = "Admins only.";
    return res.redirect("/");
  }
  next();
}

// Used on login/register to push logged in users back to the app.
export function ensureGuest(req, res, next) {
  if (req.session.user) return res.redirect("/");
  next();
}
