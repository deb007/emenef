// server.js
// where your node app starts


// set up ======================================================================
// get all the tools we need
require('dotenv').config();
var express   = require('express');
var app       = express();
var port      = process.env.PORT || 8080;
var passport  = require('passport');
var flash     = require('express-flash');
var validator = require('express-validator');

var morgan       = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser   = require('body-parser');
var session      = require('express-session');

//Models
var models = require("./app/models");
//Sync Database
models.sequelize.sync().then(function() {
    console.log('Nice! Database looks fine');
}).catch(function(err) {
    console.log(err, "Something went wrong with the Database Update!");
});

require('./config/passport')(passport, models.user); // pass passport for configuration

// set up our express application
app.use(morgan('dev')); // log every request to the console
app.use(validator([]));
app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'ejs'); // set up ejs for templating

// required for passport
app.use(session({
    secret: 'thisismysecret1thisismysecret2thisismysecret',
    resave: true,
    saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash());
app.use(express.static('public'));

// routes ======================================================================
require('./app/routes.js')(app, passport, models); // load our routes and pass in our app and fully configured passport

// launch ======================================================================
app.listen(port);
console.log('The magic happens on port ' + port);
