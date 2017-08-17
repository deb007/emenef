// load all the things we need
var LocalStrategy   = require('passport-local').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;

// load up the user model
var User            = require('../app/models/user');

// expose this function to our app using module.exports
module.exports = function(passport) {

    passport.serializeUser(function(user, done) {
        done(null, user.id);
    });

    passport.deserializeUser(function(id, done) {
        User.findById(id, function(err, user) {
            done(err, user);
        });
    });

    // =========================================================================
    // LOCAL SIGNUP ============================================================
    // =========================================================================
    // we are using named strategies since we have one for login and one for signup
    // by default, if there was no name, it would just be called 'local'

    passport.use('local-login', new LocalStrategy({
            // by default, local strategy uses username and password, we will override with email
            usernameField : 'email',
            passwordField : 'password',
            passReqToCallback : true // allows us to pass back the entire request to the callback
        },
        function(req, email, password, done) { // callback with email and password from our form

            // find a user whose email is the same as the forms email
            // we are checking to see if the user trying to login already exists
            User.findOne({ 'local.email' :  email }, function(err, user) {
                // if there are any errors, return the error before anything else
                if (err)
                    return done(err);

                // if no user is found, return the message
                if (!user)
                    return done(null, false, req.flash('loginMessage', 'No user found.')); // req.flash is the way to set flashdata using connect-flash

                // if the user is found but the password is wrong
                if (!user.validPassword(password))
                    return done(null, false, req.flash('loginMessage', 'Oops! Wrong password.')); // create the loginMessage and save it to session as flashdata

                // all is well, return successful user
                return done(null, user);
            });

        }));
  
    passport.use('local-signup', new LocalStrategy({
        // by default, local strategy uses username and password, we will override with email
        usernameField : 'email',
        passwordField : 'password',
        passReqToCallback : true // allows us to pass back the entire request to the callback
    },
    function(req, email, password, done) {

        // asynchronous
        // User.findOne wont fire unless data is sent back
        process.nextTick(function() {

        // find a user whose email is the same as the forms email
        // we are checking to see if the user trying to login already exists
        User.findOne({ 'local.email' :  email }, function(err, user) {
            // if there are any errors, return the error
            if (err)
                return done(err);

            // check to see if theres already a user with that email
            if (user) {
                return done(null, false, req.flash('signupMessage', 'That email is already taken.'));
            } else {

                // if there is no user with that email
                // create the user
                var newUser            = new User();

                // set the user's local credentials
                newUser.local.email    = email;
                newUser.local.password = newUser.generateHash(password);

                // save the user
                newUser.save(function(err) {
                    if (err)
                        throw err;
                    return done(null, newUser);
                });
            }

        });    

        });

    }));

  
  passport.use(new FacebookStrategy({
        clientID        : process.env.FB_APPID,
        clientSecret    : process.env.FB_SECRET,
        callbackURL     : process.env.FB_CALLBACK,
        profileFields   : ['id' ,'email', 'gender', 'name']
    },

    
    function(token, refreshToken, profile, done) {

      process.nextTick(function() {
          
            User.findOne({ 'facebook.id' : profile.id }, function(err, user) {
                if (err)
                    return done(err);
                if (user) {
                    return done(null, user); 
                } else {
                  
                  console.log("=============");
                  console.log(profile);
                    var newUser              = new User();
                    newUser.facebook.id      = profile.id; 
                    newUser.facebook.token   = token; 
                    newUser.facebook.name    = profile.name.givenName + ' ' + profile.name.familyName; 
                    newUser.facebook.email   = profile.emails[0].value; 
                    newUser.facebook.gender  = profile.gender; 

                    newUser.save(function(err) {
                        if (err)
                            throw err;

                        
                        return done(null, newUser);
                    });
                }

            });
        });

    }));
  
    passport.use(new GoogleStrategy({

        clientID        : process.env.G_CLIENTID,
        clientSecret    : process.env.G_CLIENTSECRET,
        callbackURL     : process.env.G_CALLBACK,

    },
    function(token, refreshToken, profile, done) {

        process.nextTick(function() {
            User.findOne({ 'google.id' : profile.id }, function(err, user) {
                if (err)
                    return done(err);
                if (user) {
                    return done(null, user);
                } else {
                  console.log("=============");
                  console.log(profile);
                    var newUser            = new User();

                    newUser.google.id      = profile.id;
                    newUser.google.token   = token;
                    newUser.google.name    = profile.displayName;
                    newUser.google.email   = profile.emails[0].value; 
                    newUser.google.gender  = profile.gender.value; 

                    newUser.save(function(err) {
                        if (err)
                            throw err;
                        return done(null, newUser);
                    });
                }
            });
        });

    }));

};