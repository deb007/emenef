module.exports = function(app, passport, models) {

  app.get('/test', function(req, res) {
    setTimeout(function() {
      res.status(200).send({success:true});
    }, 60000);
  })
  
  app.post('/subscribe', isLoggedIn, function(req, res) {
    var Subscriber = models.Subscriber;
    if (req.user && req.user.id) {
      Subscriber.findOne({
        attributes: ['id'],
        where:{user_id: req.user.id}
      }).then(function (item) {
        if(item){
          console.log('Existing subscriber' + req.user.id);
          item.update({ subscription: req.body ? JSON.stringify(req.body) : '' })
          .then(() => {
            res.status(200).send({ success: true });
          })
          .catch(err => {
            console.error("Error updating subscriber:", err);
            res.status(500).send({ success: false, message: "Internal Server Error" });
          });
        } else {
          console.log('New subscriber' + req.user.id);
          var data = {
            user_id: req.user.id,
            subscription: req.body? JSON.stringify(req.body) : ''
          };
          Subscriber.create(data)
          .then(newItem => {
            console.log(newItem);
            res.status(200).send({ success: true });
          })
          .catch(err => {
            console.error("Error creating subscriber:", err);
            res.status(500).send({ success: false, message: "Internal Server Error" });
          });  
        }
      });

    } else {
      res.status(200).send({success: true});
    }
  });

    app.get('/', isLoggedIn, function(req, res) {
      var Entry = models.Entry;
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
      const userId = req.user.id;
      const ddStr = dd_str;
      const memoryEntriesQuery = `
        SELECT verb, task, strftime('%Y-%m-%dT%H:%M:%SZ', entry_date) AS ed, strftime('%a %d %b, %Y', entry_date) AS ed2 
        FROM entries 
        WHERE created_by = ? AND status = 1 AND memories = 1 AND entry_date < date('now') 
        AND strftime('%d', entry_date) IN (?)
      `;

      const forecastEntriesQuery = `
        SELECT verb, task, strftime('%Y-%m-%dT%H:%M:%SZ', next_date) AS ed, entry_date AS ed2 
        FROM entries 
        WHERE created_by = ? AND status = 1 AND forecast = 1 AND next_date < datetime('now', '+7 days') 
        ORDER BY next_date
      `;


      Entry.sequelize.query(memoryEntriesQuery, {
        replacements: [userId, ddStr],
        type: Entry.sequelize.QueryTypes.SELECT
      })
      .then(m_entries => {
        // Fetch forecast entries
        return Entry.sequelize.query(forecastEntriesQuery, {
          replacements: [userId],
          type: Entry.sequelize.QueryTypes.SELECT
        })
        .then(f_entries => {
          // Render the view with fetched entries
          res.render('../views/index', {
            APP_TITLE: process.env.APP_TITLE,
            user: req.user,
            m_entries: m_entries,
            f_entries: f_entries,
            dd: new Date().getDate()
          });
        })
      })
      .catch(err => {
        console.error("Error executing queries:", err);
        res.status(500).send("Internal Server Error");
      });

    });

    app.get('/get_orphans', isLoggedIn, function(req, res) {
      
      var Entry = models.Entry;
      res.send([]);
      
      /*
      const orphansQuery = `
        SELECT * 
        FROM orphans 
        WHERE created_by = ? AND entry_date < datetime('now', '-30 days') 
        ORDER BY RANDOM() 
        LIMIT 1
      `;

      // Fetch orphans
      Entry.sequelize.query(orphansQuery, {
        replacements: [req.user.id],
        type: Entry.sequelize.QueryTypes.SELECT
      })
      .then(function(entries) {
        res.send(entries);
      })
      .catch(function(error) {
        console.error("Error executing query:", error);
        res.status(500).send("Internal Server Error");
      });
      */
      

    });

    const { Op } = require('sequelize');

    app.get('/browse', isLoggedIn, function(req, res) {
        var Entry = models.Entry;
        var cnt = 0;
        var limit = 10;
        var offset = 0;
        var page = req.query.page ? req.query.page : 1;
        offset = limit * (page - 1);

        var whereClause = { created_by: req.user.id, status: 1 };
        if (req.query.verb) {
            whereClause.verb = req.query.verb;
        }
        if (req.query.task) {
            whereClause.task = { [Op.like]: '%' + req.query.task + '%' };
        }

        Entry.findAndCountAll({
            where: whereClause,
            attributes: ['verb', 'task',
                [Entry.sequelize.fn('strftime', '%Y-%m-%dT%H:%M:%SZ', Entry.sequelize.col('entry_date')), 'ed'],
                ['entry_date', 'ed2']
            ],
            order: [['entry_date', 'DESC']],
            limit: limit,
            offset: offset,
            raw: true
        }).then(function(entries) {
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

        }).catch(function(err) {
            console.error("Error browsing entries:", err);
            res.status(500).send("Internal Server Error");
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
          var Entry = models.Entry;
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
              if (newItem.forecast == 1) {
                Entry.update(
                  { next_date: null },
                  { where: { created_by: req.user.id, status: 1, forecast: 1, verb: req.body.verb, task: req.body.task } }
                ).then(function(r) {
                  Entry.findAll({
                    where: {
                      created_by: req.user.id,
                      status: 1,
                      forecast: 1,
                      days_ago: { [models.Sequelize.Op.gt]: 0 },
                      verb: req.body.verb,
                      task: req.body.task
                    },
                    attributes: [[Entry.sequelize.fn('AVG', Entry.sequelize.col('days_ago')), 'days_ago'], 'verb', 'task'],
                    raw: true
                  }).then(function(e) {
                    if (e[0].days_ago > 0) {
                      Entry.sequelize.query(
                        "UPDATE entries SET next_date = datetime(entry_date, '+" + Math.round(e[0].days_ago) + " days') WHERE id = " + newItem.id
                      ).then(([results, metadata]) => {
                        console.log("Update done");
                      }).catch(err => {
                        console.error("Error updating next_date:", err);
                      });
                    }
                    req.flash('addStatus', 'Successfully added.');
                    res.redirect('/add');
                    return;
                  }).catch(err => {
                    console.error("Error finding entries:", err);
                    req.flash('addStatus', 'Could not be added. Please try again later');
                    res.redirect('/add');
                    return;
                  });
                }).catch(function(err) {
                  console.error("Error updating entry:", err);
                  req.flash('addStatus', 'Could not be added. Please try again later');
                  res.redirect('/add');
                  return;
                });
              } else {
                req.flash('addStatus', 'Successfully added.');
                res.redirect('/add');
                return;
              }
            }
          }).catch(function(err) {
            console.error("Error creating entry:", err);
            req.flash('addStatus', 'Could not be added. Please try again later');
            res.redirect('/add');
            return;
          });

        }
      });
    });

  
  app.get('/delete', isLoggedIn, function(req, res) {
      var Entry = models.Entry;
      var verb = req.query.v;
      var task = req.query.t;
      var latestOnly = req.query.latestOnly === 'true'; // Convert string to boolean

      // Check if verb and task are provided
      if (!verb || !task) {
          res.status(400).send('Verb and task are required.');
          return;
      }

      // Delete only the latest entry if latestOnly is true
      if (latestOnly) {
          Entry.findOne({
              where: {
                  created_by: req.user.id,
                  verb: verb,
                  task: task
              },
              order: [['entry_date', 'DESC']]
          }).then(function(latestEntry) {
              if (!latestEntry) {
                  req.flash('deleteStatus', 'No matching entries found.');
                  res.status(404).send('No matching entries found.');
                  return;
              }

              // Find the previous entry before deleting the latest one
              Entry.findOne({
                  where: {
                      created_by: req.user.id,
                      verb: verb,
                      task: task,
                      entry_date: {
                          [models.Sequelize.Op.lt]: latestEntry.entry_date // Find entries before the latest one
                      }
                  },
                  order: [['entry_date', 'DESC']]
              }).then(function(previousEntry) {
                  // Delete the latest entry
                  Entry.destroy({
                      where: {
                          id: latestEntry.id
                      }
                  }).then(function() {
                      req.flash('deleteStatus', 'Latest entry successfully deleted.');

                      // Update the previous entry's next_date if it exists
                      if (previousEntry) {
                          Entry.findAll({
                              where: {
                                  created_by: req.user.id,
                                  status: 1,
                                  forecast: 1,
                                  days_ago: {
                                      [models.Sequelize.Op.gt]: 0
                                  },
                                  verb: verb,
                                  task: task
                              },
                              attributes: [[Entry.sequelize.fn('AVG', Entry.sequelize.col('days_ago')), 'days_ago'], 'verb', 'task'],
                              raw: true
                          }).then(function(e) {
                              if (e[0].days_ago > 0) {
                                  Entry.update({
                                      next_date: Entry.sequelize.literal(`datetime(entry_date, '+${Math.round(e[0].days_ago)} days')`)
                                  }, {
                                      where: {
                                          id: previousEntry.id
                                      }
                                  }).then(function() {
                                      console.log("Previous entry's next_date updated.");
                                      res.status(200).send('Previous entry\'s next_date updated.');
                                  }).catch(function(err) {
                                      console.error("Error updating previous entry's next_date:", err);
                                      req.flash('deleteStatus', 'Could not update previous entry\'s next_date. Please try again later.');
                                      res.status(500).send('Could not update previous entry\'s next_date. Please try again later.');
                                  });
                              } else {
                                  req.flash('deleteStatus', 'No entries found for updating previous entry\'s next_date.');
                                  res.status(200).send('No entries found for updating previous entry\'s next_date.');
                              }
                          }).catch(function(err) {
                              console.error("Error finding average days_ago:", err);
                              req.flash('deleteStatus', 'Could not find average days_ago. Please try again later.');
                              res.status(500).send('Could not find average days_ago. Please try again later.');
                          });
                      } else {
                          res.status(200).send('Latest entry successfully deleted.');
                      }
                  }).catch(function(err) {
                      console.error("Error deleting latest entry:", err);
                      req.flash('deleteStatus', 'Could not delete latest entry. Please try again later.');
                      res.status(500).send('Could not delete latest entry. Please try again later.');
                  });
              }).catch(function(err) {
                  console.error("Error finding previous entry:", err);
                  req.flash('deleteStatus', 'Could not find previous entry. Please try again later.');
                  res.status(500).send('Could not find previous entry. Please try again later.');
              });
          }).catch(function(err) {
              console.error("Error finding latest entry:", err);
              req.flash('deleteStatus', 'Could not find latest entry. Please try again later.');
              res.status(500).send('Could not find latest entry. Please try again later.');
          });
      } else {
          // Delete all entries for the verb and task combination
          Entry.destroy({
              where: {
                  created_by: req.user.id,
                  verb: verb,
                  task: task
              }
          }).then(function(deletedCount) {
              if (deletedCount > 0) {
                  req.flash('deleteStatus', deletedCount + ' entries successfully deleted.');
                  res.status(200).send(deletedCount + ' entries successfully deleted.');
              } else {
                  req.flash('deleteStatus', 'No matching entries found.');
                  res.status(404).send('No matching entries found.');
              }
          }).catch(function(err) {
              console.error("Error deleting entries:", err);
              req.flash('deleteStatus', 'Could not delete. Please try again later.');
              res.status(500).send('Could not delete. Please try again later.');
          });
      }
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


      app.get('/api/get_verbs', isLoggedIn, function(req, res) {
        var Entry = models.Entry;
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

      app.get('/api/get_tasks', isLoggedIn, function(req, res) {
        var Entry = models.Entry;
        var verb = req.query.v;
        var task = req.query.t;

        if(task && task != ''){
          Entry.findAll({
            where: {created_by: req.user.id, status: 1, forecast: 1, verb: verb, task: task},
            attributes: [[Entry.sequelize.fn('MAX', Entry.sequelize.col('entry_date')), 'entry_date'] ,'task', 'next_date'],
            group: ['task'],
            order: [['task', 'ASC']],
            limit: 10,
            raw: true
          }).then(function (entries) {
            console.log("_____________");
            console.log(entries);
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

      app.get('/api/get_avg', isLoggedIn, function(req, res) {
        var Entry = models.Entry;
        var verb = req.query.v;
        var task = req.query.t;

        if(verb != '' && task != '') {
          Entry.findAll({
            where: {created_by: req.user.id, status: 1, forecast: 1, verb: verb, task: task, days_ago: { [models.Sequelize.Op.gt]: 0 }},
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
  
  app.get('/api/orphans', isLoggedIn, function(req, res) {
      var Entry = models.Entry;

    // Calculate the date one month ago
    var oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    Entry.findAll({
        group: ['verb', 'task'], // Group by verb and task to count records for each combination
        having: models.Sequelize.literal(`COUNT(id) = 1 AND MAX(entry_date) < '${oneMonthAgo.toISOString()}'`), // Use Sequelize.literal to construct the having clause
        attributes: [
            'verb',
            'task',
            [models.Sequelize.fn('COUNT', 'id'), 'entry_count'], // Count of entries for each combination
            [models.Sequelize.fn('MAX', 'entry_date'), 'last_entry_date'] // Last entry date for each combination
        ]
    }).then(function(entries) {
        res.json(entries);
    }).catch(function(err) {
        console.error("Error retrieving old entries:", err);
        res.status(500).send('Could not retrieve old entries. Please try again later.');
    });
  });

};

function isLoggedIn(req, res, next) {
    // Hard-code the user to be logged in with user ID 1
    req.user = { id: 1 };
    console.log(req.user.id);

    // Optionally, set req.isAuthenticated to always return true
    req.isAuthenticated = () => true;

    // Proceed to the next middleware or route handler
    return next();
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
        // next(err);
        console.log('Mail could not be sent: ' + err);
        return "err";
      }
      console.log('Mail sent Successfully');
      return "done";
    });
}
