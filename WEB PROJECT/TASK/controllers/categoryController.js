const Categories = require('../models/categoryModel');

exports.create = async (req, res) => {
  await Categories.create(req.body.name);
  res.flash('success', 'Category added');
  res.redirect('/#list');
};
exports.rename = async (req, res) => {
  await Categories.rename(req.params.id, req.body.name);
  res.flash('success', 'Category renamed');
  res.redirect('/#list');
};
exports.remove = async (req, res) => {
  await Categories.remove(req.params.id);
  res.flash('info', 'Category deleted');
  res.redirect('/#list');
};