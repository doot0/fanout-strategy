var should = require('chai').should()
    , assert = require('assert')
    , expect = require('expect.js')
    , Fanout = require("../index")

describe('AWSStrategy', function() {
  describe("publish", function() {
    var fanout;

    before(function() {
      fanout = new Fanout();
      var AWSStrategy = new fanout.AWS(awsConfig);
      fanout.setStrategy(AWSStrategy);
    });

    it('should publish to SNS topic with string data', function(done) {
      fanout.publish("test-topic", "This is my data!", function(err, res) {
        expect(err).to.be(null);
        expect(res).to.have.property("ResponseMetadata");
        expect(res).to.have.property("MessageId");
        done()
      })
    });

    it('should publish to SNS topic with object data', function(done) {
      fanout.publish("test-topic", {
        mydata: "This is my data!",
        fluffyBunnies: 123
      }, function(err, res) {
        expect(err).to.be(null);
        expect(res).to.have.property("ResponseMetadata");
        expect(res).to.have.property("MessageId");
        done()
      })
    });

    it('should throw error if topic does not exist', function(done) {
      fanout.publish("test-topic-nonexistent", {
        mydata: "This is my data!",
        fluffyBunnies: 123
      }, function(err, res) {
        expect(err).to.not.be(null);
        expect(res).to.be(null);
        expect(err.code).to.be("NotFound");
        expect(err.message).to.be("Topic does not exist");
        expect(err.statusCode).to.be(404);
        done()
      })
    });
  });

  describe("listen", function() {
    this.timeout(0);

    var fanout;

    before(function() {
      fanout = new Fanout();
      var AWSStrategy = new fanout.AWS(awsConfig);
      fanout.setStrategy(AWSStrategy);
    });

    it("should throw an error when trying to listen on a non-existent queue", function(done) {
      fanout.listen({
        'test-queue-nonexistent': function(data) {
          console.log(data);
          return done();
        }
      }, function(err, res) {
        expect(err).to.not.be(null);
        done()
      });
    });

    it("should listen on the specified queue", function(callback) {
      fanout.listen({
        'test-queue': function(data, done) {
          console.log(data);
          return done();
        }
      }, function(err, res) {
        expect(err).to.not.be(null);
        expect(res).to.have.property('ResponseMetadata');
        expect(res.ResponseMetadata).to.have.property('RequestId');
        done();
        callback();
      });
    });
  })
});