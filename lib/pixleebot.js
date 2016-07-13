
// observations
// api errors need work
// should share hmac snippets and how to
// username + email logic needs upgrade esp as we do CRM
// api photos don't go to inbox
// distillery should cast int and string and blah blah as appropriate
/******************************************************************************/



// These are boss classes
var Bot 		= 	require('slackbots');
var AWS 		=		require('aws-sdk');

// I seperate capital letters from regulars
var util 		= 	require('util');
var path 		= 	require('path');
var request = 	require('request');
var fs 			= 	require('fs');
var http 		= 	require('http');
var crypto  = 	require('crypto');

// AWS keys handled by env automatgically
var s3 			= 	new AWS.S3();

// Let's construct our bot
var PixleeBot = function Constructor(settings) {
    this.settings 			= settings;
};

// inherits methods and properties from the Bot constructor
// this is some js hacky wizardry because it doesn't have proper inheritence
util.inherits(PixleeBot, Bot);

// sup boilerplate
module.exports = PixleeBot;

// Init function invoked by bot.js
PixleeBot.prototype.run = function () {
	PixleeBot.super_.call(this, this.settings);
	this.on('message', this._onShare);
	this.on('start', this._onStart);
};

// Start the party
PixleeBot.prototype._onStart = function (message) {
	console.log('Pixlee has started')
};


PixleeBot.prototype._onShare = function (message) {	
	// Necessary evil
	var _this = this;

	// Weird issue where if you use private tokens, it says bot user is self. 
	// if (this._isValidMessage(message) && this._isFromChannelOrPrivateGroup(message) && !this._isFromThisBot(message) ) {
	// 		   	console.log("HOORAY");
	// 	    	console.log(message.file.url_private_download);
	//  }


	if (this._isValidMessage(message) && this._isFromCorrectChannel(message)) {		
		// We have our own random filename generator with proper type
		var fileName 	=	this._randomFileName(message.file);    	
		// This is very important
		var file 			= fs.createWriteStream(fileName);

		// Go get it. 
		// Don't forget the stupid bearer token
		var rem 			= request(message.file.url_private_download, {'auth': {'bearer': this.settings.token}});
		rem.on('data', function(chunk) {

			// instead of loading the file into memory after the download, we can just pipe the data as it's being downloaded
			file.write(chunk);
		});
		rem.on('end', function() {
			// SUEPR important
			var s3body 		=	fs.createReadStream(fileName);
			var s3Params	=	{	Key: fileName,
					    					Body: s3body, 
					    					ACL: "public-read", 
					    					Bucket: _this.settings.aws_bucket,
					    					ContentType: message.file.mimetype
			};


			s3.upload(	s3Params, 
					function (err, data) {
						if (!err){
							var theFileURL 	= data.Location;
							var apiUrl			=	"https://distillery.pixlee.com/api/v2/media?api_key=" + _this.settings.pixlee_key;

							var pixleeUploadBody 	= {
								  "album_id": 	parseInt(_this.settings.pixlee_album),
								  "title": 			message.file.title,
								  "username": 	_this._getUserName(message),
								  "email": 			_this._makeSlackUploadsEmail(_this._getUserName(message)),
								  "photo_uri": 	theFileURL
							};

							// Share this with customers
							var hash = crypto.createHmac('sha1', _this.settings.pixlee_secret).update(JSON.stringify(pixleeUploadBody)).digest('base64');

							request({
							    url: 			apiUrl,
							    method: 	'POST',
							    headers: {
							    	'Content-Type': 	'application/json',
							        'Signature': 		hash
							    },
							    body: JSON.stringify(pixleeUploadBody)

							}, function(error, response, body){
							    if(error) {
							        console.log(error);
							    } else {
							        console.log(response.statusCode, body);
							    }
							});

						}else{
							console.log('something went wrong: ');
							console.log(err);
						}

					});
			});
    	}

};

/* Utility Methods */

// Pixlee associates an email address with the first username it receives
// This method 'creates' a unique email address per each slack user
// THIS IS HACKY
// TODO
// Get the actual slack user email
// That is a lot of work I don't care for right now...
PixleeBot.prototype._makeSlackUploadsEmail = function(username){
	var theEmail = username + "-slackuploads@pixleeteam.com";
	return theEmail;
};

// Ugly and disguisting and could be improved by smarter JS ninjas than I, surely
PixleeBot.prototype._getUserName = function(message){	

	var stringArr 	= message.username.split('|');
	var theUserName =	stringArr[1].replace('>', '');
	return theUserName;
};


PixleeBot.prototype._randomFileName = function(file){
	var fileString 	= "";
	var possible 		= "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

	for (var i = 0; i < 15; i++){
		fileString 	+= possible.charAt(Math.floor(Math.random() * possible.length));
	}

	fileString 		+=	fileString + "." + file.filetype;
	return fileString;
}



// We want to see if this message is in fact a message and specifically of a file share message
// We then want to make sure that the file share message actually has a file 
// Clause 1, 2, and 3 are indeed not redundant because Slack publishes MANY event types
// File events are the worst and since we are subscribing to a global 'message' type
// We need to be very specific in what we allow or else we will process a lot of junk
// and lastly we only allow certain file types so let us make sure that this message has a valid file before troubling ourselves
PixleeBot.prototype._isValidMessage = function (message) {		
    return message.type === 'message' && message.subtype === 'file_share' && this._isFile(message) && this._isValidFileType(message);
};

// Check to see if a message has a file shared
// This really is necessary as the Slack API is so unpredictable
PixleeBot.prototype._isFile = function (message) {    
	if ( typeof message.file === undefined || typeof message.file.filetype === undefined){			
		return false;
	}
	return true;
}

// We only allow certainl file types
// Here they are
// I used a switch case because I am old school
PixleeBot.prototype._isValidFileType = function (message) {    	
	var isValid = false;
	switch(message.file.filetype){
		case 'png': 	isValid = true;
									break;
		case 'gif': 	isValid = true;
									break;
		case 'jpg': 	isValid = true;
									break;
		case 'jpeg': 	isValid = true;
									break;
		case 'mp4': 	isValid = true;
									break;
	}
	return isValid;
};

// Check if the message is directed at the hard-coded room
// TODO
// One day, this will all be configured in a database with corresponding Pixlee keys and albums
// Until then, only #pixleememories photos will be accepted
PixleeBot.prototype._isFromCorrectChannel = function (message) {
	// If we were not using a super key, then the following code would work for only rooms bot was in
	// C == channel
	// G == group
	// return typeof message.channel === 'string' && (message.channel[0] === 'C' || message.channel[0] === 'G');

	var pixleeMemoriesChannel = "C1R6XH5D4";
	return message.channel == pixleeMemoriesChannel;
};

// Check to see if the message comes from a user that is not this bot
// Note: This DOES NOT work properly if you use a special Slack god key
PixleeBot.prototype._isFromThisBot = function (message) {
	return message.user === this.self.id;
};