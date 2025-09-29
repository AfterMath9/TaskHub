const path = require('path');
const express = require('express');
const exphbs = require('express-handlebars');
const session = require('express-session');
const helmet = require('helmet');

const homeRoutes = require('./routes/homeRoutes');
const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');

const app = express();

// Security headers
app.use(helmet());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Body parsers for forms (GET/POST)  //  [oai_citation:14‡WebDevFun-14-forms-v1.0-2025.pdf](file-service://file-PwoGD9DEPUu8Xj46eSFEbn)
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Session (for login state)
app.use(session({
  name: 'sid',
  secret: 'replace_this_in_production',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 }
}));

// Flash messages helper
app.use((req, res, next) => {
  res.locals.flash = req.session.flash || [];
  res.locals.user = req.session.user || null;
  req.session.flash = [];
  res.flash = (type, msg) => { req.session.flash.push({ type, msg }); };
  next();
});

// Handlebars setup (MVC Views)  //  [oai_citation:15‡WebDevFun-13-mvc-handlebars-v1.0-2025.pdf](file-service://file-72N2jUBbUrLLXvaQBsEYGi)
const hbs = exphbs.create({
  extname: '.hbs',
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'views', 'layouts'),
  partialsDir: path.join(__dirname, 'views', 'partials'),
  helpers: {
    eq: (a,b)=>a===b,
    json: (ctx)=>JSON.stringify(ctx),
    range: (from, to) => Array.from({length: to - from + 1}, (_,i)=> from + i)
  }
});
app.engine('.hbs', hbs.engine);
app.set('view engine', '.hbs');

// Routes
app.use('/', homeRoutes);
app.use('/auth', authRoutes);
app.use('/tasks', taskRoutes);

// 404
app.use((req, res) => res.status(404).send('404 Not Found'));

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`WebDevFun app running at http://localhost:${PORT}`);
});

const userRoutes = require('./routes/userRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
// ...
app.use('/users', userRoutes);
app.use('/categories', categoryRoutes);