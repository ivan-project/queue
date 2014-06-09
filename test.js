var amqplib = require('amqplib');
var crypto = require('crypto');
var mongo = require('mongodb');
var MongoClient = mongo.MongoClient;
var Grid = require('gridfs-stream');
var fs = require("fs");

var q = 'tasks';

// Publisher
amqplib.connect('amqp://localhost').then(function (conn) {
    if (process.argv.length < 3) {
        throw "Unknown command";
    }

    console.log("Connected to the queue...");

    MongoClient.connect('mongodb://127.0.0.1:27017/ivan', function (err, db) {
        if (err) {
            console.error('[MongoDB]', err);
            process.exit(-1);
        }

        console.log("Connected to the database...");

        var collection = db.collection('documents');
        var gfs = Grid(db, mongo);

        var ok = conn.createChannel();
        ok = ok.then(function (ch) {
            switch (process.argv[2]) {
                case "document":
                    var fileId = crypto.randomBytes(20).toString('hex');

                    // streaming to gridfs
                    var writestream = gfs.createWriteStream({
                        filename: fileId+'.pdf',
                        mode: 'w',
                        content_type: 'application/pdf',
                        root: 'uploaded_files'
                    });
                    fs.createReadStream('./example.pdf').pipe(writestream);

                    writestream.on('close', function (file) {
                        console.log("Created new file "+file.filename+"\n");

                        collection.insert({
                            title: "Testowy dokument",
                            authors: ["Jan Kowalski"],
                            type: "thesis", // thesis|source
                            status: 0,
                            fileDocument: file._id
                        }, {w: 1}, function (err, records){
                            console.log("Created new document #"+records[0]._id+"\n");

                            jsonStr = {
                                type: "plaintext",
                                documentId: records[0]._id,
                                payload: {}
                            };

                            ch.assertQueue(q);
                            ch.sendToQueue(q, new Buffer(JSON.stringify(jsonStr)), {
                                messageId: crypto.randomBytes(20).toString('hex')
                            });

                        });

                    });


                    break;
                case "json":
                    ch.assertQueue(q);
                    ch.sendToQueue(q, new Buffer(process.argv[3]), {
                        messageId: crypto.randomBytes(20).toString('hex')
                    });

                    console.log('Added payload to the queue.');

                    break;
                default:
                    throw "Unknown command: "+process.argv[2];
                    break;
            }
        }).then(null, function (err) {
            console.error('[QUEUE]',err);
            process.exit(-1);
        });

        return ok;
    });
}).then(null, function (err) {
    console.error('[AMQPLib]',err);
    process.exit(-1);
});
