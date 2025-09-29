const Category = require('../models/categoryModel');
const Task = require('../models/taskModel');

exports.index = async (req, res) => {
  const user = req.session.user;
  const categories = await Category.all();

  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const perPage = 3;
  let tasks = [], pages = 0;

  if (user) {
    const total = await Task.countByUser(user.id);
    pages = Math.max(1, Math.ceil(total / perPage));
    const offset = (page - 1) * perPage;
    tasks = await Task.byUserPaged(user.id, { limit: perPage, offset });
  }

  res.render('index', {
    title: 'One-Page Tasks',
    categories,
    tasks,
    page, pages
  });
};