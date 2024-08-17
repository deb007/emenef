const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');

module.exports = function (models, isLoggedIn) { // Accept isLoggedIn as a parameter
    const Entry = models.Entry;

    router.get('/add', isLoggedIn, function (req, res) {
        res.render('../views/add-new', {
            APP_TITLE: process.env.APP_TITLE,
            user: req.user,
            message: req.flash('addErrors'),
            messagestatus: req.flash('addStatus'),
            verb: req.query.verb,
            task: req.query.task
        });
    });

    router.post('/save', isLoggedIn, function (req, res) {
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
                Entry.create(data).then(function (newItem) {
                    if (newItem) {
                        console.log(newItem.id);
                        if (newItem.forecast == 1) {
                            Entry.update(
                                { next_date: null },
                                { where: { created_by: req.user.id, status: 1, forecast: 1, verb: req.body.verb, task: req.body.task } }
                            ).then(function (r) {
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
                                    group: ['verb', 'task'],
                                    raw: true
                                }).then(function (e) {
                                    if (e[0].days_ago > 0) {
                                        Entry.sequelize.query(
                                            "UPDATE entries SET next_date = entry_date + INTERVAL '" + Math.round(e[0].days_ago) + " days' WHERE id = " + newItem.id
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
                            }).catch(function (err) {
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
                }).catch(function (err) {
                    console.error("Error creating entry:", err);
                    req.flash('addStatus', 'Could not be added. Please try again later');
                    res.redirect('/add');
                    return;
                });

            }
        });
    });

    router.get('/delete', isLoggedIn, function (req, res) {
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
            }).then(function (latestEntry) {
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
                }).then(function (previousEntry) {
                    // Delete the latest entry
                    Entry.destroy({
                        where: {
                            id: latestEntry.id
                        }
                    }).then(function () {
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
                            }).then(function (e) {
                                if (e[0].days_ago > 0) {
                                    Entry.update({
                                        next_date: Entry.sequelize.literal(`datetime(entry_date, '+${Math.round(e[0].days_ago)} days')`)
                                    }, {
                                        where: {
                                            id: previousEntry.id
                                        }
                                    }).then(function () {
                                        console.log("Previous entry's next_date updated.");
                                        res.status(200).send('Previous entry\'s next_date updated.');
                                    }).catch(function (err) {
                                        console.error("Error updating previous entry's next_date:", err);
                                        req.flash('deleteStatus', 'Could not update previous entry\'s next_date. Please try again later.');
                                        res.status(500).send('Could not update previous entry\'s next_date. Please try again later.');
                                    });
                                } else {
                                    req.flash('deleteStatus', 'No entries found for updating previous entry\'s next_date.');
                                    res.status(200).send('No entries found for updating previous entry\'s next_date.');
                                }
                            }).catch(function (err) {
                                console.error("Error finding average days_ago:", err);
                                req.flash('deleteStatus', 'Could not find average days_ago. Please try again later.');
                                res.status(500).send('Could not find average days_ago. Please try again later.');
                            });
                        } else {
                            res.status(200).send('Latest entry successfully deleted.');
                        }
                    }).catch(function (err) {
                        console.error("Error deleting latest entry:", err);
                        req.flash('deleteStatus', 'Could not delete latest entry. Please try again later.');
                        res.status(500).send('Could not delete latest entry. Please try again later.');
                    });
                }).catch(function (err) {
                    console.error("Error finding previous entry:", err);
                    req.flash('deleteStatus', 'Could not find previous entry. Please try again later.');
                    res.status(500).send('Could not find previous entry. Please try again later.');
                });
            }).catch(function (err) {
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
            }).then(function (deletedCount) {
                if (deletedCount > 0) {
                    req.flash('deleteStatus', deletedCount + ' entries successfully deleted.');
                    res.status(200).send(deletedCount + ' entries successfully deleted.');
                } else {
                    req.flash('deleteStatus', 'No matching entries found.');
                    res.status(404).send('No matching entries found.');
                }
            }).catch(function (err) {
                console.error("Error deleting entries:", err);
                req.flash('deleteStatus', 'Could not delete. Please try again later.');
                res.status(500).send('Could not delete. Please try again later.');
            });
        }
    });

    router.get('/browse', isLoggedIn, function (req, res) {
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

        }).catch(function (err) {
            console.error("Error browsing entries:", err);
            res.status(500).send("Internal Server Error");
        });
    });


    return router;
};
