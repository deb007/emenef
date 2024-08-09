const express = require('express');
const router = express.Router();

module.exports = function (models, isLoggedIn) {
    const Entry = models.Entry;

    router.get('/get_verbs', isLoggedIn, function (req, res) {
        Entry.findAll({
            where: { status: 1 },
            attributes: [Entry.sequelize.fn('DISTINCT', Entry.sequelize.col('verb')), 'verb'],
            order: [['verb', 'ASC']],
            limit: 10,
            raw: true
        }).then(function (entries) {
            res.send(entries);
        })
    });

    router.get('/get_tasks', isLoggedIn, function (req, res) {
        var verb = req.query.v;
        var task = req.query.t;

        if (task && task != '') {
            Entry.findAll({
                where: { created_by: req.user.id, status: 1, forecast: 1, verb: verb, task: task },
                attributes: [[Entry.sequelize.fn('MAX', Entry.sequelize.col('entry_date')), 'entry_date'], 'task', 'next_date'],
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
                where: { created_by: req.user.id, status: 1, forecast: 1, verb: verb },
                attributes: [[Entry.sequelize.fn('MAX', Entry.sequelize.col('entry_date')), 'entry_date'], 'task'],
                group: ['task'],
                order: [['task', 'ASC']],
                limit: 10,
                raw: true
            }).then(function (entries) {
                res.send(entries);
            })
        }
    });

    router.get('/get_avg', isLoggedIn, function (req, res) {
        var verb = req.query.v;
        var task = req.query.t;

        if (verb != '' && task != '') {
            Entry.findAll({
                where: { created_by: req.user.id, status: 1, forecast: 1, verb: verb, task: task, days_ago: { [models.Sequelize.Op.gt]: 0 } },
                attributes: [[Entry.sequelize.fn('AVG', Entry.sequelize.col('days_ago')), 'avg_days_ago'], 'task'],
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

    router.get('/get_orphans', isLoggedIn, function (req, res) {

        // Calculate the date one month ago
        var oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        Entry.findAll({
            group: ['verb', 'task'], // Group by verb and task to count records for each combination
            having: models.Sequelize.literal(`COUNT(id) = 1 AND MAX(entry_date) < '${oneMonthAgo.toISOString()}'`), // Use Sequelize.literal to construct the having clause
            attributes: [
                'verb',
                'task',
                [models.Sequelize.fn('COUNT', models.Sequelize.col('id')), 'entry_count'], // Count of entries for each combination
                [models.Sequelize.fn('MAX', models.Sequelize.col('entry_date')), 'entry_date'] // Last entry date for each combination
            ]
        }).then(function (entries) {
            res.json(entries);
        }).catch(function (err) {
            console.error("Error retrieving old entries:", err);
            res.status(500).send('Could not retrieve old entries. Please try again later.');
        });
    });

    return router;
};
