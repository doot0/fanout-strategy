var should = require('chai').should()
    , assert = require('assert')
    , expect = require('expect.js')
    , Fanout = require("../index")

describe('RedisStrategy', function() {
  describe("publish", function() {
    var fanout;

    before(function() {
      fanout = new Fanout();
      var RedisStrategy = new fanout.Redis();
      fanout.setStrategy(RedisStrategy);
    });

    it('should publish to the channel with an object', function(done) {
      fanout.publish("test-channel", { data: "I have data" }, function(err) {
        expect(err).to.be.null;
        done();
      })
    });

    it('should fail to publish to the channel with string data', function(done) {
      fanout.publish("test-channel", "I have data", function(err) {
        expect(err).to.not.be.null;
        expect(err.message).to.equal("Must pass in an object to publish function");
        done();
      })
    });

  });

  describe("listen", function() {
    this.timeout(0);

    var fanout;

    before(function() {
      fanout = new Fanout();
      var RedisStrategy = new fanout.Redis();
      fanout.setStrategy(RedisStrategy);
    });

    it("should listen on the single queue", function(done) {
      fanout.listen({
        'test-queue': function(data) {
          console.log(data);
          return done();
        }
      }, function(err, res) {
        expect(err).to.not.be(null);
        fanout.publish("test-queue", { data: "HI" });
        done()
      });
    });
  });
});
