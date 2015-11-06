#### Fanout Strategy

This is a package for implementing the fanout-pattern for event driven architechtures. 

There are two strategies currently implemented, with a common interface for interacting with them. This allows you to seamlessly interchange your fanout strategies on the fly.

#### Example
````
var Fanout = require('fanout-strategy');

var fanout = new Fanout();
// there are two strategies: Redis, AWS
var redisStrategy = new fanout.Redis(redisConfig);
var awsStrategy = new fanout.AWS(awsConfig);

fanout.setStrategy(redisStrategy);
````

Then, in your middleware you can do:
````
function(req, res, next) {
  // do stuff
  fanout.publish("example-event", {
    key1: "value1"
  }, function(err, info) {
  
  })
};
````

You can `listen` on events invoked by the `publish` method:

````
fanout.listen({
  'example-event': function(data, done) {
    // data = { key1: "value1" }
    // done is a callback used to acknowledge the job
  }
})
````


### Strategies

#### AWS

In strategies like AWS, you will want to use the "fanout pattern". Instead of publishing to an event and listening on that same event, as you would using a redis strategy, you instead want to publish to an `SNS` queue and have it fanout automatically to any `SQS` queues that are subscribed to that topic. 

This is advantageous for a microservices standpoint because in `SQS` the data is only deleted when it is acknowledged by the service. If a service happens to go down, it can get back to processing the backlog of messages that may have appeared during that time period.

This strategy deals with the **entire** lifecycle of a message. The `publish` method publishes to the specified `SNS` topic, and the `listen` method listens on the specified `SQS` queues. Additionally, the listeners are equipped to automatically delete messages that you "acknowledge" with a callback.

````
var awsStrategy = new fanout.AWS({
  accessKeyId: {String},
  secretAccessKey: {String},
  options: {
    sns: {
      region: {String},
      topicOwnerAWSAccountId: {String}
    },
    sqs: {
      region: {String},
      queueOwnerAWSAccountId: {String},
      waitTimeSeconds: {String} [Default=5s]
    }
  }
})
fanout.setStrategy(awsStrategy);
````

#### Redis
This will produce a redis strategy that defaults to your local redis. Two clients are created - a publish client and a subscription client. Redis pubsub are then used to publish and listen on events.
````
var redisStrategy = new fanout.Redis({
  host: {String} [Default="localhost"], 
  port: {String | Integer} [Default=6379],
  auth: {String} [Default=""]
})
fanout.setStrategy(redisStrategy);
````

#### RabbitMQ
(Coming Soon!)

### Methods

#### `publish`
Publish data to an event.

Example:
````
fanout.publish('example-event', { mydata: "hello" }, function(err, info) {})
````
Parameters:
- `@param {String} eventName [required]` The event name to publish to.
- `@param {Object} data [required]` The data to publish to the event.
- `@return {Function} callback

#### `listen`

- `@param {Object (listenerFunc, eventName)} data
- `{String} eventName` The event name to listen on
- `{Function} listenerFunc` The function to invoke when the event is triggered.
- `@return {Function} callback`

#### `setPrefix`
**This method is ignored for the Redis strategy!!**

What does this have to do with `setPrefix`?

If I have an event called `new-registration`, and I want to have listeners on the `email` and `chat` services pick it up, then I will want to have separate queues for each. The `setPrefix` method is for forcing you to choose a naming scheme for your `SQS` and `SNS` queues that is consistent.

For example. Consider the following without prefixes:
````
fanout.publish("auth__new-registration", user, function(err) {})`
````
And, in the listeners for the `search` and `chat` apis:
````
// search api
fanout.listen({
  "search__new-registration": function(user, done) {
    // index in search
  }
})

// chat api
fanout.listen({
  "chat__new-registration": function(user, done) {
    // index in search
  }
})
````
If you use `setPrefix`, you can do this:
````
// auth api
fanout.setPrefix("auth__");
fanout.publish("new-registration, user, function(err) {});

// search api
fanout.setPrefix("search__");
fanout.listen({
  "new-registration": function(user, done) {}
});

// chat api
fanout.setPrefix("chat__");
fanout.listen({
  "new-registration": function(user, done) {}
});
````






