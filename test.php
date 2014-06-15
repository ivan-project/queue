<?php

require_once __DIR__.'/vendor/autoload.php';

use PhpAmqpLib\Connection\AMQPConnection;
use PhpAmqpLib\Message\AMQPMessage;

$exchange = 'ivan';
$queue = 'tasks';

$conn = new AMQPConnection('localhost', 5672, 'guest', 'guest', '/');
$ch = $conn->channel();

$client = new MongoClient();
$db = $client->ivan;
$collection = $db->documents;

$ch->exchange_declare($exchange, 'direct', false, true, false);
$ch->queue_bind($queue, $exchange);

$msg = [
    "type" => "plaintext",
    "documentId" => "aabbccddeeff",
    "payload" => []
];

$toSend = new AMQPMessage(json_encode($msg), array('message_id'=>sha1(mt_rand())));
$ch->basic_publish($toSend, $exchange);

$ch->close();
$conn->close();
