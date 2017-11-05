chrome.browserAction.onClicked.addListener(function() {
    var _urls = [],
        dbName = "multi_tab",
        dbVersion = 2,
        tblName = "tbl_url",
        tblOrderIndex = "order",
        request = indexedDB.open(dbName, dbVersion);

    request.onerror = function(event) {
        console.log("Error opening database");
    };

    request.onupgradeneeded = function(event) {
        var db = event.target.result,
            store;
        
        store = db.createObjectStore(tblName, { autoIncrement: true });
        store.createIndex(tblOrderIndex, "order", { unique: true });
        db.close();
        chrome.tabs.create({url: 'options.html'});
    };

    request.onsuccess = function(event) {
        var _urls = [],
            db = event.target.result,
            tx = db.transaction([tblName], "readonly"),
            os = tx.objectStore(tblName),
            index = os.index(tblOrderIndex),
            cursor = index.openCursor();

        cursor.onsuccess = function(event) {
            var res = event.target.result;

            if (res) {
                _urls.push(res.value.url);
                res.continue();
            }
            else {
                if (_urls.length === 0) {
                    chrome.tabs.create({url: 'options.html'});
                    return; 
                }
                for (var i = 0; i < _urls.length; i++) {
                    chrome.tabs.create({url: _urls[i]});
                }
            }
            db.close();
        };
    };
});
