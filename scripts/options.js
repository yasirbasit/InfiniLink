var indexedDbVersion = 2,
    updateUrlView = new multiTab.UpdateUrlView({
        el: $('#update-and-delete-urls'),
        dbVersion: indexedDbVersion
    }),
    insertUrlView = new multiTab.InsertUrlView({
        el: $('#insert-url'),
        updateView: updateUrlView,
        dbVersion: indexedDbVersion
    });
