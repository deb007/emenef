// load all the things we need
var LocalStrategy   = require('passport-local').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;

// expose this function to our app using module.exports
module.exports = function(passport, user) {

    var User = user;
    passport.serializeUser(function(user, done) {
        done(null, user.id);
    });

    passport.deserializeUser(function(id, done) {
        User.findById(id).then(user =>{
          if(user) {
            done(null, user);
          } else {
            done(null, null);
          }
        });
    });

    // =========================================================================
    // LOCAL SIGNUP ============================================================
    // =========================================================================
    // we are using named strategies since we have one for login and one for signup
    // by default, if there was no name, it would just be called 'local'

  passport.use(new FacebookStrategy({
        clientID        : process.env.FB_APPID,
        clientSecret    : process.env.FB_SECRET,
        callbackURL     : process.env.FB_CALLBACK,
        profileFields   : ['id' ,'email', 'gender', 'name']
    },


    function(token, refreshToken, profile, done) {
      process.nextTick(function() {
        console.log("=============");
        console.log(profile);

        User.findOne({
          where : {'fb_profile_id' : profile.id }
        }).then(function(user){
          if(user){
            user.updateAttributes({
              last_login: Date.now(),
              login_count: user.login_count+1
            })
            return done(null, user);
          } else {
            var data = {
              fb_profile_id: profile.id,
              fb_token: token,
              fullname: profile.name.givenName + ' ' + profile.name.familyName,
              email: profile.emails[0].value,
              gender: profile.gender,
              last_login: Date.now(),
              login_count:1
            };
            User.create(data).then(function(newUser, created) {
                if (!newUser) {
                    return done(null, false);
                }
                if (newUser) {
                    return done(null, newUser);
                }
            });
          }
        })
      });

    }));

    passport.use(new GoogleStrategy({

        clientID        : process.env.G_CLIENTID,
        clientSecret    : process.env.G_CLIENTSECRET,
        callbackURL     : process.env.G_CALLBACK,

    },
    function(token, refreshToken, profile, done) {

        process.nextTick(function() {
          console.log("=============");
          console.log(profile);

          User.findOne({
            where : {'google_profile_id' : profile.id }
          }).then(function(user){
            if(user){
              user.updateAttributes({
                last_login: Date.now(),
                login_count: user.login_count+1
              }).then(updatedUser => {
                  return done(null, updatedUser);
              }).catch(err => {
                  console.error("Error updating user:", err);
                  return done(err, null);
              });
              return done(null, user);
            } else {
              var data = {
                google_profile_id: profile.id,
                google_token: token,
                fullname: profile.displayName,
                email: profile.emails[0].value,
                gender: profile.gender,
                last_login: Date.now(),
                login_count:1
              };
              User.create(data).then(function(newUser, created) {
                  if (!newUser) {
                      return done(null, false);
                  }
                  if (newUser) {
                      return done(null, newUser);
                  }
              }).catch(err => {
                  console.error("Error creating user:", err);
                  return done(err, null);
              });
            }
          }).catch(err => {
              console.error("Error finding user:", err);
              return done(err, null);
          });
        });
    }));

};
