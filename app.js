var spawn = require('child_process').spawn;
var amqplib = require('amqplib');
var fs = require("fs");
var mongo = require('mongodb');
var MongoClient = mongo.MongoClient;
var Grid = require('gridfs-stream');

var q = 'tasks';

var deleteFolderRecursive = function(path) {
    /*if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function(file,index){
            var curPath = path + "/" + file;
            
            if(fs.lstatSync(curPath).isDirectory()) {
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }*/
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
                        
                        gfs.files.find({ filename: doc.originFile }).toArray(function (err, files) {
                            if (err) {
                                console.log("Takie plynne frytki");
                                process.exit(-1);
                            }
                            var files[] = file;
                        })
                        
                        var readstream = gfs.createReadStream({
                            filename: doc.originFile
                        });
                        
                        readstream.on('error', function (err) {
                            console.log('An error occurred!', err);
                            throw err;
                        });
                        
                        var writeable = fs.createWriteStream( "/tmp/"+msg.properties.messageId+'/input');
                        
                        readstream.pipe(writeable);
                        
                        
                        writeable.on('close', function (file) {
                            console.log(file);
                        });
                        
                        switch (jsonMsg.type) {
                            case "plaintext":
                                /*var prc;
                                switch (jsonMsg.payload.fileType) {
                                    "pdf":
                                        var prc = spawn('pdftotext',  [tmpDir+'/input.pdf', tmpDir+'/plain.txt']);
                                        break;
                                    "docx":
                                        var prc = spawn('docx2txt.pl',  [tmpDir+'/input.docx', tmpDir+'/plain.txt']);
                                        break;
                                }
                                prc.on('close', function (code) {
                                    if (code == 0) {
                                        fs.readFile(tmpDir+'/plain.txt', 'utf8', function (err, data) {
                                            if (err) {
                                                return console.log(err);
                                            }
                                            console.log(data);
                                            
                                            var sentences = data.split(/(?<=[.?!])\s+(?=[a-z])/i);
                                            
                                            
                                            
                                            completeJob();
                                        });
                                        
                                    } else {
                                        completeJob();
                                    }
                                });*/
                                break;
                            case "lemmatize":
                                
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