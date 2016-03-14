'use strict';

// Modules
let formidable = require('formidable');
let http = require('http');
let fs = require('fs-extra');
let secret = require('./secret');

// Port for the server to run on
const PORT = 8080;

let indexHtml = null;
try {
  indexHtml = fs.readFileSync('./index.html');
} catch (err) {
  indexHtml = '<h1>Error loading page.</h1>';
  console.error(err);
}

// Generate an ID to represent the file uploaded.
const POSSIBLE_ID_VALIES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
let generateId = function() {
  let text = '';

  for (var i = 0; i < 5; i++)
    text += POSSIBLE_ID_VALIES.charAt(Math.floor(Math.random() * POSSIBLE_ID_VALIES.length));

  return text;
};

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
      var temp_path = this.openedFiles[0].path;
      /* The file name of the uploaded file */
      var file_name = this.openedFiles[0].name;

      console.log('Transfer complete. File location: ' + temp_path);

      // Location where we want to copy the uploaded file
      var new_location = './test';

      // Copy the file to the new location.
      fs.copy(temp_path, new_location + file_name, function(err) {
        if (err) {
          console.error('Error copying file.');
          console.error(err);
        } else {
          console.log('File copied successfully. File location: ' + new_location + file_name);
        }

        // Delete the old temp file
        fs.remove(temp_path, function(err) {
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
