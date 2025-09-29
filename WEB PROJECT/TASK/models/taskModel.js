const db = require('../db/connection');

module.exports = {
  countByUser(userId) {
    return new Promise((resolve, reject) =>
      db.get(`SELECT COUNT(*) AS n FROM tasks WHERE user_id = ?`, [userId], (e, r) => e ? reject(e) : resolve(r.n))
    );
  },
  byUserPaged(userId, { limit = 3, offset = 0 }) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT t.id, t.title, t.is_done, t.created_at, c.name AS category, c.id AS category_id
         FROM tasks t
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE t.user_id = ?
         ORDER BY t.created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, offset],
        (err, rows) => err ? reject(err) : resolve(rows)
      );
    });
  },
  findOne({ id, user_id }) {
    return new Promise((resolve, reject) =>
      db.get(`SELECT t.*, c.name AS category FROM tasks t
              LEFT JOIN categories c ON c.id=t.category_id
              WHERE t.id=? AND t.user_id=?`, [id, user_id], (e, r) => e ? reject(e) : resolve(r))
    );
  },
  create({ user_id, category_id, title }) {
    return new Promise((resolve, reject) =>
      db.run(`INSERT INTO tasks (user_id, category_id, title) VALUES (?, ?, ?)`,
        [user_id, category_id || null, title],
        function (e) { if (e) return reject(e); resolve(this.lastID); })
    );
  },
  update({ id, user_id, title, category_id }) {
    return new Promise((resolve, reject) =>
      db.run(`UPDATE tasks SET title=?, category_id=? WHERE id=? AND user_id=?`,
        [title, category_id || null, id, user_id],
        function (e) { if (e) return reject(e); resolve(this.changes); })
    );
  },
  toggleDone({ id, user_id }) {
    return new Promise((resolve, reject) =>
      db.run(`UPDATE tasks SET is_done = CASE is_done WHEN 1 THEN 0 ELSE 1 END WHERE id = ? AND user_id=?`,
        [id, user_id], function (e) { if (e) return reject(e); resolve(this.changes); })
    );
  },
  remove({ id, user_id }) {
    return new Promise((resolve, reject) =>
      db.run(`DELETE FROM tasks WHERE id = ? AND user_id = ?`, [id, user_id],
        function (e) { if (e) return reject(e); resolve(this.changes); })
    );
  }
};