'use strict';

// Modules
let formidable = require('formidable');
let http = require('http');
let fs = require('fs-extra');

// Port for the server to run on
const PORT = 8080;

let indexHtml = null;
try {
  indexHtml = fs.readFileSync('./index.html');
} catch (err) {
  indexHtml = '<h1>Error loading page.</h1>';
  console.error(err);
}

let server = http.createServer(function(req, res) {

  // Route for uploading file
  if (req.url === '/upload' && req.method.toLowerCase() === 'post') {
    let form = new formidable.IncomingForm();

    form.parse(req, function(err, fields, files) {
      res.writeHead(200, {'content-type': 'text/plain'});
      res.write('Upload received:\n');
    });

    form.on('end', function(fields, files) {
      /* Temporary location of our uploaded file */
      var temp_path = this.openedFiles[0].path;
      /* The file name of the uploaded file */
      var file_name = this.openedFiles[0].name;
      /* Location where we want to copy the uploaded file */
      var new_location = '/Users/josephroque/Documents/Workspace/bowling-companion-transfer/test/';
      fs.copy(temp_path, new_location + file_name, function(err) {
        if (err) {
          console.error(err);
        } else {
          console.log("success copying")
        }

        fs.remove(temp_path, function(err) {
          if (err) {
            console.error(err);
          } else {
            console.log('deleted temp');
          }
        });
      });
    });
    return;
  } else if (req.url === '/' && req.method.toLowerCase() === 'get') {
    /* Display api description page. */
    res.writeHead(200, {'content-type': 'text/html'});
    res.write(indexHtml);
    res.end();
  }
});

server.listen(PORT);
console.log(`Listening on port ${PORT}`);
