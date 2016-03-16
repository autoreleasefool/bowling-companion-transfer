'use strict';

// Modules
let formidable = require('formidable');
let http = require('http');
let fs = require('fs-extra');
let cron = require('cron');
let mongodb = require('mongodb');
let secret = require('./secret');

// Port for the server to run on.
const PORT = 8080;
// Amount of time that a transfer will live on the server before being removed.
const TRANSFER_TIME_TO_LIVE = 1000 * 60 * 60;
// Directory to store user data.
const USER_DATA_LOCATION = __dirname + '/test/';
// Maximum number of keys and bowler data that can be stored on the server at any time.
const MAX_KEYS = 40;

let indexHtml = null;
try {
  indexHtml = fs.readFileSync(__dirname + '/index.html');
} catch (err) {
  indexHtml = '<h1>Error loading page.</h1>';
  console.error(err);
}

// MongoDB
let MongoClient = mongodb.MongoClient;
// Local URL of the mongo database.
const MONGO_URL = 'mongodb://localhost:27017/bowlingdata';
// Name of the collection that data will be stored in.
const MONGO_COLLECTION = 'transfers';
// Regular expression for getting the transfer key from a URL.
const REGEX_KEY = /\?key=([A-Z0-9]{5})$/;

// Generate an ID to represent the file uploaded.
const POSSIBLE_ID_VALUES = 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789';
let generateId = function() {
  let text = '';

  for (var i = 0; i < 5; i++)
    text += POSSIBLE_ID_VALUES.charAt(Math.floor(Math.random() * POSSIBLE_ID_VALUES.length));

  return text;
};

// Dictionary of keys which have already been used as IDs for transfers.
let usedKeys = {};

// Job to remove files which have been around longer than 1 hour.
// Runs once per hour.
let cleanupCronJob = new cron.CronJob({
  cronTime: '0 0 * * * *',
  onTick: function() {
    console.log('Running cleanupCronJob on ' + (new Date()));

    MongoClient.connect(MONGO_URL, function(err, db) {
      if (err) {
        console.error('Error establishing database connection.');
        console.error(err);
        return;
      }

      console.log('CronJob established database connection.');

      let currentTime = Date.now();

      // Get a cursor to iterate over the collection.
      let collection = db.collection(MONGO_COLLECTION);
      let cursor = collection.find();

      cursor.each(function(err, doc) {
        if (err) {
          console.error('Error retrieving documents.');
          console.error(err);
        } else if (doc !== null) {
          if (doc.time + TRANSFER_TIME_TO_LIVE < currentTime) {
            // This file has expired so remove it.
            fs.remove(doc.location, function(err) {
              if (err) {
                console.error(`Error removing file ${doc.location}`);
                console.error(err);
              } else {
                console.log(`Succesfully deleted file ${doc.location}`);

                if (doc.key in usedKeys) {
                  // Free up the key to be used elsewhere.
                  delete usedKeys[doc.key];
                }
              }
            });

            // Delete the entry from the database
            collection.deleteOne({key: doc.key});
          } else if (!(doc.key in usedKeys)) {
            // Key is still in use, but isn't in used keys for some reason.
            usedKeys[doc.key] = true;
          }
        }
      });
    });
  },
  start: false,
  timeZone: 'America/Los_Angeles'
});
cleanupCronJob.start();

let server = http.createServer(function(req, res) {

  if (req.url.startsWith('/valid') && req.method.toLowerCase() === 'get') {
    // Route for validating key
    let transfer_key = req.url.match(REGEX_KEY);
    let response = 'INVALID_KEY';
    console.log('Validating key:' + JSON.stringify(transfer_key));
    if (transfer_key !== null && transfer_key.length == 2) {
      transfer_key = transfer_key[1];
      if (transfer_key in usedKeys) {
        response = 'VALID';
      }
    }

    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.write(response);
    res.end();
  } else if (req.url.startsWith('/download') && req.method.toLowerCase() === 'get') {
    // Route for getting bowler data
    let transfer_key = req.url.match(REGEX_KEY);
    let response = 'INVALID_KEY';
    console.log('Validating key:' + JSON.stringify(transfer_key));
    if (transfer_key.length == 2) {
      transfer_key = transfer_key[1];
      if (transfer_key in usedKeys) {
        response = 'VALID';
      }
    }

    if (response === 'INVALID_KEY') {
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.write(response);
      res.end();
      return;
    }

    MongoClient.connect(MONGO_URL, function(err, db) {
      if (err) {
        console.error('Error establishing database connection.');
        console.error(err);
        return;
      }

      console.log('Download established database connection.');

      let collection = db.collection(MONGO_COLLECTION);
      collection.findOne({'key': transfer_key}, function(err, item) {
        if (err) {
          console.error('Could not retrieve item with key: ' + transfer_key);
          console.error(err);
          return;
        }

        let stat = fs.statSync(USER_DATA_LOCATION + transfer_key);
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': stat.size
        });

        let stream = fs.createReadStream(USER_DATA_LOCATION + transfer_key, { bufferSize: 32 * 1024 });
        stream.pipe(res);
      });
    });
  } else if (req.url === '/upload' && req.method.toLowerCase() === 'post') {
    // Route for uploading file
    console.log('Receiving upload request.');
    if (req.headers.authorization !== secret.transfer_api_key) {
      console.log('Invalid API key:' + req.headers.authorization);
      res.writeHead(401, {'Content-Type': 'text/plain'});
      res.write('Invalid API key.');
      res.end();
      return;
    }

    // Generate a unique ID for this request.
    let requestId = null;
    do {
      requestId = generateId();
    } while (requestId in usedKeys);
    usedKeys[requestId] = true;
    console.log(`Request ID: ${requestId}`);

    console.log('Initializing form.');
    let form = new formidable.IncomingForm();

    form.on('error', function(err) {
      console.error('Error receiving file.');
      console.error(err);
    })

    form.parse(req, function(err, fields, files) {
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.write(`requestId:${requestId}`);
      res.end();
    });

    form.on('end', function(fields, files) {
      /* Temporary location of our uploaded file */
      var temporaryPath = this.openedFiles[0].path;
      /* The file name of the uploaded file */
      var fileName = requestId;

      console.log(`Transfer complete. File location: ${temporaryPath}`);

      // Copy the file to the new location.
      fs.copy(temporaryPath, USER_DATA_LOCATION + fileName, function(err) {
        if (err) {
          console.error('Error copying file.');
          console.error(err);
        } else {
          let fullName = USER_DATA_LOCATION + fileName;
          console.log(`File copied successfully. File location: ${fullName}`);
        }

        // Delete the old temp file
        fs.remove(temporaryPath, function(err) {
          if (err) {
            console.error('Error removing temp file.');
            console.error(err);
          } else {
            console.log('Succesfully deleted temp file.');
          }
        });

        // Store the location of the data in the database.
        MongoClient.connect(MONGO_URL, function(err, db) {
          if (err) {
            console.error('Error establishing database connection.');
            console.error(err);
            return;
          }

          console.log('Upload established database connection.');

          let collection = db.collection(MONGO_COLLECTION);
          collection.insert({
            key: requestId,
            time: Date.now(),
            location: USER_DATA_LOCATION + fileName
          }, function(err, records) {
            if (err) {
              console.error('Failed to insert record.');
              console.error(err);
            }

            db.close();
          });
        });
      });
    });
  } else if (req.url === '/status' && req.method.toLowerCase() === 'get') {
    // Route for checking status of the server
    let response = 'OK';
    if (Object.keys(usedKeys).length > MAX_KEYS) {
      // If there is too much data stored right now, return "FULL" to let user know they can't transfer right now.
      response = 'FULL';
    }

    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.write(response);
    res.end();
  } else if (req.url === '/' && req.method.toLowerCase() === 'get') {
    // Display API description page.
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(indexHtml);
    res.end();
  }
});

server.listen(PORT);
console.log(`Listening on port ${PORT}`);
