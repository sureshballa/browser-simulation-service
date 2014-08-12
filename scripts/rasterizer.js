/*
 * phantomjs rasteriser server
 *
 * Usage:
 *   phantomjs rasterizer.js [basePath] [port] [defaultViewportSize]
 *
 * This starts an HTTP server waiting for screenshot requests
 */
var basePath = phantom.args[0] || '/tmp/'; 

var port  = phantom.args[1] || 3001;

var defaultViewportSize = phantom.args[2] || '';
defaultViewportSize = defaultViewportSize.split('x');
defaultViewportSize = {
  width: ~~defaultViewportSize[0] || 1024,
  height: ~~defaultViewportSize[1] || 600
};

var pageSettings = ['javascriptEnabled', 'loadImages', 'localToRemoteUrlAccessEnabled', 'userAgent', 'userName', 'password'];

var server, service;

server = require('webserver').create();

/*
 * Screenshot service
 *
 * Generate a screenshot file on the server under the basePath
 *
 * Usage:
 * GET /
 * url: http://www.google.com
 *
 * Optional headers:
 * filename: google.png
 * width: 1024
 * height: 600
 * clipRect: { "top": 14, "left": 3, "width": 400, "height": 300 }
 *
 * If path is omitted, the service creates it based on the url, removing the
 * protocol and replacing all slashes with dots, e.g
 * http://www.google.com => www.google.com.png
 *
 * width and height represent the viewport size. If the content exceeds these
 * boundaries and has a non-elastic style, the screenshot may have greater size.
 * Use clipRect to ensure the final size of the screenshot in pixels.
 *
 * All settings of the WebPage object can also be set using headers, e.g.:
 * javascriptEnabled: false
 * userAgent: Mozilla/5.0 (iPhone; U; CPU like Mac OS X; en) AppleWebKit/420+
 */ 
service = server.listen(port, function(request, response) {
  if (request.url == '/healthCheck') {
    response.statusCode = 200;
    response.write('up');
    response.close();
    return;
  }
  if (!request.headers.url) {
    response.statusCode = 400;
    response.write('Error: Request must contain an url header' + "\n");
    response.close();
    return;
  }
  var url = request.headers.url;
  
  console.log("PhantomJS service requested service for url: " + url);
  
  var path = basePath + (request.headers.filename || (url.replace(new RegExp('https?://'), '').replace(/\//g, '.') + '.png'));
  var page = require('webpage').create();
  var delay = request.headers.delay || 0;
  try {
    page.viewportSize = {
      width: request.headers.width || defaultViewportSize.width,
      height: request.headers.height || defaultViewportSize.height
    };
    if (request.headers.clipRect) {
      page.clipRect = JSON.parse(request.headers.clipRect);
    }
    for (name in pageSettings) {
      if (value = request.headers[pageSettings[name]]) {
        value = (value == 'false') ? false : ((value == 'true') ? true : value);
        page.settings[pageSettings[name]] = value;
      }
    }
  } catch (err) {
    response.statusCode = 500;
    if(err){
      response.write('Error while parsing headers: ' + err.message);
    }
    return response.close();
  }
//  page.onResourceRequested = function(request) {
//	  console.log('Request ' + JSON.stringify(request, undefined, 4));
//	};
//	page.onResourceReceived = function(response) {
//	  console.log('Receive ' + JSON.stringify(response, undefined, 4));
//	};
  console.log("pageSettings: " + JSON.stringify(page.settings));
  page.onConsoleMessage = function (msg) { console.log(msg); };
  page.open(url, function(status) {
    if (status == 'success') {   
    	if(typeof request.headers.complete !== "undefined"){
    		var noOfCheck = 0; //max to 80 which is 80*3000 = 4 mins
    		console.log('complete header found');
    		
    		var interval = window.setInterval(function (){
    			if(noOfCheck >= 80){
    				//Break waiting and render
    				console.log('Timeout waiting for complete element in the DOM');
    				var resultText;
					console.log("Looking for element id: " + request.headers.elementId);
					if(typeof request.headers.elementId !== "undefined"){  
						resultText = page.evaluate(function (elementId) {
							  	if(document.getElementById(elementId) !== null){
							  		return document.getElementById(elementId).innerText;
							  	}
							  	else{
							  		return "Element not found";
							  	}
					        }, request.headers.elementId);
						
						  console.log("Got the result: " + resultText);
						  
				    	}
					else{
						resultText = "";
					}
					
					console.log("Got the result: " + resultText);
			        response.write(resultText);
			        page.release();
			        response.close();
			        window.clearInterval(interval);
    			}
    			else{
    				var elementId = request.headers.complete;
    				console.log("Completed id: " + elementId);
    				var completeElementFound = page.evaluate(function (elementId){
    					return document.getElementById(elementId) !== null ;
    				}, elementId);
    				
    				if(completeElementFound){
    					console.log('complete header found and element also found');
    					
    					var resultText;
    					
    					if(typeof request.headers.elementId !== "undefined"){  
    						resultText = page.evaluate(function (elementId) {
    							  	if(document.getElementById(elementId) !== null){
    							  		return document.getElementById(elementId).innerText;
    							  	}
    							  	else{
    							  		return null;
    							  	}
    					        }, request.headers.elementId);
    						
							  console.log("Got the result: " + resultText);
    						  
    						  if(resultText == null){
    							  resultText = "";
    						  }
    				    	}
    					else{
    						resultText = "";
    					}
    					
    					//page.render();
    			        response.write(resultText);
    			        page.release();
    			        response.close();
    			        window.clearInterval(interval);
    				}
    				else{
    					console.log('complete element not found, will check again');
    				}
    				
    				noOfCheck++;
    				
    			}
    		}, 3000)
    	}
    	else{
    		console.log('complete header not found');
	      window.setTimeout(function () {
	    	
	    	if(typeof request.headers.elementId !== "undefined"){  
			  var boundingClipRect = page.evaluate(function (elementId) {
				  	if(document.getElementById(elementId) !== null){
				  		return document.getElementById(elementId).getBoundingClientRect();
				  	}
				  	else{
				  		return null;
				  	}
		        }, request.headers.elementId);
			  
			  if(boundingClipRect !== null){
				  page.clipRect = {
				            top:    boundingClipRect.top,
				            left:   boundingClipRect.left,
				            width:  boundingClipRect.width,
				            height: boundingClipRect.height
				        };
			  }
	    	}
	    	  
	        page.render(path);
	        response.write('Success: Screenshot saved to ' + path + "\n");
	        page.release();
	        response.close();
	      }, delay);
		}
    	
    } else {
      response.write('Error: Url returned status ' + status + "\n");
      page.release();
      response.close();
    }
  });
  // must start the response now, or phantom closes the connection
  response.statusCode = 200;
  response.write('');
});
