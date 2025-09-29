const db = require('../db/connection');

module.exports = {
  all() {
    return new Promise((resolve, reject) =>
      db.all(`SELECT * FROM categories ORDER BY name`, [], (e, rows) => e ? reject(e) : resolve(rows))
    );
  },
  create(name) {
    return new Promise((resolve, reject) =>
      db.run(`INSERT INTO categories (name) VALUES (?)`, [name], function (e) {
        if (e) return reject(e); resolve(this.lastID);
      })
    );
  },
  rename(id, name) {
    return new Promise((resolve, reject) =>
      db.run(`UPDATE categories SET name=? WHERE id=?`, [name, id], function (e) {
        if (e) return reject(e); resolve(this.changes);
      })
    );
  },
  remove(id) {
    return new Promise((resolve, reject) =>
      db.run(`DELETE FROM categories WHERE id=?`, [id], function (e) {
        if (e) return reject(e); resolve(this.changes);
      })
    );
  }
};