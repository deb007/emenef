const express = require('express');
const router = express.Router();

module.exports = function (models, isLoggedIn) {
    const Subscriber = models.Subscriber;

    router.post('/subscribe', isLoggedIn, function (req, res) {
        if (req.user && req.user.id) {
            Subscriber.findOne({
                attributes: ['id'],
                where: { user_id: req.user.id }
            }).then(function (item) {
                if (item) {
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
                        subscription: req.body ? JSON.stringify(req.body) : ''
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
            res.status(200).send({ success: true });
        }
    });

    return router;
};
