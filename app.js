var spawn = require('child_process').spawn;
var open = require('amqplib').connect('amqp://localhost');
var MongoClient = require('mongodb').MongoClient;

var q = 'tasks';

// Consumer
open.then(function (conn) {
    MongoClient.connect('mongodb://127.0.0.1:27017/ivan', function(err, db) {
        if (err) { throw err; }
        
        var ok = conn.createChannel();
        ok = ok.then(function (ch) {
            ch.assertQueue(q);
            ch.consume(q, function (msg) {
                if (msg !== null) {
                    var jsonMsg = JSON.parse(msg.content.toString());

                    db.collection('documents').findOne({ _id: new require('mongodb').ObjectID(jsonMsg.documentId) }, function(err, doc) {
                        if (err) {
                            console.warn(err);
                            return false;
                        }
                        
                        switch (jsonMsg.type) {
                            case "testing":
                                console.log(jsonMsg.payload.msg);
                                break;
                            case "process":
                                switch (jsonMsg.payload.fileType) {
                                    case "pdf":
                                        var prc = spawn('pdftotext',  ['input.pdf', 'output.txt']);
                                        break;
                                    case "docx":
                                        var prc = spawn('docx2txt.pl',  ['input.docx', 'output.txt']);
                                        break;
                                }
                                prc.on('close', function (code) {
                                    if (code == 0) {

                                    } else {

                                    }
                                });
                                break;
                        }
                    });

                    

                    ch.ack(msg);
                }
            });
        });
        return ok;
    });
}).then(null, console.warn);
