var open = require('amqplib').connect('amqp://localhost');

var q = 'tasks';

// Publisher
open.then(function (conn) {
    var ok = conn.createChannel();
    ok = ok.then(function (ch) {
        var jsonStr = {
            type: "testing",
            documentId: "5365400451e28086b3135bad",
            payload: {
                msg: "hello world"
            }
        };
        
        ch.assertQueue(q);
        ch.sendToQueue(q, new Buffer(JSON.stringify(jsonStr)));
    });
    return ok;
}).then(null, console.warn);
