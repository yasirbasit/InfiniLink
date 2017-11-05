var multiTab = multiTab || {};

multiTab.InsertUrlView = Backbone.View.extend({
    events: {
        "click #save-url-button": "handleSave",
        "keyup input": "handleInputChange"
    },

    initialize: function(options) {
        var _this = this;

        _.bindAll(_this,
            'render',
            'initializeConstants',
            'handleSave',
            'handleInputChange',
            'saveToDb'
        );
        
        _this.initializeConstants(options);
        _this.render();
    },

    render: function() {
        var _this = this;

        _this.$el.find(_this.DESCRIPTION_INPUT_SELECTOR).attr('placeholder', 'Description');
        _this.$el.find(_this.URL_INPUT_SELECTOR).attr('placeholder', 'https://www.google.com/');
    },

    initializeConstants: function(options) {
        var _this = this;

        _this.UPDATE_VIEW = options.updateView;
        _this.DESCRIPTION_INPUT_SELECTOR = '#description-input';
        _this.URL_INPUT_SELECTOR = '#url-input';
        _this.SAVE_BUTTON_SELECTOR = '#save-url-button';
        _this.LOCAL_DB = "multi_tab";
        _this.DB_VERSION = options.dbVersion;
        _this.URL_TABLE = "tbl_url";
        _this.ORDER_INDEX = "order";
    },

    handleSave: function(event) {
        var _this = this,
            description = _this.$el.find(_this.DESCRIPTION_INPUT_SELECTOR).val().trim(),
            url = _this.$el.find(_this.URL_INPUT_SELECTOR).val().trim(),
            protocolSeparatorIndex;

        if (description.length === 0 || url.length === 0) {
            event.target.blur();
            return;
        }
        protocolSeparatorIndex = url.indexOf('://');
        if (protocolSeparatorIndex < 0 || 16 < protocolSeparatorIndex) {
            url = 'http://' + url;
        }
        _this.saveToDb(description, url);
        _this.$el.find(_this.DESCRIPTION_INPUT_SELECTOR).val('');
        _this.$el.find(_this.URL_INPUT_SELECTOR).val('');
        event.target.blur();
        _this.$el.find(_this.SAVE_BUTTON_SELECTOR).attr('disabled', true);
    },

    handleInputChange: function(event) {
        var _this = this,
            description = _this.$el.find(_this.DESCRIPTION_INPUT_SELECTOR).val().trim(),
            url = _this.$el.find(_this.URL_INPUT_SELECTOR).val().trim();

        if (description.length === 0 || url.length === 0) {
            _this.$el.find(_this.SAVE_BUTTON_SELECTOR).attr('disabled', true);
        }
        else {
            _this.$el.find(_this.SAVE_BUTTON_SELECTOR).removeAttr('disabled');
        }
    },

    saveToDb: function(_description, _url) {
        var _this = this,
            request = indexedDB.open(_this.LOCAL_DB, _this.DB_VERSION);

        request.onerror = function(event) {
            console.log("Error opening database");
        };

        request.onupgradeneeded = function(event) {
            var db = event.target.result,
                store;

            store = db.createObjectStore(_this.URL_TABLE, {autoIncrement: true});
            store.createIndex(_this.ORDER_INDEX, "order", { unique: true });
            db.close();
        };

        request.onsuccess = function(event) {
            var db = event.target.result,
                tx = db.transaction([_this.URL_TABLE], "readwrite"),
                store = tx.objectStore(_this.URL_TABLE),
                index = store.index(_this.ORDER_INDEX);
                // iterate in descending order
                cursor = index.openCursor(null, "prev"),
                _order = 0,
                row = {};

            cursor.onsuccess = function(event) {
                var res = event.target.result,
                    addRequest;

                if (res) {
                    _order = res.key + 1;
                }
                row = {order: _order, description: _description, url: _url};
                addRequest = store.add(row);
                addRequest.onsuccess = function(event) {
                    row.id = event.target.result;
                    console.log('record saved with order ' + _order + ' and key ' + row.id);
                    _this.UPDATE_VIEW.appendRow(row);
                }
            }
            db.close();
        };
    }
});
