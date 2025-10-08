import validator from "validator";

// Checks the register form server-side before creating the user.
export function validateRegister(req, res, next) { // username, email, phone, password, confirm, name, nickname
  const { username, email, phone, password, confirm, name, nickname } = req.body;
  const errors = [];
  const usernameTrimmed = (username || "").trim();
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(usernameTrimmed)) errors.push("Invalid username.");
  if (!validator.isEmail(email || "")) errors.push("Invalid email.");
  if (!/^\+?\d{7,15}$/.test((phone || "").trim())) errors.push("Invalid phone number.");
  if ((name || "").trim().length > 60) errors.push("Name must be 60 characters or fewer.");
  if ((nickname || "").trim().length > 30) errors.push("Nickname must be 30 characters or fewer.");
  if (!password || password.length < 8) errors.push("Password must be at least 8 characters.");
  if (!/[A-Z]/.test(password)) errors.push("Password needs an uppercase letter.");
  if (!/[a-z]/.test(password)) errors.push("Password needs a lowercase letter.");
  if (!/\d/.test(password)) errors.push("Password needs a number.");
  if (!/[!@#$%^&*(),.?\":{}|<>_\-]/.test(password)) errors.push("Password needs a symbol.");
  if (password !== confirm) errors.push("Passwords do not match.");
  if (errors.length) {
    req.session.error = errors.join(" ");
    return res.redirect("/register");
  }
  next();
}

// Login only needs basic checks, since auth handles the rest.
export function validateLogin(req, res, next) { // identifier can be username or email
  const { identifier, password } = req.body;
  const input = (identifier || "").trim();
  const isEmail = validator.isEmail(input);
  const isUsername = /^[a-zA-Z0-9_]{3,20}$/.test(input);
  if ((!isEmail && !isUsername) || !password) {
    req.session.error = "Invalid credentials.";
    return res.redirect("/login");
  }
  next();
}
