module.exports = function(app, passport, models) {

    app.get('/', function(req, res) {
      res.render('../views/index', {
        APP_TITLE: process.env.APP_TITLE,
        user: req.user
      });
    });

    app.get('/add', function(req, res) {
      res.render('../views/add-new', {
        APP_TITLE: process.env.APP_TITLE,
        user: req.user,
        message: req.flash('addErrors'),
        messagestatus: req.flash('addStatus')
      });
    });

    app.post('/save', function(req, res) {
      var user = req.user;
      req.checkBody('verb', 'A verb is required').notEmpty();
      req.checkBody('task', 'Task is required').notEmpty();
      req.checkBody('entry_date', 'Entry Date is required').notEmpty();

      // check the validation object for errors
      req.getValidationResult().then(function (result) {
        var e = ''
        if (!result.isEmpty()) {
            req.flash('addErrors', result.array());
            res.redirect('/add');
            return;
        } else {
          var Entry = models.entry;
          var User = models.user;
          var data = {
            verb: req.body.verb,
            task: req.body.task,
            memories: req.body.memories,
            forecast: req.body.forecast,
            entry_date: req.body.entry_date,
            status: req.body.status,
            created_by: 1                     //user.id
          };
          Entry.create(data).then(function(newItem) {
              if (newItem) {
                req.flash('addStatus', 'Successfully added.');
                res.redirect('/add');
                return;
              }
          }).catch(function(err){
              req.flash('addStatus', 'Could not be added. Please try again later');
              res.redirect('/add');
              return;
          });

        }
      });
    });

  // show the login form
    app.get('/login', function(req, res) {

        // render the page and pass in any flash data if it exists
        res.render('../views/login', { message: req.flash('loginMessage'), APP_TITLE: process.env.APP_TITLE, object: process.env.OBJECT, objects: process.env.OBJECTS });
    });

    app.get('/logout', function(req, res) {
        req.logout();
        res.redirect('/');
    });

    app.get('/auth/facebook', passport.authenticate('facebook', { scope : 'email' }));


    app.get('/auth/facebook/callback',
      passport.authenticate('facebook', {
          successRedirect : '/add-new',
          failureRedirect : '/login'
      }));

    app.get('/auth/google', passport.authenticate('google', { scope : ['profile', 'email'] }));

    app.get('/auth/google/callback',
      passport.authenticate('google', {
              successRedirect : '/add-new',
              failureRedirect : '/login'
      }));


      app.get('/api/get_verbs', function(req, res) {
        var Entry = models.entry;
        Entry.findAll({
          where: {status: 1},
          attributes: [Entry.sequelize.fn('DISTINCT', Entry.sequelize.col('verb')) ,'verb'],
          order: [['verb', 'ASC']],
          limit: 10,
          raw: true
        }).then(function (entries) {
          res.send(entries);
        })

      });

      app.get('/api/get_tasks', function(req, res) {
        var Entry = models.entry;
        var verb = req.query.v;
        Entry.findAll({
          where: {status: 1, verb: verb},
          attributes: [[Entry.sequelize.fn('MAX', Entry.sequelize.col('entry_date')), 'entry_date'] ,'task'],
          group: ['task'],
          order: [['task', 'ASC']],
          limit: 10,
          raw: true
        }).then(function (entries) {
          console.log(entries);
          res.send(entries);
        })

      });

};

// route middleware to make sure a user is logged in
function isLoggedIn(req, res, next) {

    // if user is authenticated in the session, carry on
    if (req.isAuthenticated())
        return next();

    // if they aren't redirect them to the home page
    res.redirect('/login');
}

function send_mail(to_email, subject, body) {
  var Sendgrid = require('sendgrid')(process.env.SENDGRID_API_KEY);

    const sgReq = Sendgrid.emptyRequest({
      method: 'POST',
      path: '/v3/mail/send',
      body: {
        personalizations: [{
          to: [{ email: to_email }],
          subject: subject
        }],
        from: { email: process.env.SENDGRID_SENDER },
        content: [{
          type: 'text/plain',
          value: body
        }]
      }
    });

    Sendgrid.API(sgReq, (err) => {
      if (err) {
        next(err);
        console.log('Mail could not be sent: ' + err);
        return "err";
      }
      console.log('Mail sent Successfully');
      return "done";
    });
}
