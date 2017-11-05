var multiTab = multiTab || {};

multiTab.UpdateUrlView = Backbone.View.extend({
    events: {
        "change input[name=to-delete]": "handleDeleteCheckChange",
        "click #delete-selected-button": "handleDeleteSelected"
    },

    initialize: function(options) {
        var _this = this;

        _.bindAll(_this,
            'render',
            'initializeConstants',
            'appendDbData',
            'showEmptyDbWarning',
            'handleDeleteCheckChange',
            'handleDeleteSelected',
            'deleteFromDb',
            'enableSorting',
            'saveSort'
        );

        _this.initializeConstants(options);
        _this.render();
    },

    render: function() {
        var _this = this;

        _this.appendDbData();
        _this.enableSorting();
    },

    initializeConstants: function(options) {
        var _this = this;

        _this.TEMPLATE_SELECTOR = '#url-record-template';
        _this._COMPILED_TEMPLATE = _.template($(_this.TEMPLATE_SELECTOR).html());
        _this.TABLE_BODY_SELECTOR = '#url-tbody';
        _this.LOCAL_DB = "multi_tab";
        _this.DB_VERSION = options.dbVersion;
        _this.URL_TABLE = "tbl_url";
        _this.ORDER_INDEX = "order";
        _this.SHOW_IF_EMPTY_SELECTOR = '.show-if-empty';
        _this.HIDE_IF_EMPTY_SELECTOR = '.hide-if-empty';
        _this.CHECKED_DELETE_CHECKBOXES_SELECTOR = 'input[name=to-delete]:checked';
        _this.DELETE_SELECTED_BUTTON_SELECTOR = '#delete-selected-button';
    },

    appendDbData: function() {
        var _this = this,
            request = indexedDB.open(_this.LOCAL_DB, _this.DB_VERSION);

        request.onerror = function(event) {
            $(_this.SHOW_IF_EMPTY_SELECTOR).slideDown('fast');
            console.log("Error getting data to append");
        };

        request.onupgradeneeded = function(event) {
            var db = event.target.result,
                store;

            store = db.createObjectStore(_this.URL_TABLE, {autoIncrement: true});
            store.createIndex(_this.ORDER_INDEX, "order", { unique: true });
            db.close();
        };

        request.onsuccess = function(event) {
            var rows = [],
                db = event.target.result,
                tx = db.transaction([_this.URL_TABLE], "readonly"),
                os = tx.objectStore(_this.URL_TABLE),
                index = os.index(_this.ORDER_INDEX),
                cursor = index.openCursor(),
                $tbodyEl;

            cursor.onsuccess = function(event) {
                var res = event.target.result;

                if (res) {
                    rows.push({
                        id: res.primaryKey,
                        order: res.value.order,
                        description: res.value.description,
                        url: res.value.url
                    });
                    res.continue();
                }
                else {
                    if (rows.length === 0) {
                        $(_this.SHOW_IF_EMPTY_SELECTOR).slideDown('fast');
                    }
                    else {
                        $tbodyEl = _this.$el.find(_this.TABLE_BODY_SELECTOR);
                        //_.sortBy(rows, function(row) { return row.order; });
                        for (var i = 0; i < rows.length; i++) {
                            $tbodyEl.append($(_this._COMPILED_TEMPLATE(rows[i])));
                        }
                        $(_this.HIDE_IF_EMPTY_SELECTOR).slideDown('fast');
                    }
                }
            };
            db.close();
        };
    },

    showEmptyDbWarning: function() {
        var _this = this;

        $(_this.SHOW_IF_EMPTY_SELECTOR).slideDown('fast');
    },

    appendRow: function(row) {
        var _this = this,
            $tbodyEl = _this.$el.find(_this.TABLE_BODY_SELECTOR),
            $rowEl = $(_this._COMPILED_TEMPLATE(row)).hide(),
            $hideIfEmptyElements = _this.$el.find(_this.HIDE_IF_EMPTY_SELECTOR);
        
        if (!$hideIfEmptyElements.is(':visible')) {
            _this.$el.find(_this.SHOW_IF_EMPTY_SELECTOR).hide('fast');
            $hideIfEmptyElements.show('fast');
            $tbodyEl.append($rowEl.show());
            $tbodyEl.slideDown('fast');
        }
        else {
            $rowEl.appendTo($tbodyEl).slideDown('fast');
        }
    },

    handleDeleteCheckChange: function(event) {
        var _this = this;
        
        if (_this.$el.find(_this.CHECKED_DELETE_CHECKBOXES_SELECTOR).length > 0) {
            _this.$el.find(_this.DELETE_SELECTED_BUTTON_SELECTOR).removeAttr('disabled');
        }
        else {
            _this.$el.find(_this.DELETE_SELECTED_BUTTON_SELECTOR).attr('disabled', 'true');
        }
    },

    handleDeleteSelected: function(event) {
        var _this = this,
            $rows = _this.$el.find(_this.CHECKED_DELETE_CHECKBOXES_SELECTOR).closest('tr'),
            keysToDelete = [];

        $rows.each(function() {
            keysToDelete.push(parseInt($(this).attr('data-id'), 10));
        });
        _this.deleteFromDb(keysToDelete, function() {
            $rows.remove();
            event.target.blur();
            _this.$el.find(_this.DELETE_SELECTED_BUTTON_SELECTOR).attr('disabled', 'true');
            if (_this.$el.find(_this.TABLE_BODY_SELECTOR).find('tr').length === 0) {
                _this.$el.find(_this.HIDE_IF_EMPTY_SELECTOR).slideUp('fast', function() {
                    _this.$el.find(_this.SHOW_IF_EMPTY_SELECTOR).slideDown('fast');
                });
            }
        });
    },

    deleteFromDb: function(keys, callback) {
        var _this = this,
            request = indexedDB.open(_this.LOCAL_DB, _this.DB_VERSION);

        request.onsuccess = function(event) {
            var db = event.target.result,
                tx = db.transaction([_this.URL_TABLE], "readwrite"),
                store = tx.objectStore(_this.URL_TABLE),
                recursiveDelete;

            recursiveDelete = function(_index) {
                var deleteRequest;

                // base case
                if (_index >= keys.length) {
                    callback();
                    return;
                }
                deleteRequest = store.delete(keys[_index]);
                deleteRequest.onsuccess = function(event) {
                    recursiveDelete(_index + 1);
                }
            }
            recursiveDelete(0);
        }
    },

    enableSorting: function() {
        var _this = this; 

        $(function() {
            // Cf. http://api.jqueryui.com/sortable/#event-stop
            // http://jsfiddle.net/pmw57/tzYbU/205/
            _this.$el.find(_this.TABLE_BODY_SELECTOR).sortable({
                stop: _this.saveSort
            });
        });
    },

    /**
     * Algorithm:
     * *****************************************************************
     * This works for both forward and backward moves:
     * 1) If the moved element is at the end of the table,
     * set its value to max + 1 in both DOM and db, and exit.
     * Otherwise:
     * 2) Set the orderVal of the moved element to max + 2 in
     * both db and DOM (keep these in sync)
     * 3) Get a descending cursor with range (upper bound) restricted to max
     * (before setting moved element to max + 2)
     * 4) As long as the DOM element data-order attribute === db orderVal,
     * add 1 to each.
     * 5) Once data-order attribute in DOM !== db orderVal, we have reached
     * the moved element. Set that value to predecessor + 1 or to 0
     * if it has no predecessor (both in DOM and in db).
     * Using updates rather than puts, the worst that can happen on
     * failed db request is that the order is strange.
     *
     * Bad but tempting algorithm:
     * Starting with last element in table and working backwards,
     * add 1 to each order value until you reach the item that has
     * been moved.
     * For the moved item, find the value of its predecessor and add 1.
     * If the moved item has no predecessor (moved to the beginning),
     * set its index to 0.
     * This doesn't work: Consider 0, 1, 2, 3 where we move 3 to top.
     * Then 2 becomes 3, temporarily violating uniqueness.
     */
    saveSort: function(event, ui) {
        // disable further sorting until event has been processed
        this.$el.find(this.TABLE_BODY_SELECTOR).sortable("option", "disabled", true);

        var _this = this,
            $movedItem = $(ui.item.context),
            $prevSibling = $movedItem.prev(),
            $tblBody = _this.$el.find(_this.TABLE_BODY_SELECTOR),
            $tblRows = $tblBody.children('tr'),
            movedOrderVal = parseInt($movedItem.attr('data-order'), 10),
            movedItemId = parseInt($movedItem.attr('data-id'), 10),
            maxOrderVal = parseInt($tblRows.last().attr('data-order'), 10),
            openDbRequest = indexedDB.open(_this.LOCAL_DB, indexedDbVersion);

        openDbRequest.onsuccess = function(e1) {
            var db = e1.target.result,
                tx = db.transaction([_this.URL_TABLE], "readwrite"),
                os = tx.objectStore(_this.URL_TABLE),
                movedElementCursor;

            if (movedOrderVal === maxOrderVal) {
                // row was moved to end, so previous row has max value
                maxOrderVal = parseInt($prevSibling.attr('data-order'), 10);
            }
            else if (movedOrderVal > maxOrderVal) { 
                // last row was the row moved
                maxOrderVal = movedOrderVal; 
            }
            movedElementCursor = os.openCursor(IDBKeyRange.only(movedItemId));

            movedElementCursor.onsuccess = function(e2) {
                var cursorResult = e2.target.result,
                    recursiveUpdate;

                // item was moved to end, so just add 1 to its order field
                if ($movedItem.next().length === 0) {
                    $movedItem.attr('data-order', maxOrderVal + 1);
                    cursorResult.value.order = maxOrderVal + 1;
                    cursorResult.update(cursorResult.value);
                    return;
                }

                // item was moved somewhere else
                // first set its order field to max + 2 (leaving room for increase of max item)
                $movedItem.attr('data-order', maxOrderVal + 2);
                cursorResult.value.order = maxOrderVal + 2;
                cursorResult.update(cursorResult.value);

                recursiveUpdate = function(index) {
                    var rowId = parseInt($($tblRows[index]).attr('data-id'), 10),
                        cursor = os.openCursor(IDBKeyRange.only(rowId)),
                        newOrderVal;

                    cursor.onsuccess = function(e3) {
                        var res = e3.target.result;

                        // base case
                        if (rowId === movedItemId) {
                            if ($prevSibling.length === 0) {
                                // no previous sibling means element was moved to beginning of list, so set to 0
                                newOrderVal = 0;
                            }
                            else {
                                newOrderVal = parseInt($prevSibling.attr('data-order'), 10) + 1;
                            }
                            $movedItem.attr('data-order', newOrderVal);
                            res.value.order = newOrderVal;
                            res.update(res.value);
                            return;
                        }

                        newOrderVal = parseInt($($tblRows[index]).attr('data-order'), 10) + 1;
                        $($tblRows[index]).attr('data-order', newOrderVal);
                        res.value.order = newOrderVal;
                        res.update(res.value);
                        recursiveUpdate(index - 1);
                    }
                };
                recursiveUpdate($tblRows.length - 1);
            };
            db.close();
            // enable sorting after updating db
            $('#url-tbody').sortable("option", "disabled", false);
        };
    }
});
