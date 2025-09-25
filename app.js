const bcrypt = require('bcryptjs');
const path = require('path');
const { Pool } = require('pg');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { nextTick } = require('process');
const { readdirSync } = require('fs');
const LocalStrategy = require('passport-local').Strategy;
require('dotenv').config();

const pool = new Pool({
    host: process.env.HOST,
    user: process.env.USER,
    database: process.env.DATABASE,
    password: process.env.PASSWORD,
    port: 5432 // The default port
});

const app = express();
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(session({ secret: 'cats', resave: false, saveUninitialized: false }));
app.use(passport.session());
app.use(express.urlencoded({ extended: false }));

passport.use(new LocalStrategy(async (username, password, done) => {
    try {
        const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = rows[0];
        
        if (!user) {
            return done(null, false, { message: 'Incorrect username' });
        }
        
        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return done(null, false, { message: 'Incorrect password' });
        }

        return done(null, user);
    } catch (err) {
        return done(err);
    }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        const user = rows[0];

        done(null, user);
    } catch (err) {
        done(err);
    }
});

app.get('/', (req, res) => res.render('index', { user: req.user }));

app.get('/sign-up', (req, res) => res.render('sign-up-form'));
app.post('/sign-up', async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        await pool.query(
            'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *;',
            [req.body.username, hashedPassword]
        );
        res.redirect('/');
    } catch (error) {
        return next(error);
    }
});

app.post(
    '/log-in',
    passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/'
    })
);

app.get('/log-out', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);

        res.redirect('/');
    });
});

const port = process.env.PORT || 3000;
app.listen(port, (error) => {
    if (error) throw error;

    console.log('app listening on port ', port);
})