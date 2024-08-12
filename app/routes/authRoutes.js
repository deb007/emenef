const { createClient } = require('@supabase/supabase-js');
const express = require('express');
const router = express.Router();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = function (passport, isLoggedIn) {

    router.get('/login', function (req, res) {
        res.render('../views/login', {
            message: req.flash('loginMessage'), APP_TITLE: process.env.APP_TITLE, object:
                process.env.OBJECT, objects: process.env.OBJECTS
        });

    });

    router.post('/login', async (req, res) => {
        const { email, password } = req.body;
        const { user, error } = await supabase.auth.signIn({ email, password });

        if (error) {
            return res.status(401).send(error.message);
        }

        req.session.user = user;
        res.redirect('/');
    });

    router.get('/logout', function (req, res) {
        req.session.destroy();
        req.logout();
        res.redirect('/');
    });

    router.get('/signup', function (req, res) {
        res.render('../views/signup', {
            message: req.flash('signupMessage'), APP_TITLE: process.env.APP_TITLE, object:
                process.env.OBJECT, objects: process.env.OBJECTS
        });
    });

    router.post('/signup', async (req, res) => {
        const { email, password } = req.body;
        const { user, error } = await supabase.auth.signUp({ email, password });

        if (error) {
            return res.status(401).send(error.message);
        }

        req.session.user = user;
        //res.send({ user });
        res.redirect('/');
    });

    return router;
};
