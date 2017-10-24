module.exports = function(app, passport, models) {

    app.get('/', function(req, res) {
      var Entry = models.entry;
      var today = new Date();
      var dd = today.getDate();

      Entry.sequelize.query("SELECT verb, task, DATE_FORMAT(entry_date, '%Y-%m-%dT%TZ') AS ed FROM entries where status=1 AND memories=1 AND entry_date < CURDATE() AND DATE_FORMAT(entry_date, '%d') = " + dd,
        { type: Entry.sequelize.QueryTypes.SELECT})
      .then(function (m_entries) {

        Entry.sequelize.query("SELECT verb, task, DATE_FORMAT(entry_date, '%Y-%m-%dT%TZ') AS ed FROM entries where status=1 AND forecast=1 AND next_date = CURDATE()",
          { type: Entry.sequelize.QueryTypes.SELECT})
        .then(function (f_entries) {

          res.render('../views/index', {
            APP_TITLE: process.env.APP_TITLE,
            user: req.user,
            m_entries: m_entries,
            f_entries: f_entries
          });
        })
      })

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
            days_ago: req.body.days_ago,
            status: req.body.status,
            created_by: 1                     //user.id
          };
          Entry.create(data).then(function(newItem) {
              if (newItem) {
                console.log(newItem.id);
                if(newItem.forecast == 1) {
                  Entry.findAll({
                    where: {status: 1, forecast: 1, days_ago:{$gt:0}, verb: req.body.verb, task: req.body.task},
                    attributes: [[Entry.sequelize.fn('AVG', Entry.sequelize.col('days_ago')), 'days_ago'], 'verb' ,'task'],
                    raw: true
                  }).then(function(e) {
                    if(e[0].days_ago > 0) {
                      Entry.sequelize.query("UPDATE entries SET next_date = DATE_ADD(entry_date, INTERVAL '"+Math.round(e[0].days_ago)+"' DAY) WHERE id = "+newItem.id)
                      .spread((results, metadata) => {
                        console.log("Update done");
                        console.log(results);
                      })
                    }
                    req.flash('addStatus', 'Successfully added.');
                    res.redirect('/add');
                    return;
                  })
                } else {
                    req.flash('addStatus', 'Successfully added.');
                    res.redirect('/add');
                    return;


                }
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
          where: {status: 1, forecast: 1, verb: verb},
          attributes: [[Entry.sequelize.fn('MAX', Entry.sequelize.col('entry_date')), 'entry_date'] ,'task'],
          group: ['task'],
          order: [['task', 'ASC']],
          limit: 10,
          raw: true
        }).then(function (entries) {
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
