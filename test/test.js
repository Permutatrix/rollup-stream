var expect = require('chai').expect;
var rollup = require('..');
var Readable = require('stream').Readable;
var hypothetical = require('rollup-plugin-hypothetical');

function collect(stream) {
  return new Promise(function(resolve, reject) {
    var data = '';
    stream.on('end', function() {
      resolve(data);
    });
    stream.on('error', function(err) {
      reject(err);
    });
    stream.on('data', function(chunk) {
      data += chunk.toString();
    });
  });
}


describe("rollup-stream", function() {
  it("should export a function", function() {
    expect(rollup).to.be.a('function');
  });
  
  it("should return a readable stream", function() {
    expect(rollup()).to.be.an.instanceof(Readable);
  });
  
  it("should emit an error if options isn't passed", function(done) {
    var s = rollup();
    s.on('error', function(err) {
      expect(err.message).to.equal("options must be an object or a string!");
      done();
    });
    s.on('data', function() {
      done(Error("No error was emitted."));
    });
  });
  
  it("should emit an error if options.entry isn't present", function(done) {
    var s = rollup({});
    s.on('error', function(err) {
      expect(err.message).to.equal("You must supply options.entry to rollup");
      done();
    });
    s.on('data', function() {
      done(Error("No error was emitted."));
    });
  });
  
  it("should take a snapshot of options when the function is called", function() {
    var options = {
      entry: './entry.js',
      plugins: [hypothetical({
        files: {
          './entry.js': 'import x from "./x.js"; console.log(x);',
          './x.js': 'export default "Hello, World!";'
        }
      })]
    };
    var s = rollup(options);
    options.entry = './nonexistent.js';
    return collect(s).then(function(data) {
      expect(data).to.have.string('Hello, World!');
    });
  });
  
  it("should use a custom Rollup if options.rollup is passed", function() {
    var options = {
      rollup: {
        rollup: function(options) {
          expect(options).to.equal(options);
          return Promise.resolve({
            generate: function(options) {
              expect(options).to.equal(options);
              return { code: 'fake code' };
            }
          });
        }
      }
    };
    return collect(rollup(options)).then(function(data) {
      expect(data).to.equal('fake code');
    });
  });
  
  it("shouldn't raise an alarm when options.rollup is passed", function() {
    return collect(rollup({
      entry: './entry.js',
      rollup: require('rollup'),
      plugins: [{
        load: function() {
          return 'console.log("Hello, World!");';
        }
      }]
    })).then(function(data) {
      expect(data).to.have.string('Hello, World!');
    });
  });
  
  it("should import config from the specified file if options is a string", function() {
    return collect(rollup('test/fixtures/config.js')).then(function(data) {
      expect(data).to.have.string('Hello, World!');
    });
  });
  
  it("should reject with any error thrown by the config file", function() {
    var s = rollup('test/fixtures/throws.js');
    s.on('error', function(err) {
      expect(err.message).to.include("bah! humbug");
      done();
    });
    s.on('data', function() {
      done(Error("No error was emitted."));
    });
  });
});

describe("sourcemaps", function() {
  it("should be added when options.sourceMap is true", function() {
    return collect(rollup({
      entry: './entry.js',
      sourceMap: true,
      plugins: [{
        load: function() {
          return 'console.log("Hello, World!");';
        }
      }]
    })).then(function(data) {
      expect(data).to.have.string('\n//# sourceMappingURL=data:application/json;');
    });
  });
  
  it("should not be added otherwise", function() {
    return collect(rollup({
      entry: './entry.js',
      plugins: [{
        load: function() {
          return 'console.log("Hello, World!");';
        }
      }]
    })).then(function(data) {
      expect(data).to.not.have.string('//# sourceMappingURL=');
    });
  });
});

describe("cache", function() {
  it("should not retransform when options.cache is provided", function() {
    var firstTransforms = 0, secondTransforms = 0, cache = {};
    return collect(rollup({
      entry: './entry.js',
      plugins: [{
        load: function() {
          return 'console.log("Hello, World!");';
        },
        transform: function() {
          ++firstTransforms;
        }
      }],
      cache: cache
    })).then(function(data) {
      expect(data).to.have.string('Hello, World!');
      return collect(rollup({
        entry: './entry.js',
        plugins: [{
          load: function() {
            return 'console.log("Hello, World!");';
          },
          transform: function() {
            ++secondTransforms;
          }
        }],
        cache: cache
      }));
    }).then(function(data) {
      expect(data).to.have.string('Hello, World!');
      expect(firstTransforms).to.equal(1);
      expect(secondTransforms).to.equal(0);
    });
  });
  
  it("should transform again when options.cache is provided", function() {
    var firstTransforms = 0, secondTransforms = 0, cache = {};
    return collect(rollup({
      entry: './entry.js',
      plugins: [{
        load: function() {
          return 'console.log("Hello, World!");';
        },
        transform: function() {
          ++firstTransforms;
        }
      }],
      cache: cache
    })).then(function(data) {
      expect(data).to.have.string('Hello, World!');
      return collect(rollup({
        entry: './entry.js',
        plugins: [{
          load: function() {
            return 'console.log("Goodbye, World!");';
          },
          transform: function() {
            ++secondTransforms;
          }
        }],
        cache: cache
      }));
    }).then(function(data) {
      expect(data).to.have.string('Goodbye, World!');
      expect(firstTransforms).to.equal(1);
      expect(secondTransforms).to.equal(1);
    });
  });
});
