const authRoutes = require('./routes/authRoutes');
const entryRoutes = require('./routes/entryRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const apiRoutes = require('./routes/apiRoutes');

function isLoggedIn(req, res, next) {
  if (req.session.user) {
    req.user = req.session.user;
    return next();
  } else {
    res.redirect('/login');
  }
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


module.exports = function (app, passport, models) {
  app.use(authRoutes(passport, isLoggedIn));
  app.use(entryRoutes(models, isLoggedIn)); // Pass isLoggedIn as a parameter
  app.use(subscriptionRoutes(models, isLoggedIn));
  app.use(apiRoutes(models, isLoggedIn));

  app.get('/test', function (req, res) {
    setTimeout(function () {
      res.status(200).send({ success: true });
    }, 60000);
  })

  app.get('/', isLoggedIn, function (req, res) {
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
};
