var q = 'tasks';

var open = require('amqplib').connect('amqp://localhost');

// Consumer
open.then(function(conn) {
    var ok = conn.createChannel();
    ok = ok.then(function(ch) {
        ch.assertQueue(q);
        ch.consume(q, function(msg) {
            if (msg !== null) {
                console.log(msg.content.toString());
                ch.ack(msg);
            }
        });
    });
    return ok;
}).then(null, console.warn);
