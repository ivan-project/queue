var q = 'tasks';

var open = require('amqplib').connect('amqp://localhost');

// Publisher
open.then(function(conn) {
    var ok = conn.createChannel();
    ok = ok.then(function(ch) {
        ch.assertQueue(q);
        ch.sendToQueue(q, new Buffer('something to do'));
    });
    return ok;
}).then(null, console.warn);
