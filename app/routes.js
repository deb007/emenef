module.exports = function(app, passport, models) {

  app.get('/test', function(req, res) {
    setTimeout(function() {
      res.status(200).send({success:true});
    }, 60000);
  })
  
  app.post('/subscribe', isLoggedIn, function(req, res) {
    var Subscriber = models.subscriber;
    if (req.user && req.user.id) {
      Subscriber.findOne({
        attributes: ['id'],
        where:{user_id: req.user.id}
      }).then(function (item) {
        if(item){
          console.log('Existing subscriber' + req.user.id);
          item.updateAttributes({subscription: req.body ? JSON.stringify(req.body) : ''});
          res.status(200).send({success: true});
        } else {
          console.log('New subscriber' + req.user.id);
          var data = {
            user_id: req.user.id,
            subscription: req.body? JSON.stringify(req.body) : ''
          };
          Subscriber.create(data).then(function(newItem) {
            console.log(newItem);
            res.status(200).send({success: true});
          })    
        }
      });

    } else {
      res.status(200).send({success: true});
    }
  });

    app.get('/', isLoggedIn, function(req, res) {
      var Entry = models.entry;
      var currentDate = new Date();
      var dd_str = currentDate.getDate();
      for (var i = 0; i < 3; i++) {
        currentDate.setDate(currentDate.getDate() + 1);
        dd_str += ',' + currentDate.getDate();
      }
      var currentDate = new Date();
      for (var i = 0; i < 3; i++) {
        currentDate.setDate(currentDate.getDate() - 1);
        dd_str += ',' + currentDate.getDate();
      }

      Entry.sequelize.query("SELECT verb, task, DATE_FORMAT(entry_date, '%Y-%m-%dT%TZ') AS ed, DATE_FORMAT(entry_date, '%a %D %b, %Y') AS ed2 FROM entries where created_by= " + req.user.id + " AND status=1 AND memories=1 AND entry_date < CURDATE() AND DATE_FORMAT(entry_date, '%d') IN (" + dd_str + ")",
        { type: Entry.sequelize.QueryTypes.SELECT})
      .then(function (m_entries) {

        Entry.sequelize.query("SELECT verb, task, DATE_FORMAT(next_date, '%Y-%m-%dT%TZ') AS ed, DATE_FORMAT(entry_date, '%a %D %b, %Y') AS ed2 FROM entries where created_by= " + req.user.id + " AND status=1 AND forecast=1 AND next_date < NOW() + INTERVAL 7 DAY ORDER BY next_date",
          { type: Entry.sequelize.QueryTypes.SELECT})
        .then(function (f_entries) {

          res.render('../views/index', {
            APP_TITLE: process.env.APP_TITLE,
            user: req.user,
            m_entries: m_entries,
            f_entries: f_entries,
            dd: new Date().getDate()
          });
        })
      })

    });

    app.get('/get_orphans', isLoggedIn, function(req, res) {
      
      var Entry = models.entry;
      
      Entry.sequelize.query("SELECT * FROM orphans where created_by= " + req.user.id + " AND entry_date < NOW() - INTERVAL 30 DAY order by RAND() LIMIT 1",
        { type: Entry.sequelize.QueryTypes.SELECT})
      .then(function (entries) {
        res.send(entries);
        
      })
      

    });

    app.get('/browse', isLoggedIn, function(req, res) {
      var Entry = models.entry;
      var cnt = 0;
      var limit = 10;
      var offset = 0;
      var page = req.query.page ? req.query.page : 1;
      offset = limit * (page - 1);
      
      var whereClause = {created_by: req.user.id, status: 1};
      if(req.query.verb) {
        whereClause.verb = req.query.verb;
      }
      if(req.query.task) {
        whereClause.task = {$like : '%' + req.query.task + '%'};
      }

      Entry.findAndCountAll({
        where:whereClause,
        attributes: ['verb', 'task',
          [Entry.sequelize.fn('date_format', Entry.sequelize.col('entry_date'), '%Y-%m-%dT%TZ'), 'ed'],
          [Entry.sequelize.fn('date_format', Entry.sequelize.col('entry_date'), '%a %D %b, %Y'), 'ed2']],
        order: [['entry_date', 'DESC']],
        limit: limit,
        offset: offset,
        raw: true
      }).then(function (entries) {
        var pages = Math.ceil(entries.count / limit);
        cnt = entries.count;
        entries = entries.rows;

        res.render('../views/browse', {
          APP_TITLE: process.env.APP_TITLE,
          user: req.user,
          entries: entries,
          cnt: cnt,
          pages: pages,
          current_page: page
        });

      });
    });

    app.get('/add', isLoggedIn, function(req, res) {
      res.render('../views/add-new', {
        APP_TITLE: process.env.APP_TITLE,
        user: req.user,
        message: req.flash('addErrors'),
        messagestatus: req.flash('addStatus'),
        verb: req.query.verb,
        task: req.query.task
      });
    });

    app.post('/save', isLoggedIn, function(req, res) {
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
            created_by: req.user.id
          };
          Entry.create(data).then(function(newItem) {
              if (newItem) {
                console.log(newItem.id);
                if(newItem.forecast == 1) {
                  Entry.update(
                    {next_date: null},
                    {where: {created_by: req.user.id, status: 1, forecast: 1, verb: req.body.verb, task: req.body.task} }
                  ).then(function(r) {
                    Entry.findAll({
                      where: {created_by: req.user.id, status: 1, forecast: 1, days_ago:{$gt:0}, verb: req.body.verb, task: req.body.task},
                      attributes: [[Entry.sequelize.fn('AVG', Entry.sequelize.col('days_ago')), 'days_ago'], 'verb' ,'task'],
                      raw: true
                    }).then(function(e) {
                      if(e[0].days_ago > 0) {
                        Entry.sequelize.query("UPDATE entries SET next_date = DATE_ADD(entry_date, INTERVAL '"+Math.round(e[0].days_ago)+"' DAY) WHERE id = "+newItem.id)
                        .spread((results, metadata) => {
                          console.log("Update done");
                        })
                      }
                      req.flash('addStatus', 'Successfully added.');
                      res.redirect('/add');
                      return;
                    })
                  }).catch(function(err) {
                    req.flash('addStatus', 'Could not be added. Please try again later');
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
        req.session.destroy();
        req.logout();
        res.redirect('/');
    });

    app.get('/auth/facebook', passport.authenticate('facebook', { scope : 'email' }));


    app.get('/auth/facebook/callback',
      passport.authenticate('facebook', {
          successRedirect : '/',
          failureRedirect : '/login'
      }));

    app.get('/auth/google', passport.authenticate('google', { scope : ['profile', 'email'] }));

    app.get('/auth/google/callback',
      passport.authenticate('google', {
              successRedirect : '/',
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
        var task = req.query.t;

        if(task && task != ''){
          Entry.findAll({
            where: {created_by: req.user.id, status: 1, forecast: 1, verb: verb, task: task},
            attributes: [[Entry.sequelize.fn('MAX', Entry.sequelize.col('entry_date')), 'entry_date'] ,'task'],
            group: ['task'],
            order: [['task', 'ASC']],
            limit: 10,
            raw: true
          }).then(function (entries) {
            res.send(entries);
          })

        } else {
          Entry.findAll({
            where: {created_by: req.user.id, status: 1, forecast: 1, verb: verb},
            attributes: [[Entry.sequelize.fn('MAX', Entry.sequelize.col('entry_date')), 'entry_date'] ,'task'],
            group: ['task'],
            order: [['task', 'ASC']],
            limit: 10,
            raw: true
          }).then(function (entries) {
            res.send(entries);
          })
        }

      });

      app.get('/api/get_avg', function(req, res) {
        var Entry = models.entry;
        var verb = req.query.v;
        var task = req.query.t;

        if(verb != '' && task != '') {
          Entry.findAll({
            where: {created_by: req.user.id, status: 1, forecast: 1, verb: verb, task: task, days_ago:{$gt:0}},
            attributes: [[Entry.sequelize.fn('AVG', Entry.sequelize.col('days_ago')), 'avg_days_ago'] ,'task'],
            group: ['task'],
            order: [['task', 'ASC']],
            limit: 10,
            raw: true
          }).then(function (entries) {
            res.send(entries);
          })
        }
        else {
          res.send('');
        }

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
