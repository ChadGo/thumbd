var knox = require('knox'),
	_ = require('underscore'),
	tmp = require('tmp'),
	fs = require('fs'),
  http = require('http'),
  https = require('https');

function Grabber(opts) {
	_.extend(this, {
		aws_key: process.env.AWS_KEY,
		aws_secret: process.env.AWS_SECRET,
		bucket: process.env.THUMBNAIL_BUCKET,
		tmp_dir: (process.env.TMP_DIR || '/tmp')
	}, opts);
	
	if (this.s3) return;
	
	this.s3 = knox.createClient({
		key: this.aws_key,
		secret: this.aws_secret,
		bucket: this.bucket
	})
}

Grabber.prototype.download = function(remoteImagePath, callback) {
	var _this = this,
		extension = remoteImagePath.split('.').pop();

	tmp.file({dir: this.tmp_dir, postfix: "." + extension}, function(err, localImagePath, fd) {

		console.log('downloading', remoteImagePath, 'from s3 to local file', localImagePath);
		try
		{
			if (err) {
				callback(err);
				return;
			}
			console.log('creating file stream');
			var stream = fs.createWriteStream(localImagePath);

		    if (remoteImagePath.match(/https?:\/\//)) { // we are thumbnailing a remote image.
		    	console.log('getting file http');
		      	_this.getFileHTTP(remoteImagePath, localImagePath, stream, callback);
		    } else { 
		    	// we are thumbnailing an Object in our thumbnail S3 bucket.
		    	console.log('geting file from s3')
				 _this.getFileS3(remoteImagePath, localImagePath, stream, callback);
	   		}
		}
		catch(e){
			console.log("Download " + e);
		}
	});
};

Grabber.prototype.getFileHTTP = function(remoteImagePath, localImagePath, stream, callback) {
  var protocol = remoteImagePath.match('https://') ? https : http;

  protocol.get(remoteImagePath, function(res) {
    res.on('end', function() {
      stream.end();
      callback(null, localImagePath);
    });

    res.pipe(stream);
  }).on('error', function(err) {
    callback(err);
  });
};

Grabber.prototype.getFileS3 = function(remoteImagePath, localImagePath, stream, callback) {
	this.s3.getFile(encodeURI(remoteImagePath), function(err, res) {
		console.log('got file stream');
		err = err || res.statusCode >= 400 ? 'error retrieving from S3 status ' + res.statusCode : null;

		if (err) {
			callback(err);
			return;
		}

		res.pipe(stream);

		res.on('error', function(err) {
			console.log('response error:'+err);
			callback(err);
		});

		res.on('end', function() {
			console.log('response endded');
			stream.end();
			callback(null, localImagePath);
		});

	}).end();
};

exports.Grabber = Grabber;