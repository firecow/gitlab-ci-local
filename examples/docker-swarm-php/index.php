<?php

require_once 'vendor/autoload.php';

use UAParser\Parser;

$ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.104 Safari/537.36";

$parser = Parser::create( );
$result = $parser->parse($ua);

echo json_encode($result, JSON_PRETTY_PRINT);
