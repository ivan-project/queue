<?php

$plain = file_get_contents($argv[1]);
//(?<=[^.?!;]\s|$)
$plain = preg_replace('/^[ ]+(?=[^ ])/msu', "", $plain); // trim lines
$plain = preg_replace('/(?<=[^ ])[ ]+$/msu', "", $plain); // trim lines
$plain = preg_replace('/[\.]{2,}/msu', ".", $plain); // remove dots
//$plain = preg_replace('/(?<=[^.?!;]\s)(\p{Lu}[^.?!;\n]+)(?=\n\p{Lu})/mu', "$1.\n", $plain);
$plain = preg_replace('/(\p{Lu}[^.?!;\n]+)(?=\n\p{Lu})/mu', "$1.\n", $plain); // find headers and add .
$plain = preg_replace('/(?<=[^.?!;])([ ]*\n[ ]*\n[ ]*)/msu', ".\n", $plain); // find headers and  add .
$sentences = preg_split('/(?<=[.?!;])\s+(?=\p{Lu})/msu', $plain); // split into sentences

$sentences = array_map(function ($input) {
    return preg_replace('/[\n]+/m', ' ', $input); // remove new lines in sentences
}, $sentences);

file_put_contents($argv[2], implode("\n", $sentences));
