'use strict';
const express = require('express');
const app = express();
const path = require('path');

const config = require('./config');
const db = require('./db');

const crypto = require('crypto');
const base64url = require('base64url');
const validUrl = require('valid-url');

const randomUrlString = (size) => base64url(crypto.randomBytes(size));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/new/*', (req, res) => {
    let origUrl = req.params[0];
    if (!validUrl.isWebUri(origUrl)) {
        // attempt to create a valid url from the user's input
        origUrl = `https://${origUrl}`;
        if (!validUrl.isWebUri(origUrl)) {
            res.send(`Invalid URL, make sure you use the following format: "http(s)://example.com".
                You entered: ${origUrl}`);
            return;
        }
    }
    let urlCollection = db.get().collection('urls');

    // if the url has already been shortened, return that shortened url
    urlCollection.findOne(
        // look for a document with the same original_url
        { original_url: origUrl },
        // output only the original_url and short_url
        { original_url: 1, short_url: 1, _id: 0 },
        (err, result) => {
            if (err) {
                throw err;
            }
            if (result !== null) {
                res.send(result);
                return;
            }

            let randStr = `https://xs-url.herokuapp.com/${randomUrlString(6)}`;
            let urlPair = { original_url: origUrl, short_url: randStr };

            urlCollection.findAndModify(
                // look for documents with the same short url
                { short_url: randStr },
                // sorting argument
                null, { $setOnInsert: urlPair }, {
                    new: true,
                    fields: { original_url: 1, short_url: 1, _id: 0 },
                    upsert: true,
                }, (err, doc) => {
                    if (err) {
                        throw err;
                    }
                    res.send(doc.value);
                });
        });
});

app.get('/:shortUrl', (req, res) => {
    let urlCollection = db.get().collection('urls');
    urlCollection.findOne({ short_url: `https://xs-url.herokuapp.com/${req.params.shortUrl}` }, { original_url: 1, _id: 0 },
        (err, doc) => {
            if (err) {
                throw err;
            }
            if (doc !== null) {
                res.redirect(doc.original_url);
                return;
            }
            res.send("Invalid short url.");
        });
});


db.connect(config.db.url, function(err) {
    if (err) {
        console.log('Unable to connect to Mongodb.');
        throw err;
        process.exit(1);
    } else {
        app.listen(config.port, () => {
            console.log(`App listening on port ${config.port}`);
        });
    }
})
