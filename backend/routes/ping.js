const express = require('express');

module.exports = (db) => {
    const router = express.Router();

    router.get('/', (req, res) => {
        res.json({
            message: 'pong'
        });
    });

    router.get('/give-me-an-error', (req, res) => {
        res.status(400).json({
            error: 'This is a test error'
        });
    });

    return router;
};