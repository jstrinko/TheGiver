// Library for handling logging in a sane manner, including automatic
// log rotation based on strftime and strack tracing where appropriate
//
// This can be included in your service in one of two ways:

var Winston      = require('winston'),    // logger of choice by node nerds everywhere
    Path         = require('path'),      
    Mkdirp       = require('mkdirp'),     // for handling log dir creation transparently
    Util         = require('util'),
    FS           = require('fs'),
    ChildProcess = require('child_process'),
    _            = require('underscore'),
    Strftime     = require('strftime'),   // formats timestrings ala strftime :-)
    winstonDailyRotate = require('winston-daily-rotate-file');

// yo

var fileLoggingOptsDefaults = {
  filename: 'TheGiver' + '-%DATE%.log',
  datePattern: 'YYYY-MM-DD-HH',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '7d',
  timestamp:   _timestamp,
  colorize:    false,
  json:        false,
  prettyPrint: true,
  level:       'debug',
  dirname:     '/var/log'
};


// Main function; here we initiate a baseline console logger based on the types
// of logging we'll need.  If this is iniaited with a filename, we'll add a 
// RotateFile transport below.  We also have the option of enabling a transport
// for criticals that will email us
function logger(options) {
    options = !options ? {} : options;
    var winston_logger = new (Winston.Logger)({ });
    //console.log(Winston.config.syslog.levels);
    winston_logger.setLevels(Winston.config.syslog.levels);

    if (options.console !== false) {
        winston_logger.add(Winston.transports.Console,
            {
                timestamp:        _timestamp,
                colorize:         true,
                prettyPrint:      true,
                level:            'debug'
            });
    }

    var fileLoggingOpts = _.defaults({
      dirname: options.dirname
    }, fileLoggingOptsDefaults);

    if (options.filename && ! options.raw_json) {
        fileLoggingOpts.filename = options.filename;
    } else if (options.raw_json) {
        fileLoggingOpts.json = true;
    }

    winston_logger.add(winstonDailyRotate, fileLoggingOpts);

    // some vodoo here; we want to automagically log a stack trace when error, debug
    // or critical errors occur.  We essential overwrite the parent class for each
    // method and at a stack trace
    var methods = ['debug', 'info', 'notice', 'warning', 'error', 'crit', 'alert', 'emerg'];
    for (var i in methods) {
        var method = methods[i];
        this[method] = winston_logger[method];
    }

    //this.levels = winston_logger.levels;
    this.log = this.info = function(message, meta, callback) {
        var log_meta = options.console !== false ? undefined : meta;
        if (callback) {
            winston_logger.info(message, callback);
        }
        else {
            winston_logger.info(message);
        }
    };
    this.warn = this.warning;
    this.err = this.error = function(message, meta, callback) {
        var stack = _format_stack(message);
        var log_meta = options.console !== false ? undefined : meta;
        if (typeof(meta) == "function") {
            callback = meta;
        }
        winston_logger.error(stack[1], log_meta, function() { 
            winston_logger.debug(stack[0], callback) 
        });
    };
    this.debug = function(message, meta, callback) {
        var log_meta = options.console !== false ? undefined : meta;
        if (typeof(meta) == "function") {
            callback = meta;
        }
        var stack = _format_stack(message);
        winston_logger.debug(stack[1], log_meta, function() { winston_logger.debug(stack[0], meta, callback) });
    };
    this.crit = this.critical = function(message, meta, callback) {
        var log_meta = options.console !== false ? undefined : meta;
        if (typeof(meta) == "function") {
            callback = meta;
        }
        var stack = _format_stack(message);
        winston_logger.crit(stack[1], log_meta);
        winston_logger.crit(stack[1], log_meta, function() { winston_logger.debug(stack[0], meta, callback) });
    };
}

// for Stack tracing.  See commented out section below for customizing the output
// of stack traces.  I'm not a big fan of altering prepareStackTrace since it is
// a blocking operation.
function _format_stack(message) {
    var id = _uuid();
    message = message + ' | trace: ' + id;
    var error = new Error(id);
    var stack = error.stack;
    stack = stack.replace(/Error:\s/,'');
    // this is somewhat hackish, but messing with prepareStackTrace can lead to blocking 
    // problems.  Better to just strip out superfluous lines with regex
    stack = stack.replace(/    at logger.*?\n/,'');
    stack = stack.replace(/    at logger.*?\n/,'');
    stack = stack.replace(/    at _format_stack.*?\n/,'');
    return [stack,message];
}

logger.prototype.extend = function(target) {
    var methods = ['debug', 'info', 'log', 'notice', 'warn', 'warning', 'error', 'crit', 'alert', 'emerg', 'critical'];
    for (var i in methods) {
        var method = methods[i];
        target[method] = this[method];
    }
    return target;
};

// If someday you need more insight or don't like the stack trace format, you can
// overide the V8 engines trace here.  For complete details see
// http://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
//
// var old = Error.prepareStackTrace;
//
// Error.prepareStackTrace = function(error, structuredStackTrace) {
//  var formatted_trace = [];
//  structuredStackTrace.splice(0,0);
//  for (i in structuredStackTrace) {
//      var callSite = structuredStackTrace[i];
//      formatted_trace.push(
//          '\t' +
//          callSite.getTypeName()     + ' ' +
//          callSite.getFunction()     + ' ' +
//          callSite.getMethodName()   + ' ' +
//          callSite.getEvalOrigin()   + ' ' +
//          callSite.isToplevel()      + ' ' +
//          callSite.isEval()          + ' ' +
//          callSite.isNative()        + ' ' +
//          callSite.isConstructor()   + ' ' +
//          callSite.getFileName()     + ' ' + 
//          callSite.getFunctionName() + ' ' + 
//          callSite.getLineNumber()   + ' ' + 
//          callSite.getColumnNumber()
//      );
//  }
//  return "\n" + formatted_trace.join("\n");
//}
//
// //Error.prepareStackTrace = old;

// util function for returning the timestamp to include in logs. 
function _timestamp() {
    return Strftime('%Y-%m-%d %H:%M:%S');
}

function _uuid(a) {
    return a?(0|Math.random()*16).toString(16):(""+1e7+-1e3+-4e3+-8e3+-1e11).replace(/1|0/g,_uuid);
}

module.exports = logger;
