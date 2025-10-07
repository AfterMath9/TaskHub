export function ensureAuth(req, res, next) {
  if (!req.session.user) {
    req.session.error = "Please login first.";
    return res.redirect("/login");
  }
  next();
}

export function ensureAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    req.session.error = "Admins only.";
    return res.redirect("/");
  }
  next();
}

export function ensureGuest(req, res, next) {
  if (req.session.user) return res.redirect("/");
  next();
}