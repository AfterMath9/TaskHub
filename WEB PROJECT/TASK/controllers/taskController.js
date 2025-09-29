const Task = require('../models/taskModel');

exports.create = async (req, res) => {
  const { title, category_id } = req.body;
  await Task.create({ user_id: req.session.user.id, category_id, title });
  res.flash('success', 'Task added.');
  res.redirect('/#list');
};

exports.toggle = async (req, res) => {
  await Task.toggleDone({ id: req.params.id, user_id: req.session.user.id });
  res.redirect('/#list');
};

exports.remove = async (req, res) => {
  await Task.remove({ id: req.params.id, user_id: req.session.user.id });
  res.flash('info', 'Task deleted.');
  res.redirect('/#list');
};

exports.detail = async (req, res) => {
  const task = await Task.findOne({ id: req.params.id, user_id: req.session.user.id });
  if (!task) return res.status(404).send('Not found');
  res.render('taskDetail', { title: 'Task detail', task });
};

exports.update = async (req, res) => {
  const { title, category_id } = req.body;
  await Task.update({ id: req.params.id, user_id: req.session.user.id, title, category_id });
  res.flash('success', 'Task updated');
  res.redirect('/#list');
};