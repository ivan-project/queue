var spawn = require('child_process').spawn;
var open = require('amqplib').connect('amqp://localhost');
var fs = require('fs');
var MongoClient = require('mongodb').MongoClient;

var q = 'tasks';

var deleteFolderRecursive = function(path) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function(file,index){
            var curPath = path + "/" + file;
            
            if(fs.lstatSync(curPath).isDirectory()) {
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};

// Consumer
open.then(function (conn) {
    MongoClient.connect('mongodb://127.0.0.1:27017/ivan', function(err, db) {
        if (err) { throw err; }
        
        var ok = conn.createChannel();
        ok = ok.then(function (ch) {
            ch.assertQueue(q);
            ch.consume(q, function (msg) {
                if (msg !== null) {
                    console.log("Starting job: "+msg.properties.messageId);
                    var jsonMsg = JSON.parse(msg.content.toString());
                    
                    var tmpDir = "/tmp/"+msg.properties.messageId;
                    fs.mkdirSync(tmpDir);
                    
                    var completeJob = function () {
                        ch.ack(msg);
                    
                        deleteFolderRecursive(tmpDir);
                    };

                    db.collection('documents').findOne({ _id: new require('mongodb').ObjectID(jsonMsg.documentId) }, function(err, doc) {
                        if (err) {
                            console.warn(err);
                            return false;
                        }
                        
                        switch (jsonMsg.type) {
                            case "testing":
                                console.log(jsonMsg.payload.msg);
                                
                                completeJob();
                                break;
                            case "process":
                                
                                switch (jsonMsg.payload.fileType) {
                                    case "pdf":
                                        var prc = spawn('pdftotext',  [tmpDir+'/input.pdf', tmpDir+'/plain.txt']);
                                        break;
                                    case "docx":
                                        var prc = spawn('docx2txt.pl',  [tmpDir+'/input.docx', tmpDir+'/plain.txt']);
                                        break;
                                }
                                prc.on('close', function (code) {
                                    if (code == 0) {
                                        
                                    } else {

                                    }
                                    completeJob();
                                });
                                break;
                            case "lemmatize":
                                
                                completeJob();
                                break;
                        }
                    });
                    
                }
            });
        });
        return ok;
    });
}).then(null, console.warn);
