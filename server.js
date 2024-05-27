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
var redisStore = require('connect-redis')(session);
const webpush    = require('web-push');

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
    store: new redisStore({ host: process.env.REDIS_HOST, port: process.env.REDIS_PORT, pass: process.env.REDIS_PWD,ttl :  864000 * 1000}),
    resave: false,
    saveUninitialized: false,  
    cookie: {maxAge: 864000 * 1000}
}));
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash());
app.use(express.static('public'));

// routes ======================================================================
console.log("here1");
require('./app/routes.js')(app, passport, models); // load our routes and pass in our app and fully configured passport


var async = require('async');

testFunc(); 

function testFunc() {
  var Entry = models.Entry;
  async.parallel([
    function(callback) {
      Entry.count().then(function(c) {
        console.log('Total entries in table: ' + c);
        callback(null, {'all':c});
      })
    },
    function(callback) {
      Entry.count({
        where: {created_by:1, status: 1}
      }).then(function(c1) {
        console.log('Total entries in table by user_id 1 is: ' + c1);
        callback(null, {'all1':c1});
      })
    }
  ], function(err, results) {
    console.log(results);
  });
}

//sendEntryNoti();

var schedule = require('node-schedule');
var j = schedule.scheduleJob('0 16 * * *', function(){
    sendEntryNoti();
});

function sendEntryNoti() {
    var Subscriber = models.subscriber;
    var Cron = models.cron;
    var limit = 10;
    var batch = 1;
    var offset = 0;
    offset = limit * (batch - 1);

    var data = {
        title: 'sendEntryNoti'
      };
    Cron.create(data).then(function(newItem) {
        Subscriber.count().then(c => {        
            processSubscribers(Subscriber, limit, batch, offset, c, function(status) {
                console.log(status);

                newItem.updateAttributes({
                    status: 1
                })
            });
        })
    });

}

function processSubscribers(Subscriber, limit, batch, offset, totc, callback) {
    console.log("Starting batch no.. "+batch);

    Subscriber.findAll({
        order: [['id', 'ASC']],
        limit: limit,
        offset: offset,
        raw: true
    }).then(function (subs) {
        checkAndSendNoti(subs, 0);

        batch++;
        offset = limit * (batch - 1);
        if( offset <= totc ) {
            setTimeout(processSubscribers, 5000, Subscriber, limit, batch, offset, totc, callback);
        } else {
            callback('done');
        }
    })

}

function checkAndSendNoti(subs, cnt) {
    var Subscriber = models.subscriber;
    var Entry = models.entry;
    var sub  = subs[cnt];
    console.log(sub);

    Entry.sequelize.query("SELECT id FROM entries where created_by= " + sub.user_id + " AND status=1 AND DATE(createdAt) = CURDATE()",
        { type: Entry.sequelize.QueryTypes.SELECT})
      .then(function (entries) {
          console.log(entries);
        if(entries.length == 0) {
            console.log("No entries made today.. Sending notification!");
            var options = {};
            options.publicKey = process.env.PUBLICKEY;
            options.privateKey = process.env.PRIVATEKEY;
            options.subscription = JSON.parse(sub.subscription);
            options.data = '{"title":"EmEnEf", "body": "Time to add the tasks completed today!"}';

            send_notification(options, function(err, data) {
                console.log(err);
                console.log(data);
                
                if(cnt + 1 < subs.length) {
                    checkAndSendNoti(subs, cnt +1);
                }
            })

        }
      })

}


app.post('/api/send-push-msg', (req, res) => {
    var options = {};
    options.publicKey = req.body.applicationKeys.public;
    options.privateKey = req.body.applicationKeys.private;
    options.subscription = req.body.subscription;
    options.data = req.body.data;

    send_notification(options, function(err, data) {
        if(err) {
            if (err.statusCode) {
                res.status(err.statusCode).send(err.body);
            } else {
                res.status(400).send(err.message);
            }
        } else {
            res.status(data).send({success: true});
        }
    })
});

function send_notification(opt, callback) {

    console.log('opt:');
    console.log(opt);
    const options = {
        vapidDetails: {
          subject: 'https://emenef.glitch.me/',
          publicKey: opt.publicKey,
          privateKey: opt.privateKey
        },
        // 1 hour in seconds.
        TTL: 60 * 60
      };
    
      webpush.sendNotification(
        opt.subscription,
        opt.data,
        options
      )
      .then(() => {
          callback(null, 200);
      })
      .catch((err) => {
        callback(err, null);
      });  
}

// launch ======================================================================
app.listen(port);
console.log('The magic happens on port ' + port);
