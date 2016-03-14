'use strict';

// Modules
let formidable = require('formidable');
let http = require('http');
let fs = require('fs-extra');
let cron = require('cron');
let secret = require('./secret');

// Port for the server to run on
const PORT = 8080;
// Amount of time that a transfer will live on the server before being removed.
const TRANSFER_TIME_TO_LIVE = 1000 * 60 * 60;

let indexHtml = null;
try {
  indexHtml = fs.readFileSync('./index.html');
} catch (err) {
  indexHtml = '<h1>Error loading page.</h1>';
  console.error(err);
}

// Generate an ID to represent the file uploaded.
const POSSIBLE_ID_VALUES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
let generateId = function() {
  let text = '';

  for (var i = 0; i < 5; i++)
    text += POSSIBLE_ID_VALUES.charAt(Math.floor(Math.random() * POSSIBLE_ID_VALUES.length));

  return text;
};

// Dictionary of objects which contain location and upload time of user bowling data.
let transferredData = {};

// Job to remove files which have been around longer than 1 hour.
// Runs once per hour.
let cleanupCronJob = new cron.CronJob({
  cronTime: '0 0 * * * *',
  onTick: function() {
    console.log('Running cleanupCronJob on ' + (new Date()));

    let currentTime = Date.now();
    for (var key in transferredData) {
      if (!transferredData.hasOwnProperty(key)) {
        continue;
      }

      let transferData = transferredData[key];
      if (transferData.time + TRANSFER_TIME_TO_LIVE < currentTime) {
        // This file has expired, so remove it.
        fs.remove(transferData.location, function(err) {
          if (err) {
            console.error(`Error removing file ${transferData.location}`);
            console.error(err);
          } else {
            console.log(`Succesfully deleted file ${transferData.location}`);
          }
        });

        // Delete this key, since it no longer points to a valid transfer, regardless of whether the file was removed.
        delete transferredData[key];
      }
    }
  },
  start: false,
  timeZone: 'America/Los_Angeles'
});
cleanupCronJob.start();

let server = http.createServer(function(req, res) {

  // Route for uploading file
  if (req.url === '/upload' && req.method.toLowerCase() === 'post') {
    console.log('Receiving upload request.');
    if (req.headers.authorization !== secret.transfer_api_key) {
      console.log('Invalid API key:' + req.headers.authorization);
      res.writeHead(401, {'content-type': 'text/plain'});
      res.write('Invalid API key.');
      res.end();
      return;
    }

    // Generate a unique ID for this request.
    let requestId = null;
    do {
      requestId = generateId();
    } while (requestId in transferredData);
    transferredData[requestId] = null;
    console.log(`Request ID: ${requestId}`);

    console.log('Initializing form.');
    let form = new formidable.IncomingForm();

    form.on('error', function(err) {
      console.error('Error receiving file.');
      console.error(err);
    })

    form.parse(req, function(err, fields, files) {
      console.log(files);
      res.writeHead(200, {'content-type': 'text/plain'});
      res.write('Upload received.');
      res.end();
    });

    form.on('end', function(fields, files) {
      /* Temporary location of our uploaded file */
      var temporaryPath = this.openedFiles[0].path;
      /* The file name of the uploaded file */
      var fileName = this.openedFiles[0].name;

      console.log(`Transfer complete. File location: ${temporaryPath}`);

      // Location where we want to copy the uploaded file
      var newLocation = './test/';

      // Copy the file to the new location.
      fs.copy(temporaryPath, newLocation + fileName, function(err) {
        if (err) {
          console.error('Error copying file.');
          console.error(err);
        } else {
          let fullName = newLocation + fileName;
          console.log(`File copied successfully. File location: ${fullName}`);
        }

        // Keep track of where the file is and when it was put there.
        transferredData[requestId] = {
          'time': Date.now(),
          'location': newLocation + fileName,
        };

        // Delete the old temp file
        fs.remove(temporaryPath, function(err) {
          if (err) {
            console.error('Error removing temp file.');
            console.error(err);
          } else {
            console.log('Succesfully deleted temp file.');
          }
        });
      });
    });
  } else if (req.url === '/' && req.method.toLowerCase() === 'get') {
    /* Display api description page. */
    res.writeHead(200, {'content-type': 'text/html'});
    res.write(indexHtml);
    res.end();
  }
});

server.listen(PORT);
console.log(`Listening on port ${PORT}`);
