IVAN Job Queue
==============

Kolekja działa automatycznie na maszynie wirtualnej dzięki daemonowi `supervisord`. *todo*

**Zarządzanie daemonem**:

```bash
$ sudo service supervisord stop|restart|start
```

**Czyszczenie rabbitmq z zadań**:

```bash
$ rabbitmqadmin purge queue name=tasks
```

**Ręczne dodawanie zadania do kolejki**:

*todo*

Format dokumentu MognoDB z pracą
--------------------------------

### Format dokumentu wymagany przez kolejkę

Dokumenty przechowywane są w kolekcji `documents`.

```json
{
    "_id": "MongoId()",
    "type": "thesis",
    "status": 0,
    "fileDocument": "ID PLIKU W GRIDFS",
    "plaintext": "...",
    "lemmatized": "...",
    "comparisons": {
        "completed": 0,
        "total": 100,
    },
}
```

### Statusy

* **0** - plik zuploadowany
* **10** - plik poddany ekstrakcji tekstu
* **20** - tekst po lematyzacji
* **30** - tekst po zadaniu dokumentów do porównania

### Dokumenty porównywań

Porównania przechowywane są w kolekcji `comparisons`.

```json
{
    "_id": "MongoId()",
    "compared": [
        "MongoId()",
        "MongoId()"
    ],
    "result": {
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
    }
}
```

* `result` przechowuje dane z projektu "diff"
* `compared` zawiera identyfikatory dwóch porównanych dokumentów

#### Znalezienie porównywań dla dokumentu ABCDEF

```js
db.comparisons.find({ compared: { $in: [ MongoId("ABCDEF") ] } })
```

Zadania kolejki
---------------

### Identyfikator zadania

Każde zadanie kolejki musi mieć przypisany nowy, unikalny identyfikator `messageId`.

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


