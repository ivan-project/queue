IVAN Job Queue
==============



Format dokumentu MognoDB z pracą
--------------------------------

### Format dokumentu wymagany przez kolejkę

```json
{
    "_id": "MongoId()",
    "type": "thesis",
    "status": "uploaded",
    "fileDocument": "ID PLIKU W GRIDFS",
    "plaintext": "...",
    "lemmatized": "...",
    "completed": 0,
    "todo": 100,
    "diffs": {
        "ID porównanego dokumentu": {
            "percentageSimilarity": 100,
            "lines": [
                {
                    "sourceLineId": 1,
                    "similarLineId": 1
                },
                {
                    "sourceLineId": 3,
                    "similarLineId": 2
                }
            ]
        },
        "...": {
            "..."
        },
    }
}

Zadania kolejki
---------------

### Zmiana pliku binarnego na tekst

#### JSON zadania

```json
{
    "type": "plaintext",
    "documentId": "ID DOKUMENTU Z MONGO",
    "payload": {}
}
```

#### Działanie

Wywołanie przetwarzania pliku binarnego (PDF/DOCX) do formatu czystego tekstu oraz rozdzielenie tekstu na zdania.

#### Zmienione pola dokumentu

```json
{
    "status": "text_extracted",
    "plaintext": "TREŚĆ DOKUMENTU",
}
```

### Lematyzacja

#### JSON zadania

```json
{
    "type": "lemmatize",
    "documentId": "ID DOKUMENTU Z MONGO",
    "payload": {}
}
```

#### Działanie

Wywołanie lematyzatora i zapis zlematyzowanego tekstu do dokumentu.

#### Zmienione pola dokumentu

```json
{
    "status": "lemmatized",
    "lemmatized": "ZLEMATYZOWANY TEKST",
}
```


