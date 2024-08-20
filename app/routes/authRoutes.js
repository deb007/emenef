const { createClient } = require('@supabase/supabase-js');
const express = require('express');
const router = express.Router();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = function (models, isLoggedIn) {

    router.get('/login', function (req, res) {
        res.render('../views/login', {
            message: req.flash('loginMessage'), APP_TITLE: process.env.APP_TITLE, object:
                process.env.OBJECT, objects: process.env.OBJECTS
        });

    });

    router.post('/login', async (req, res) => {
        const { email, password } = req.body;
        const { user, error } = await supabase.auth.signIn({ email, password });
        const User = models.user;

        if (error) {
            return res.status(401).send(error.message);
        }

        // Update last_login and login_count in the users table
        await User.findOne({ where: { email: user.email } })
            .then(async (existingUser) => {
                if (existingUser) {
                    await existingUser.update({
                        last_login: new Date(),
                        login_count: existingUser.login_count + 1
                    });
                    req.session.user = { ...user, id: existingUser.id };
                } else {
                    console.log("No USERRRRRRRRRRRRRRRRR")
                }
            });

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
        const User = models.user;

        if (error) {
            return res.status(401).send(error.message);
        }

        // Create or update user in the users table
        await User.findOrCreate({
            where: { email: user.email },
            defaults: {
                email: user.email,
                last_login: new Date(),
                login_count: 1
            }
        }).then(([newUser, created]) => {
            if (!created) {
                newUser.update({
                    last_login: new Date(),
                    login_count: newUser.login_count + 1
                });
            }
            req.session.user = { ...user, id: newUser.id };
        });

        res.redirect('/');
    });

    return router;
};
