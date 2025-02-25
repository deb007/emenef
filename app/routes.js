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

    // CSS styles for modern email template
    const styles = `
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: #333;
          line-height: 1.6;
          margin: 0;
          padding: 0;
          background-color: #f9f9f9;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #ffffff;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          padding-bottom: 20px;
          border-bottom: 1px solid #eaeaea;
          margin-bottom: 20px;
        }
        .header h1 {
          color: #2c3e50;
          font-size: 24px;
          margin: 0;
          padding: 0;
        }
        .date {
          color: #7f8c8d;
          font-size: 16px;
          margin-top: 5px;
        }
        .greeting {
          margin-bottom: 20px;
        }
        .section {
          margin-bottom: 25px;
          padding-bottom: 15px;
        }
        .section-header {
          display: flex;
          align-items: center;
          font-size: 18px;
          color: #2c3e50;
          margin-bottom: 10px;
          padding-bottom: 5px;
          border-bottom: 1px solid #eaeaea;
        }
        .section-icon {
          margin-right: 10px;
          font-size: 20px;
        }
        .task-list {
          list-style-type: none;
          padding: 0;
          margin: 0;
        }
        .task-item {
          padding: 12px 15px;
          margin-bottom: 8px;
          background-color: #f8f9fa;
          border-left: 4px solid #3498db;
          border-radius: 4px;
        }
        .task-item.delayed {
          border-left-color: #e74c3c;
        }
        .task-item.today {
          border-left-color: #f39c12;
        }
        .task-item.upcoming {
          border-left-color: #2ecc71;
        }
        .task-title {
          font-weight: 600;
          color: #34495e;
        }
        .task-date {
          font-size: 14px;
          color: #7f8c8d;
          margin-top: 5px;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eaeaea;
          color: #95a5a6;
          font-size: 14px;
        }
        .empty-state {
          text-align: center;
          padding: 30px;
          color: #7f8c8d;
        }
        @media only screen and (max-width: 600px) {
          .container {
            width: 100%;
            border-radius: 0;
          }
        }
      </style>
    `;

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

                // Start building the modern email template
                let emailBody = `
                  <!DOCTYPE html>
                  <html lang="en">
                  <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Task Forecast</title>
                    ${styles}
                  </head>
                  <body>
                    <div class="container">
                      <div class="header">
                        <h1>Your Task Forecast</h1>
                        <div class="date">${todayIs}</div>
                      </div>
                      
                      <div class="greeting">
                        <p>Hello ${user.fullname},</p>
                        <p>Here's your personalized task forecast for the upcoming days:</p>
                      </div>
                `;

                // Delayed tasks section
                if (delayed.length > 0) {
                  emailBody += `
                    <div class="section">
                      <div class="section-header">
                        <span class="section-icon">⚠️</span>
                        <span>Overdue Tasks (${delayed.length})</span>
                      </div>
                      <ul class="task-list">
                  `;

                  emailBody += delayed.map(entry => `
                    <li class="task-item delayed">
                      <div class="task-title">${entry.verb} ${entry.task}</div>
                      <div class="task-date">Due on ${new Date(entry.ed).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                    </li>
                  `).join('');

                  emailBody += `
                      </ul>
                    </div>
                  `;
                }

                // Today's tasks section
                if (today.length > 0) {
                  emailBody += `
                    <div class="section">
                      <div class="section-header">
                        <span class="section-icon">📅</span>
                        <span>Today's Tasks (${today.length})</span>
                      </div>
                      <ul class="task-list">
                  `;

                  emailBody += today.map(entry => `
                    <li class="task-item today">
                      <div class="task-title">${entry.verb} ${entry.task}</div>
                    </li>
                  `).join('');

                  emailBody += `
                      </ul>
                    </div>
                  `;
                }

                // Upcoming tasks section
                if (upcoming.length > 0) {
                  emailBody += `
                    <div class="section">
                      <div class="section-header">
                        <span class="section-icon">🔜</span>
                        <span>Coming Soon (${upcoming.length})</span>
                      </div>
                      <ul class="task-list">
                  `;

                  emailBody += upcoming.map(entry => `
                    <li class="task-item upcoming">
                      <div class="task-title">${entry.verb} ${entry.task}</div>
                      <div class="task-date">Due on ${new Date(entry.ed).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                    </li>
                  `).join('');

                  emailBody += `
                      </ul>
                    </div>
                  `;
                }

                // Add footer
                emailBody += `
                      <div class="footer">
                        <p>Stay productive and have a great day!</p>
                      </div>
                    </div>
                  </body>
                  </html>
                `;

                return send_mail(
                  user.email,
                  `Task Forecast - ${todayIs}`,
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
                // No tasks
                emailStats.usersWithNoTasks++;
                return Promise.resolve();
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