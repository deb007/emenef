const express = require('express');
const router = express.Router();

module.exports = function (passport, isLoggedIn) {
    router.get('/login', function (req, res) {
        res.render('../views/login', { message: req.flash('loginMessage'), APP_TITLE: process.env.APP_TITLE, object: process.env.OBJECT, objects: process.env.OBJECTS });
    });

    router.get('/logout', function (req, res) {
        req.session.destroy();
        req.logout();
        res.redirect('/');
    });

    router.get('/auth/facebook', passport.authenticate('facebook', { scope: 'email' }));
    router.get('/auth/facebook/callback', passport.authenticate('facebook', { successRedirect: '/', failureRedirect: '/login' }));
    router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
    router.get('/auth/google/callback', passport.authenticate('google', { successRedirect: '/', failureRedirect: '/login' }));

    return router;
};
