const Validate = {
  email(s){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s||"").trim()); },
  phone(s){ return /^\+?\d{7,15}$/.test((s||"").trim()); },
  username(s){ return /^[a-zA-Z0-9_]{3,20}$/.test((s||"").trim()); },
  strong(p){
    return p.length>=8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p) && /[!@#$%^&*(),.?":{}|<>_\-]/.test(p);
  },
  register(form){
    const username = form.username.value;
    const email = form.email.value;
    const phone = form.phone.value;
    const name = form.name ? form.name.value.trim() : "";
    const nickname = form.nickname ? form.nickname.value.trim() : "";
    const pw = form.password.value;
    const cf = form.confirm.value;

    const errors = [];
    if(!Validate.username(username)) errors.push("Username must be 3-20 characters, letters/numbers/_.");
    if(!Validate.email(email)) errors.push("Email format is invalid.");
    if(!Validate.phone(phone)) errors.push("Phone must be digits, 7–15, optional +.");
    if(name.length > 60) errors.push("Name too long (max 60).");
    if(nickname.length > 30) errors.push("Nickname too long (max 30).");
    if(!Validate.strong(pw)) errors.push("Password too weak.");
    if(pw !== cf) errors.push("Passwords do not match.");
    if(errors.length){ alert(errors.join("\n")); return false; }
    return true;
  },
  login(form){
    const ident = form.identifier.value.trim();
    const validIdent = Validate.email(ident) || Validate.username(ident);
    if(!validIdent || !form.password.value){
      alert("Invalid username/email or password.");
      return false;
    }
    return true;
  }
};
window.Validate = Validate;
