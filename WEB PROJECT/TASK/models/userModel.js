const db = require('../db/connection');

module.exports = {
  findByEmail(email) {
    return new Promise((resolve, reject) =>
      db.get(`SELECT * FROM users WHERE email = ?`, [email], (e, r) => e ? reject(e) : resolve(r))
    );
  },
  findById(id) {
    return new Promise((resolve, reject) =>
      db.get(`SELECT * FROM users WHERE id = ?`, [id], (e, r) => e ? reject(e) : resolve(r))
    );
  },
  all() {
    return new Promise((resolve, reject) =>
      db.all(`SELECT id,email,role,created_at FROM users ORDER BY created_at DESC`, [], (e, rows) => e ? reject(e) : resolve(rows))
    );
  },
  create({ email, password_hash, role }) {
    return new Promise((resolve, reject) =>
      db.run(`INSERT INTO users (email,password_hash,role) VALUES (?,?,?)`,
        [email, password_hash, role || 'user'],
        function (e) { if (e) return reject(e); resolve({ id: this.lastID }); })
    );
  },
  update({ id, email, password_hash, role }) {
    const fields = []; const params = [];
    if (email) { fields.push('email = ?'); params.push(email); }
    if (password_hash) { fields.push('password_hash = ?'); params.push(password_hash); }
    if (role) { fields.push('role = ?'); params.push(role); }
    params.push(id);
    return new Promise((resolve, reject) =>
      db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params, function (e) {
        if (e) return reject(e); resolve(this.changes);
      })
    );
  },
  remove(id) {
    return new Promise((resolve, reject) =>
      db.run(`DELETE FROM users WHERE id = ?`, [id], function (e) { if (e) return reject(e); resolve(this.changes); })
    );
  }
};