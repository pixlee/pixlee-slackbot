// Boss class
var PixleeBot 		= require('../lib/pixleebot');

// boilerplate env stuff
var token 			= process.env.BOT_API_KEY;
var name 			= process.env.BOT_NAME;
var aws_bucket 		= process.env.BOT_AWS_BUCKET;
var pixlee_key 		= process.env.PIXLEE_API_KEY;
var pixlee_album 	= process.env.PIXLEE_ALBUM_ID;
var pixlee_secret 	= process.env.PIXLEE_SECRET_KEY;

// boilerplate to make Heroku happy
var http 			= require('http');
// literally hello world...
http.createServer(function (request, response) {
	response.writeHead(200, {'Content-Type': 'text/plain'});
    response.end('Hello World\n');
}).listen(process.env.PORT || 5000)

// let's start our bot!
var bot = new PixleeBot({
    token: 			token,
    name: 			name,
    aws_bucket: 	aws_bucket,
    pixlee_key: 	pixlee_key,
    pixlee_album: 	pixlee_album,
    pixlee_secret: 	pixlee_secret
});

bot.run();