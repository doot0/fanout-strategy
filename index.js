var AWSStrategy = require("./aws");

function Fanout() {};

Fanout.prototype.AWS = AWSStrategy; 

Fanout.prototype.setStrategy = function(strategy) {
	this.strategy = strategy;
};

Fanout.prototype.publish = function(topicName, data, callback) {
	this.strategy.publish(topicName, data, callback);
};

Fanout.prototype.listen = function(listeners, callback) {
	this.strategy.listen(listeners, callback);
};

module.exports = Fanout;

// var Fanout = require("fanout-strategy")
// fanout = new Fanout();
// AWSStrategy = Fanout.AWS()
// fanout.setStrategy(AWSStrategy);

// fanout.publish()
// fanout.listen()

// new require("FanoutStrategy").AWS