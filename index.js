var AWSStrategy = require("./aws");
var RedisStrategy = require("./redis");

function Fanout() {};

Fanout.prototype.AWS = AWSStrategy;
Fanout.prototype.Redis = RedisStrategy;

Fanout.prototype.setStrategy = function(strategy) {
	this.strategy = strategy;
};

Fanout.prototype.publish = function(topicName, data, callback) {
	this.strategy.publish(topicName, data, callback);
};

Fanout.prototype.listen = function(listeners, callback) {
	this.strategy.listen(listeners, callback);
};

Fanout.prototype.setPrefix = function(prefix) {
	this.strategy.prefix = prefix;
};

module.exports = Fanout;

// var Fanout = require("fanout-strategy")
// fanout = new Fanout();
// AWSStrategy = Fanout.AWS()
// fanout.setStrategy(AWSStrategy);

// fanout.publish()
// fanout.listen()

// new require("FanoutStrategy").AWS
