IVAN Job Queue
==============

Kolekja działa automatycznie na maszynie wirtualnej dzięki daemonowi `supervisord`.

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
    "status": 10,
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
    "status": 20,
    "lemmatized": "ZLEMATYZOWANY TEKST",
}
```

### Znalezienie dokumentów do porównania

#### JSON zadania

```json
{
    "type": "perform_comparison",
    "documentId": "ID DOKUMENTU Z MONGO",
    "payload": {}
}
```

#### Działanie

Reset liczników porównywania, znalezienie zlematyzowanych tekstów w bazie u dodanie zadań

#### Zmienione pola dokumentu

```json
{
    "status": 30,
    "comparison": {
        "completed": 0,
        "total": // ilosc znalezionych dokumentow do porownania
    }
}
```

### Porównanie dwóch dokumentów

#### JSON zadania

```json
{
    "type": "compare",
    "documentId": "ID DOKUMENTU Z MONGO",
    "payload": {
        "compareTo": "ID POROWNYWANEGO DOKUMENTU MONGO"
    }
}
```

#### Działanie

Wywołuje moduł `diff` na dokumencie wywołującym porównanie i na porównywanym, zwiększa ich liczniki porównywań oraz zapisuje porównanie w kolekcji `comparisons`.

#### Zmienione pola dokumentu

##### Dokument, który wywołał porównanie:

```json
{
    "comparison": {
        "completed": // zwiekszenie liczby skonczonych dokumentow o jeden
    }
}
```

##### Dokument porównywany

```json
{
    "comparison": {
        "completed": ,// zwiekszenie liczby skonczonych dokumentow o jeden
        "total": // zwiekszenie liczby wszystkich dokumentow o jeden
    }
}
```
