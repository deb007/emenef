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

  return new Promise((resolve, reject) => {
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
          type: 'text/html',
          value: body
        }]
      }
    });

    Sendgrid.API(sgReq, (err, response) => {
      if (err) {
        console.log('Mail could not be sent: ' + err);
        if (response) {
          console.log('Response status code: ' + response.statusCode);
          console.log('Response body: ' + response.body);
        }
        reject(err);
      } else {
        console.log('Mail sent Successfully');
        resolve("done");
      }
    });
  });
}

module.exports = function (app, models) {
  app.use(authRoutes(models, isLoggedIn));
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
    var ddArray = [currentDate.getDate().toString()]; // Initialize the array with the current day

    // Add the next 3 days to the array
    for (var i = 0; i < 3; i++) {
      currentDate.setDate(currentDate.getDate() + 1);
      ddArray.push(currentDate.getDate().toString());
    }

    // Reset the date to the current date
    currentDate = new Date();

    // Add the previous 3 days to the array
    for (var i = 0; i < 3; i++) {
      currentDate.setDate(currentDate.getDate() - 1);
      ddArray.push(currentDate.getDate().toString());
    }
    const userId = req.user.id;
    const memoryEntriesQuery = `
      SELECT verb, task, 
        TO_CHAR(entry_date, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS ed, 
        TO_CHAR(entry_date, 'Dy DD Mon, YYYY') AS ed2 
      FROM entries 
      WHERE created_by = ? AND status = 1 AND memories = 1 AND entry_date < NOW() 
      AND TO_CHAR(entry_date, 'DD') = ANY(ARRAY[?]::text[])
    `;

    const forecastEntriesQuery = `
      SELECT verb, task, 
        TO_CHAR(next_date, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS ed, 
        entry_date AS ed2,
        ROUND(
          (
              SELECT AVG(days_ago)
              FROM entries e2 
              WHERE 
                  e2.created_by = e1.created_by 
                  AND e2.status = 1 
                  AND e2.forecast = 1 
                  AND e2.verb = e1.verb 
                  AND e2.task = e1.task 
                  AND e2.days_ago > 0
          )
        , 0) AS frequency,
        CASE 
          WHEN next_date < NOW() THEN true
          ELSE false
        END AS "isOverdue",
        CASE 
          WHEN next_date < NOW() THEN DATE_PART('day', NOW() - next_date)
          ELSE 0
        END AS "overdueDays",
        CASE 
          WHEN next_date >= NOW() THEN DATE_PART('day', next_date - NOW())
          ELSE 0
        END AS "dueInDays"
      FROM entries e1
      WHERE created_by = ? AND status = 1 AND forecast = 1 
        AND next_date < NOW() + INTERVAL '7 days' 
      ORDER BY next_date
    `;

    Entry.sequelize.query(memoryEntriesQuery, {
      replacements: [userId, ddArray],
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

  // New endpoint for sending forecast emails
  app.get('/send-forecast-emails', function (req, res) {
    const User = models.user;
    const Entry = models.Entry;
    const todayIs = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const forecastEntriesQuery = `
      SELECT 
        verb, 
        task, 
        TO_CHAR(next_date, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS ed,
        entry_date AS ed2,
        CASE 
          WHEN next_date < CURRENT_DATE THEN 'delayed'
          WHEN next_date = CURRENT_DATE THEN 'today'
          ELSE 'upcoming'
        END AS status
      FROM entries 
      WHERE created_by = ? 
        AND status = 1 
        AND forecast = 1 
        AND next_date < NOW() + INTERVAL '7 days' 
      ORDER BY next_date
    `;

    let emailStats = {
      totalUsers: 0,
      emailsSent: 0,
      errors: [],
      usersWithNoTasks: 0
    };

    User.findAll()
      .then(users => {
        emailStats.totalUsers = users.length;
        const emailPromises = users.map(user => {
          return Entry.sequelize.query(forecastEntriesQuery, {
            replacements: [user.id],
            type: Entry.sequelize.QueryTypes.SELECT
          })
            .then(f_entries => {
              if (f_entries.length > 0) {
                const delayed = f_entries.filter(e => e.status === 'delayed');
                const today = f_entries.filter(e => e.status === 'today');
                const upcoming = f_entries.filter(e => e.status === 'upcoming');

                let emailBody = `<h2>Forecast Report for ${todayIs}</h2>`;
                emailBody += `<p>Hello ${user.fullname},</p>`;

                if (delayed.length > 0) {
                  emailBody += "<h3>⚠️ Delayed Tasks</h3><ul>";
                  emailBody += delayed.map(entry =>
                    `<li><b>${entry.verb} ${entry.task}</b> (due on ${new Date(entry.ed).toLocaleDateString()})</li>`
                  ).join('\n');
                  emailBody += "</ul>";
                }

                if (today.length > 0) {
                  emailBody += "<h3>📅 Due Today</h3><ul>";
                  emailBody += today.map(entry =>
                    `<li><b>${entry.verb} ${entry.task}</b></li>`
                  ).join('\n');
                  emailBody += "</ul>";
                }

                if (upcoming.length > 0) {
                  emailBody += "<h3>🔜 Coming Soon</h3><ul>";
                  emailBody += upcoming.map(entry =>
                    `<li><b>${entry.verb} ${entry.task}</b> (due on ${new Date(entry.ed).toLocaleDateString()})</li>`
                  ).join('\n');
                  emailBody += "</ul>";
                }

                return send_mail(
                  user.email,
                  `Forecast Tasks Report - ${todayIs}`,
                  emailBody
                ).then(() => {
                  emailStats.emailsSent++;
                }).catch(err => {
                  emailStats.errors.push({
                    user: user.email,
                    error: err.message
                  });
                });
              } else {
                emailStats.usersWithNoTasks++;
              }
            });
        });

        return Promise.all(emailPromises);
      })
      .then(() => {
        res.status(200).send({
          success: true,
          stats: emailStats
        });
      })
      .catch(err => {
        console.error("Error sending forecast emails:", err);
        res.status(500).send({
          success: false,
          error: err.message,
          stats: emailStats
        });
      });
  });
};
