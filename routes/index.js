var utils = require('../lib/utils');
var join = require('path').join;
var fs = require('fs');
var path = require('path');
var request = require('request');

module.exports = function(app, useCors) {
  var rasterizerService = app.settings.rasterizerService;
  var fileCleanerService = app.settings.fileCleanerService;

  // routes
  app.get('/', function(req, res, next) {
    if (!req.param('url', false)) {
      return res.redirect('/usage.html');
    }

    var url = utils.url(req.param('url'));
    // required options
    var options = {
      uri: 'http://localhost:' + rasterizerService.getPort() + '/',
      headers: { url: url }
    };
    ['width', 'height', 'clipRect', 'javascriptEnabled', 'loadImages', 'localToRemoteUrlAccessEnabled', 'userAgent', 'userName', 'password', 'delay', 'complete', 'elementId'].forEach(function(name) {
      if (req.param(name, false)) options.headers[name] = req.param(name);
    });
    
    console.log('params parser are: ' + JSON.stringify(options.headers));

    var filename = 'screenshot_' + utils.md5(url + JSON.stringify(options)) + '.png';
    options.headers.filename = filename;

    var filePath = join(rasterizerService.getPath(), filename);

    var callbackUrl = req.param('callback', false) ? utils.url(req.param('callback')) : false;

    console.log('Request for %s - Rasterizing it', url);
    processSimulationUsingRasterizer(options, filePath, res, callbackUrl, function(err) { if(err) next(err); });
  });

  app.get('*', function(req, res, next) {
    // for backwards compatibility, try redirecting to the main route if the request looks like /www.google.com
    res.redirect('/?url=' + req.url.substring(1));
  });

  var processSimulationUsingRasterizer = function(rasterizerOptions, filePath, res, url, callback) {
    if (url) {
      // asynchronous
      res.send('Will post screenshot to ' + url + ' when processed');
      callRasterizer(rasterizerOptions, function(error) {
        if (error) return callback(error);
        //postImageToUrl(filePath, url, callback);
      });
    } else {
      // synchronous
      callRasterizer(rasterizerOptions, function(error, result) {
        if (error) return callback(error);
        console.log('Sending result in response');
        if (useCors) {
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Expose-Headers", "Content-Type");
        }
        console.log("Result from phantomjs service is " + result);
        res.send(201, result);
      });
    }
  }

  var callRasterizer = function(rasterizerOptions, callback) {
    request.get(rasterizerOptions, function(error, response, body) {
      if (error || response.statusCode != 200) {
        console.log('Error while requesting the rasterizer: %s', error.message);
        rasterizerService.restartService();
        return callback(new Error(body));
      }
      callback(null, body);
    });
  }

};