var spawn = require('child_process').spawn;
var amqplib = require('amqplib');
var fs = require("fs");
var mongo = require('mongodb');
var crypto = require('crypto');
var MongoClient = mongo.MongoClient;
var Grid = require('gridfs-stream');
var ObjectID = require('mongodb').ObjectID;

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
// LET THE SPAGHETTI BEGIN
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
                    var jobID = msg.properties.messageId.substring(0, 10);
                    console.log("["+Date.now()+"]["+jobID+"] Starting job");
                    var jsonMsg = JSON.parse(msg.content.toString());

                    var tmpDir = "/tmp/"+msg.properties.messageId;
                    deleteFolderRecursive(tmpDir);
                    fs.mkdirSync(tmpDir);

                    var completeJob = function () {
                        ch.ack(msg);

                        deleteFolderRecursive(tmpDir);
                    };

                    var collection = db.collection('documents');
                    var comparisons = db.collection('comparisons');
                    var gfs = Grid(db, mongo);

                    collection.findOne({ _id: new ObjectID(jsonMsg.documentId) }, function(err, doc) {
                        if (err) {
                            console.warn(err);
                            completeJob();
                            return false;
                        }

                        if (!doc) {
                            console.warn("["+Date.now()+"]["+jobID+"] No document: "+jsonMsg.documentId);
                            completeJob();
                            return false;
                        }

                        switch (jsonMsg.type) {
                            case "plaintext":
                                console.log("["+Date.now()+"]["+jobID+"] Extracting plaintext...");
                                gfs.collection('uploaded_files').findOne({ _id: doc.fileDocument }, function(err, file) {
                                    if (err) {
                                        console.log("["+Date.now()+"]["+jobID+"] Takie plynne frytki");
                                        completeJob();
                                        return false;
                                    }

                                    if (!file) {
                                        console.warn("["+Date.now()+"]["+jobID+"] No file: "+doc.fileDocument);
                                        completeJob();
                                        return false;
                                    }

                                    var readstream = gfs.createReadStream({
                                        _id: doc.fileDocument,
                                        root: 'uploaded_files'
                                    });

                                    readstream.on('error', function (err) {
                                        console.log("["+Date.now()+"]["+jobID+'] An error occurred!', err);
                                        completeJob();
                                        throw err;
                                    });

                                    var ext;

                                    switch (file.contentType) {
                                        case 'application/pdf':
                                            ext = 'pdf';
                                            break;
                                        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                                            ext = 'docx';
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
                                                prc = spawn('php',  ['/var/ivan/queue/split.php', tmpDir+'/plain.txt', tmpDir+'/split.txt']);

                                                prc.on('close', function (code) {
                                                    if (code == 0) {
                                                        fs.readFile(tmpDir+'/split.txt', 'utf8', function (err, data) {
                                                            if (err) {
                                                                return console.log(err);
                                                                completeJob();
                                                            }

                                                            data = data.replace(/[\n\r]+/gm, ' ');
                                                            data = data.replace(/\s{2,}/gm, ' ');
                                                            var sentences = data.split(/[.!\?]\s+/igm);

                                                            doc.plaintext = sentences.join("\n");
                                                            doc.status = 10;

                                                            collection.update({ _id: doc._id }, doc, function (err) {
                                                                console.log("["+Date.now()+"]["+jobID+"] Completed plaintext");
                                                                completeJob();

                                                                var jsonStr = {
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
                                            } else {
                                                completeJob();
                                            }
                                        });
                                    });
                                });
                                break;
                            case "lemmatize":
                                console.log("["+Date.now()+"]["+jobID+"] Starting lemmatization...");
                                fs.writeFile(tmpDir+"/plain.txt", doc.plaintext, function (err) {
                                    if (err) {
                                        console.log(err);
                                        completeJob();
                                        return false;
                                    }

                                    prc = spawn('./run.sh', [tmpDir+'/plain.txt', tmpDir+'/lemmatized.txt'], {
                                        cwd: '/var/ivan/lemmatizer'
                                    });

                                    prc.on('close', function (code) {
                                        if (code == 0) {
                                            fs.readFile(tmpDir+'/lemmatized.txt', 'utf8', function (err, data) {
                                                if (err) {
                                                    console.log(err);
                                                    completeJob();
                                                    return false;
                                                }

                                                doc.lemmatized = data;
                                                doc.status = 20;

                                                collection.update({ _id: doc._id }, doc, function (err) {
                                                    console.log("["+Date.now()+"]["+jobID+"] Completed lemmatization");
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

                                        } else {
                                            console.log("["+Date.now()+"]["+jobID+"] Lemmatizer exit: "+code);
                                            completeJob();
                                            return false;
                                        }
                                    });
                                });
                                break;
                            case "perform_comparison":
                                comparisons.remove({ compared: { $in: [doc._id] } }, function () {
                                    collection.update({ _id: doc._id }, { $set: { comparison: {
                                        completed: 0,
                                        total: 0
                                    } } }, function (err) {
                                        var query = { _id: { $ne: doc._id }, status: { $gte: 20 } };
                                        if (doc.type == "book") {
                                            query.type = { $ne: "book" };
                                        }
                                        collection.find(query, function (err, cursor) {
                                            if (err) {
                                                console.log(err);
                                                completeJob();
                                                return false;
                                            }

                                            cursor.count(function (err, count){
                                                if (typeof count == "undefined") {
                                                    count = 0;
                                                }

                                                console.log("["+Date.now()+"]["+jobID+"] Documents found for comparison: "+count);

                                                doc.comparison = {
                                                    total: count
                                                };
                                                doc.status = 30;


                                                var jsonStr = {
                                                    type: "compare",
                                                    documentId: doc._id,
                                                    payload: {}
                                                };

                                                function processItem (err, item) {
                                                    if (item === null) {
                                                        collection.update({ _id: doc._id }, { $set: { 'comparison.total': count, status: 30 } }, function (err) {
                                                            completeJob();
                                                        });
                                                        return true;
                                                    } else {
                                                        var jsonStr = {
                                                            type: "compare",
                                                            documentId: doc._id,
                                                            payload: {
                                                                compareTo: item._id
                                                            }
                                                        };

                                                        ch.assertQueue(q);
                                                        ch.sendToQueue(q, new Buffer(JSON.stringify(jsonStr)), {
                                                            messageId: crypto.randomBytes(20).toString('hex')
                                                        });

                                                        cursor.nextObject(processItem);
                                                    }
                                                }

                                                cursor.nextObject(processItem);
                                            });
                                        });
                                    });
                                });
                                break;
                            case "compare":
                                console.log("["+Date.now()+"]["+jobID+"] Starting the compare");

                                collection.findOne({ _id: new ObjectID(jsonMsg.payload.compareTo) }, function (err, compareToDoc) {
                                    if (err) {
                                        console.log("["+Date.now()+"]["+jobID+"] Document "+jsonMsg.payload.compareTo+" could not be found, aborting");
                                        completeJob();
                                        return false;
                                    }

                                    if (!compareToDoc) {
                                        console.log("["+Date.now()+"]["+jobID+"] Document "+jsonMsg.payload.compareTo+" could not be found, aborting");
                                        completeJob();
                                        return false;
                                    }

                                    fs.writeFile(tmpDir+"/a.txt", doc.lemmatized, function (err) {
                                        if (err) {
                                            console.log(err);
                                            completeJob();
                                            return false;
                                        }

                                        fs.writeFile(tmpDir+"/b.txt", compareToDoc.lemmatized, function (err) {
                                            if (err) {
                                                console.log(err);
                                                completeJob();
                                                return false;
                                            }

                                            prc = spawn('ruby1.9.3',  ['comparator.rb', tmpDir+'/a.txt', tmpDir+'/b.txt', tmpDir+'/out.txt'], {
                                                cwd: '/var/ivan/diff',
                                                env: {
                                                    'PWD': '/var/ivan/diff',
                                                    'LC_ALL': 'en_US'
                                                }
                                            });

                                            prc.on('close', function (code) {
                                                if (code == 0) {
                                                    fs.readFile(tmpDir+'/out.txt', 'utf8', function (err, data) {
                                                        if (err) {
                                                            console.log(err);
                                                            completeJob();
                                                            return false;
                                                        }

                                                        doc.comparison.completed++;

                                                        var jsonResult = JSON.parse(data);

                                                        var compareDoc = {
                                                            compared: [
                                                                doc._id,
                                                                compareToDoc._id
                                                            ],
                                                            result: jsonResult
                                                        };

                                                        comparisons.save(compareDoc, function (err) {
                                                            collection.update({ _id: doc._id }, { $inc: { 'comparison.completed': 1 } }, function (err) {
                                                                collection.update({ _id: compareToDoc._id }, { $inc: { 'comparison.completed': 1, 'comparison.total': 1 } }, function (err) {
                                                                    completeJob();
                                                                    console.log("["+Date.now()+"]["+jobID+"] Completed compare of "+doc._id+" and "+compareToDoc._id+"");
                                                                });
                                                            });
                                                        });

                                                    });
                                                } else {
                                                    console.log("["+Date.now()+"]["+jobID+"] Diff exit: "+code);
                                                    completeJob();
                                                    return false;
                                                }
                                            });
                                        });
                                    });
                                });
                                break;
                            default:
                                console.warn("["+Date.now()+"]["+jobID+"] no type"+jsonMsg.type);
                                completeJob();
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
