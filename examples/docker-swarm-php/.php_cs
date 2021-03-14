<?php

$finder = PhpCsFixer\Finder::create()
    ->exclude('tests/Fixtures')
    ->in(__DIR__);

$config = new PhpCsFixer\Config();
$config
    ->setRules([
        '@PSR12' => true,
    ])
    ->setFinder($finder);

return $config;
