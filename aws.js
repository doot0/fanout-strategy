var _highland = require("highland")
	, AWS = require("aws-sdk")
	, async = require("async")
	, _ = require("underscore");

var deleteMessage = function(queueUrl, message, cb) {
	SQS.deleteMessage({
		QueueUrl: queueUrl,
		ReceiptHandle: message.ReceiptHandle
	}, cb);
};

var queueListener = function(queueUrl, queueFunc, message, done) {
	// try and coerce the data into JSON
	// otherwise, leave as it is
	try {
		var messageBody = JSON.parse(message.Body);
		messageBody = JSON.parse(messageBody.Message)
	} catch(err) {
		var messageBody = message.Body.Message || {};
	};

	queueFunc(messageBody, function(err, result) {
		// if there is an error on one of the messages, don't stop the service, but don't delete the message from the queue
		if (err) return done();

		// delete message only if there is no error
		deleteMessage(queueUrl, message, function(err, res) {
			// set these variables to null
			// this will tell the V8 garbage collector that it is safe to collect these variables
			queueUrl = null;
			message = null;
			messageBody = null;

			done(err, res)
		});
	});
};

/**
 * Run listener for SQS queue on defined interval
 *
 * @param {AWS.SQS} SQS The SQS object
 * @param {String} queueUrl The url of the queue
 * @param {Function} queueFunc The function to run with a message from queueName when it is received
 * @param {Object} options The SQS options (from options.sqs)
 * @param {Function} done The callback function to be run on completion
 */
var runListener = function(SQS, queueUrl, queueFunc, options, done) {
    SQS.receiveMessage({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: Math.ceil(options.sqs.maxNumberOfMessages) || 10,
      VisibilityTimeout: Math.ceil(options.sqs.visibilityTimeout) || 30,
      WaitTimeSeconds: Math.ceil(options.sqs.waitTimeSeconds) || 5
    }, function(err, result) {
    	// we want to know if the queue does not exist, so throw an error
    	if (err) return done(err);

  		if (result && result.Messages) {
        _highland(result.Messages).uniqBy(function(a, b) {
          return a.MessageId === b.MessageId;
        }).done(function() {
    			async.each(result.Messages, function(message, callback) {
  					queueListener(queueUrl, queueFunc, message, callback);
  				}, function(err, res) {
  					if (err) return done();

  					result = null;
  					// run listeners again!
  					// use process.nextTick to prevent memory leaks
  					process.nextTick(function() {
  						runListener(SQS, queueUrl, queueFunc, options, done);
  					});
  				});
        });
  		} else {
  			process.nextTick(function() {
  				runListener(SQS, queueUrl, queueFunc, options, done);
  			});
  		};
	});
};

/**
 * Instantiate the AWSPublishSubscribe object
 *
 * @param {String} awsConfig.accessKeyId [Required] The access key id for the AWS account
 * @param {String} awsConfig.secretAccessKey [Required] The AWS secret
 *
 * @param {String} awsConfig.options.sns.region [Required] The region for SNS
 * @param {String} awsConfig.options.sqs.topicOwnerAWSAccountId [Required] The AWS account id of the SNS topic owner
 * @param {String} awsConfig.options.sns.messageStructure [Optional, Default='json'] The message structure. Either 'string' or 'json'.
 *
 * @param {String} awsConfig.options.sqs.region [Required] The region for SQS
 * @param {String} awsConfig.options.sqs.queueOwnerAWSAccountId [Required] The AWS account id of the SQS queue owner
 * @param {Integer} awsConfig.options.sqs.maxNumberOfMessages [Optional, Default=10] The max number of messages to retrieve at a time from the SQS queue. This is ceiled.
 * @param {Integer} awsConfig.options.sqs.visibilityTimeout [Optional, Default=30] The time in seconds for the visibility timeout. This is ceiled.
 * @param {Integer} awsConfig.options.sqs.waitTimeSeconds [Optional, Default=5] The time in seconds to do long-polling. Set to 0 for short-polling. This is ceiled.
 * @param {Integer} awsConfig.options.sqs.intervalTimeout [Optional, Default=5500] The time in milliseconds to set the interval
 *
 *
 * If the intervalTimeout is less than the waitTimeSeconds, the intervalTimeout will be set to 100ms greater than the waitTimeSeconds
 */
AWSStrategy = module.exports = function(awsConfig) {
	if (!awsConfig) throw new Error('You must supply an awsConfig object.');

	this.accessKeyId = awsConfig.accessKeyId;
	this.secretAccessKey = awsConfig.secretAccessKey;

	this.options = awsConfig.options;
};

/**
 * publish data to SNS topic
 * the data in this SNS notification then fans out to the relevant SQS queues
 *
 * @param {String} topicName The name of the topic in SNS
 * @param {Object} data The data to be published to the topic under the protocol 'SQS'
 */
AWSStrategy.prototype.publish = function(topicName, data, callback) {
	data = data || {};
	callback = callback || function() { return; };
	if (!data) return callback();

	if (!this.options.sns) throw new Error('Missing awsConfig.options.sns property! Please supply a valid SNS configuration.');
	if (!this.options.sns.region) throw new Error('Missing awsConfig.options.sns.region property! Please provide a region for SNS.');
	if (!this.options.sns.topicOwnerAWSAccountId) throw new Error('Missing awsConfig.options.sns.topicOwnerAWSAccountId property! Please provide a topicOwnerAWSAccountId for SNS.');

	this.SNS = this.SNS  || new AWS.SNS({
		accessKeyId: this.accessKeyId,
		secretAccessKey: this.secretAccessKey,
		region: this.options.sns.region
	});

	var data = JSON.stringify(data);

   	this.SNS.publish({
        TopicArn: 'arn:aws:sns:' + this.options.sns.region + ':' + this.options.sns.topicOwnerAWSAccountId + ':' + topicName,
        MessageStructure: this.options.sns.messageStructure || 'json',
        Message: JSON.stringify({
			default: data,
			sqs: data
		})
    }, callback);
};

/**
 * Start all short/long polling listeners for registered SQS queues.
 * This function is recursive.
 * Once it has finished handling all the messages recieved, it will start again and poll for new messages.
 *
 * @param {Object} listeners A JSON object of listener functions for the queues
 *
 * The format for a listener is the following:
 *
 * (key = ({String} QueueName), value = ({Function} listenerFunction))
 *
 * For example:
 * {
 *   "registration-new": function(data) {
 *	    // do something with this data
 *   }
 * }
 */
AWSStrategy.prototype.listen = function(listeners, callback) {
  console.log("Listening")
	var options = this.options || {}
		, _this = this;
	// attach listeners to scope
	if (!this.listeners) {
		this.listeners = listeners;
	} else {
		// extend listeners with additional ones
		this.listeners = _(this.listeners).extend(listeners);
	};

	if (!options.sqs) throw new Error('Missing awsConfig.options.sqs property! Please supply a valid SQS configuration.');
	if (!options.sqs.region) throw new Error('Missing awsConfig.options.sqs.region property! Please provide a region for SQS.');
	if (!options.sqs.queueOwnerAWSAccountId) throw new Error('Missing awsConfig.options.sqs.queueOwnerAWSAccountId property! Please provide a queueOwnerAWSAccountId for SQS.');

	this.SQS = this.SQS || new AWS.SQS({
		accessKeyId: this.accessKeyId,
		secretAccessKey: this.secretAccessKey,
		region: options.sns.region
	});

	async.forEachOf(listeners, function(listener, queueName, callback) {
		_this.SQS.getQueueUrl({
	      QueueName: queueName,
	      QueueOwnerAWSAccountId: options.sqs.queueOwnerAWSAccountId
	    }, function(err, q) {
	    	if (err) return callback(err);
		    var queueUrl = q.QueueUrl;
			  runListener(_this.SQS, queueUrl, listener, options, callback);
		});
	}, function(err, res) {
		if (err) callback(new Error("Failed to start listener: " + err.message));
		callback(null, res);
	});
};

AWSStrategy.prototype.getListeners = function(listeners) {
	return this.listeners;
};
