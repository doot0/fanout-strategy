var redis = require("redis")
	, async = require("async")
	, _ = require("underscore");

/**
 * Instantiate the RedisStrategy object
 * By default localhost:27017 is used
 *
 * @param {String} redisConfig.auth
 * @param {String} redisConfig.host
 * @param {String} redisConfig.port
 */
RedisStrategy = module.exports = function(redisConfig) {
  var redisConfig = redisConfig || {};

  this.subClient = redis.createClient(redisConfig.port || 6379, redisConfig.host || "localhost", { auth_pass: redisConfig.auth || "", return_buffers: false });
  this.pubClient = redis.createClient(redisConfig.port || 6379, redisConfig.host || "localhost", { auth_pass: redisConfig.auth || "", return_buffers: false });
  console.log("Created pub and sub client")
  return
};

/**
 * publish data to SNS topic
 * the data in this SNS notification then fans out to the relevant SQS queues
 *
 * @param {String} channelName The name of the channel
 * @param {Object} data The data to be published to the channel
 */
RedisStrategy.prototype.publish = function(channelName, data, callback) {
	data = data || {};
	callback = callback || function() { return; };
	if (!data) return callback(new Error("No data supplied"));

  if (typeof data !== "object") return callback(new Error("Must pass in an object to publish function"));

  this.pubClient.publish(channelName, JSON.stringify(data));
  return callback();
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
RedisStrategy.prototype.listen = function(listeners, callback) {
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

	_this.subClient.on("message", function(channel, message) {
		// run the listener function corresponding to the channel, which is the queueName
		_this.listeners[channel](JSON.parse(message), function(err) {
			if (err) {
				console.log("Error on %s listener", channel);
				console.log(err)
				console.log("------")
				console.log(message);
			}
		}); // pass in anonymous function as "done"
	});

  _.each(listeners, function(listenerFunc, queueName) {
    _this.subClient.subscribe(queueName);
    console.log("Subscribed to %s", queueName)
  });

  callback();
};

RedisStrategy.prototype.getListeners = function(listeners) {
	return this.listeners;
};
