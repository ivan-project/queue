var spawn = require('child_process').spawn;
var amqplib = require('amqplib');
var fs = require("fs");
var mongo = require('mongodb');
var crypto = require('crypto');
var MongoClient = mongo.MongoClient;
var Grid = require('gridfs-stream');

var q = 'tasks';

var deleteFolderRecursive = function(path) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function (file,index) {
            var curPath = path + "/" + file;

            if (fs.lstatSync(curPath).isDirectory()) {
                deleteFolderRecursive(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};

// Consumer
amqplib.connect('amqp://localhost').then(function (conn) {
    console.log("Connected to the queue...");

    MongoClient.connect('mongodb://127.0.0.1:27017/ivan', function(err, db) {
        if (err) { throw err; }
        console.log("Connected to the database...");

        var ok = conn.createChannel();
        ok = ok.then(function (ch) {
            console.log("Queue channel selected...");
            ch.assertQueue(q);
            ch.consume(q, function (msg) {
                if (msg !== null) {
                    console.log("Starting job: "+msg.properties.messageId);
                    var jsonMsg = JSON.parse(msg.content.toString());

                    var tmpDir = "/tmp/"+msg.properties.messageId;
                    deleteFolderRecursive(tmpDir);
                    fs.mkdirSync(tmpDir);

                    var completeJob = function () {
                        ch.ack(msg);

                        deleteFolderRecursive(tmpDir);
                    };

                    var collection = db.collection('documents');
                    var gfs = Grid(db, mongo);

                    collection.findOne({ _id: new require('mongodb').ObjectID(jsonMsg.documentId) }, function(err, doc) {
                        if (err) {
                            console.warn(err);
                            return false;
                        }

                        switch (jsonMsg.type) {
                            case "plaintext":
                                gfs.collection('uploaded_files').findOne({ _id: doc.fileDocument }, function(err, file) {
                                    if (err) {
                                        console.log("Takie plynne frytki");
                                        return false;
                                    }

                                    console.log(file);

                                    var readstream = gfs.createReadStream({
                                        _id: doc.fileDocument,
                                        root: 'uploaded_files'
                                    });

                                    readstream.on('error', function (err) {
                                        console.log('An error occurred!', err);
                                        throw err;
                                    });

                                    var ext;

                                    switch (file.contentType) {
                                        case 'application/pdf':
                                            ext = 'pdf';
                                            break;
                                    }
                                    var writeable = fs.createWriteStream(tmpDir+'/input.'+ext);

                                    readstream.pipe(writeable);

                                    writeable.on('close', function () {
                                        var prc;
                                        switch (ext) {
                                            case "pdf":
                                                prc = spawn('pdftotext',  [tmpDir+'/input.pdf', tmpDir+'/plain.txt']);
                                                break;
                                            case "docx":
                                                prc = spawn('docx2txt.pl',  [tmpDir+'/input.docx', tmpDir+'/plain.txt']);
                                                break;
                                        }
                                        prc.on('close', function (code) {
                                            if (code == 0) {
                                                fs.readFile(tmpDir+'/plain.txt', 'utf8', function (err, data) {
                                                    if (err) {
                                                        return console.log(err);
                                                    }

                                                    data = data.replace(/[\n\r]+/gm, ' ');
                                                    data = data.replace(/\s{2,}/gm, ' ');
                                                    var sentences = data.split(/[.!\?]\s+/igm);

                                                    doc.plaintext = sentences.join("\n");
                                                    doc.status = "text_extracted";

                                                    collection.save(doc, function (err) {
                                                        console.log("Completed plaintext");
                                                        completeJob();

                                                        jsonStr = {
                                                            type: "lemmatize",
                                                            documentId: doc._id,
                                                            payload: {}
                                                        };

                                                        ch.assertQueue(q);
                                                        ch.sendToQueue(q, new Buffer(JSON.stringify(jsonStr)), {
                                                            messageId: crypto.randomBytes(20).toString('hex')
                                                        });
                                                    });

                                                });

                                            } else {
                                                completeJob();
                                            }
                                        });
                                    });
                                });
                                break;
                            case "lemmatize":
                                fs.writeFile(tmpDir+"/plain.txt", doc.plaintext, function (err) {
                                    if (err) {
                                        console.log(err);
                                        return false;
                                    }

                                    prc = spawn('make',  ['run', tmpDir+'/plain.txt', tmpDir+'/lemmatized.txt'], {
                                        cwd: '/var/ivan/lemmatizer'
                                    });

                                    prc.on('close', function (code) {
                                        if (code == 0) {
                                            fs.readFile(tmpDir+'/lemmatized.txt', 'utf8', function (err, data) {
                                                if (err) {
                                                    console.log(err);
                                                    return false;
                                                }

                                                doc.lemmatized = data;
                                                doc.status = "lemmatized";

                                                collection.save(doc, function (err) {
                                                    console.log("Completed lemmatization");
                                                    completeJob();

                                                    jsonStr = {
                                                        type: "perform_comparison",
                                                        documentId: doc._id,
                                                        payload: {}
                                                    };

                                                    ch.assertQueue(q);
                                                    ch.sendToQueue(q, new Buffer(JSON.stringify(jsonStr)), {
                                                        messageId: crypto.randomBytes(20).toString('hex')
                                                    });
                                                });

                                            });

                                        }
                                    });
                                });
                                break;
                            case "perform_comparison":
                                break;
                            case "compare":

                                break;
                        }
                    });

                }
            });
        });

        //return ok;
    });
}).then(null, function (err) {
    console.warn(err);
    process.exit(-1);
});
