/**
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

(function (root, factory) {
    "use strict";

    if (typeof define === 'function' && define.amd) {
        define([], factory);
    }
    else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    }
    else {
        root.picoModal = factory();
    }
}(this, function () {

    /**
     * A self-contained modal library
     */
    "use strict";

    /** Returns whether a value is a dom node */
    function isNode(value) {
        if ( typeof Node === "object" ) {
            return value instanceof Node;
        }
        else {
            return value &&
                typeof value === "object" &&
                typeof value.nodeType === "number";
        }
    }

    /** Returns whether a value is a string */
    function isString(value) {
        return typeof value === "string";
    }

    /**
     * Generates observable objects that can be watched and triggered
     */
    function observable() {
        var callbacks = [];
        return {
            watch: callbacks.push.bind(callbacks),
            trigger: function( context ) {

                var unprevented = true;
                var event = {
                    preventDefault: function preventDefault () {
                        unprevented = false;
                    }
                };

                for (var i = 0; i < callbacks.length; i++) {
                    callbacks[i](context, event);
                }

                return unprevented;
            }
        };
    }


    /** Whether an element is hidden */
    function isHidden ( elem ) {
        return elem.offsetWidth === 0 && elem.offsetHeight === 0;
    }

    /** Whether an element matches a selector */
    function matches ( elem, selector ) {
        return elem.msMatchesSelector ?
            elem.msMatchesSelector(selector) :
            elem.matches(selector);
    }

    /**
     * Returns whether an element is focusable
     * @see http://stackoverflow.com/questions/18261595
     */
    function canFocus( elem ) {
        if (
            isHidden(elem) ||
            matches(elem, ":disabled") ||
            elem.hasAttribute("contenteditable")
        ) {
            return false;
        }
        else {
            return elem.hasAttribute("tabindex") ||
                matches(
                    elem,
                    "input,select,textarea,button,a[href],area[href],iframe"
                );
        }
    }


    /**
     * A small interface for creating and managing a dom element
     */
    function Elem( elem ) {
        this.elem = elem;
    }

    /** Creates a new div */
    Elem.make = function ( parent, tag ) {
        if ( typeof parent === "string" ) {
            parent = document.querySelector(parent);
        }
        var elem = document.createElement(tag || 'div');
        (parent || document.body).appendChild(elem);
        return new Elem(elem);
    };

    Elem.prototype = {

        /** Creates a child of this node */
        child: function (tag) {
            return Elem.make(this.elem, tag);
        },

        /** Applies a set of styles to an element */
        stylize: function(styles) {
            styles = styles || {};

            if ( typeof styles.opacity !== "undefined" ) {
                styles.filter =
                    "alpha(opacity=" + (styles.opacity * 100) + ")";
            }

            for (var prop in styles) {
                if (styles.hasOwnProperty(prop)) {
                    this.elem.style[prop] = styles[prop];
                }
            }

            return this;
        },

        /** Adds a class name */
        clazz: function (clazz) {
            this.elem.className += " " + clazz;
            return this;
        },

        /** Sets the HTML */
        html: function (content) {
            if ( isNode(content) ) {
                this.elem.appendChild( content );
            }
            else {
                this.elem.innerHTML = content;
            }
            return this;
        },

        /** Adds a click handler to this element */
        onClick: function(callback) {
            this.elem.addEventListener('click', callback);
            return this;
        },

        /** Removes this element from the DOM */
        destroy: function() {
            this.elem.parentNode.removeChild(this.elem);
        },

        /** Hides this element */
        hide: function() {
            this.elem.style.display = "none";
        },

        /** Shows this element */
        show: function() {
            this.elem.style.display = "block";
        },

        /** Sets an attribute on this element */
        attr: function ( name, value ) {
            this.elem.setAttribute(name, value);
            return this;
        },

        /** Executes a callback on all the ancestors of an element */
        anyAncestor: function ( predicate ) {
            var elem = this.elem;
            while ( elem ) {
                if ( predicate( new Elem(elem) ) ) {
                    return true;
                }
                else {
                    elem = elem.parentNode;
                }
            }
            return false;
        },

        /** Returns the first descendant that can be focused */
        firstFocusable: function () {
            var items = this.elem.getElementsByTagName("*");
            for (var i = 0; i < items.length; i++) {
                if ( canFocus(items[i]) ) {
                    return items[i];
                }
            }
        },

        /** Returns the last descendant that can be focused */
        lastFocusable: function () {
            var items = this.elem.getElementsByTagName("*");
            for (var i = items.length; i--;) {
                if ( canFocus(items[i]) ) {
                    return items[i];
                }
            }
        },

        /** Sets focus to the first focusable element */
        moveFocus: function () {
            var focusable = this.firstFocusable();
            if ( focusable ) {
                focusable.focus();
            }
        },

        /** Whether this element is visible */
        isVisible: function () {
            return !isHidden(this.elem);
        }
    };


    /** Generates the grey-out effect */
    function buildOverlay( getOption, close ) {
        return Elem.make( getOption("parent") )
            .clazz("pico-overlay")
            .clazz( getOption("overlayClass", "") )
            .stylize({
                display: "none",
                position: "fixed",
                top: "0px",
                left: "0px",
                height: "100%",
                width: "100%",
                zIndex: 10000
            })
            .stylize(getOption('overlayStyles', {
                opacity: 0.5,
                background: "#000"
            }))
            .onClick(function () {
                if ( getOption('overlayClose', true) ) {
                    close();
                }
            });
    }

    /** Builds the content of a modal */
    function buildModal( getOption, close ) {
        var width = getOption('width', 'auto');
        if ( typeof width === "number" ) {
            width = "" + width + "px";
        }

        var elem = Elem.make( getOption("parent") )
            .clazz("pico-content")
            .clazz( getOption("modalClass", "") )
            .stylize({
                display: 'none',
                position: 'fixed',
                zIndex: 10001,
                left: "50%",
                top: "50px",
                width: width,
                '-ms-transform': 'translateX(-50%)',
                '-moz-transform': 'translateX(-50%)',
                '-webkit-transform': 'translateX(-50%)',
                '-o-transform': 'translateX(-50%)',
                'transform': 'translateX(-50%)'
            })
            .stylize(getOption('modalStyles', {
                backgroundColor: "white",
                padding: "20px",
                borderRadius: "5px"
            }))
            .html( getOption('content') )
            .attr("role", "dialog")
            .onClick(function (event) {
                var isCloseClick = new Elem(event.target)
                    .anyAncestor(function (elem) {
                        return /\bpico-close\b/.test(elem.elem.className);
                    });
                if ( isCloseClick ) {
                    close();
                }
            });

        return elem;
    }

    /** Builds the close button */
    function buildClose ( elem, getOption ) {
        if ( getOption('closeButton', true) ) {
            return elem.child('button')
                .html( getOption('closeHtml', "&#xD7;") )
                .clazz("pico-close")
                .clazz( getOption("closeClass", "") )
                .stylize( getOption('closeStyles', {
                    borderRadius: "2px",
                    border: 0,
                    padding: 0,
                    cursor: "pointer",
                    height: "15px",
                    width: "15px",
                    position: "absolute",
                    top: "5px",
                    right: "5px",
                    fontSize: "16px",
                    textAlign: "center",
                    lineHeight: "15px",
                    background: "#CCC"
                }) );
        }
    }

    /** Builds a method that calls a method and returns an element */
    function buildElemAccessor( builder ) {
        return function () {
            return builder().elem;
        };
    }


    // An observable that is triggered whenever the escape key is pressed
    var escapeKey = observable();

    // An observable that is triggered when the user hits the tab key
    var tabKey = observable();

    /** A global event handler to detect the escape key being pressed */
    document.documentElement.addEventListener(
        'keydown',
        function onKeyPress (event) {
            var keycode = event.which || event.keyCode;

            // If this is the escape key
            if ( keycode === 27 ) {
                escapeKey.trigger();
            }

            // If this is the tab key
            else if ( keycode === 9 ) {
                tabKey.trigger(event);
            }
        }
    );


    /**
     * Displays a modal
     */
    return function picoModal(options) {

        if ( isString(options) || isNode(options) ) {
            options = { content: options };
        }

        var afterCreateEvent = observable();
        var beforeShowEvent = observable();
        var afterShowEvent = observable();
        var beforeCloseEvent = observable();
        var afterCloseEvent = observable();

        /**
         * Returns a named option if it has been explicitly defined. Otherwise,
         * it returns the given default value
         */
        function getOption ( opt, defaultValue ) {
            var value = options[opt];
            if ( typeof value === "function" ) {
                value = value( defaultValue );
            }
            return value === undefined ? defaultValue : value;
        }

        /** Hides this modal */
        function forceClose () {
            shadowElem().hide();
            modalElem().hide();
            afterCloseEvent.trigger(iface);
        }

        /** Gracefully hides this modal */
        function close () {
            if ( beforeCloseEvent.trigger(iface) ) {
                forceClose();
            }
        }

        /** Wraps a method so it returns the modal interface */
        function returnIface ( callback ) {
            return function () {
                callback.apply(this, arguments);
                return iface;
            };
        }


        // The constructed dom nodes
        var built;

        /** Builds a method that calls a method and returns an element */
        function build ( name ) {
            if ( !built ) {
                var modal = buildModal(getOption, close);
                built = {
                    modal: modal,
                    overlay: buildOverlay(getOption, close),
                    close: buildClose(modal, getOption)
                };
                afterCreateEvent.trigger(iface);
            }
            return built[name];
        }

        var modalElem = build.bind(window, 'modal');
        var shadowElem = build.bind(window, 'overlay');
        var closeElem = build.bind(window, 'close');

        var iface = {

            /** Returns the wrapping modal element */
            modalElem: buildElemAccessor(modalElem),

            /** Returns the close button element */
            closeElem: buildElemAccessor(closeElem),

            /** Returns the overlay element */
            overlayElem: buildElemAccessor(shadowElem),

            /** Builds the dom without showing the modal */
            buildDom: returnIface(build),

            /** Returns whether this modal is currently being shown */
            isVisible: function () {
                return modalElem().isVisible();
            },

            /** Shows this modal */
            show: function () {
                if ( beforeShowEvent.trigger(iface) ) {
                    shadowElem().show();
                    closeElem();
                    modalElem().show();
                    afterShowEvent.trigger(iface);
                }
                return this;
            },

            /** Hides this modal */
            close: returnIface(close),

            /**
             * Force closes this modal. This will not call beforeClose
             * events and will just immediately hide the modal
             */
            forceClose: returnIface(forceClose),

            /** Destroys this modal */
            destroy: function () {
                modalElem = modalElem().destroy();
                shadowElem = shadowElem().destroy();
                closeElem = undefined;
            },

            /**
             * Updates the options for this modal. This will only let you
             * change options that are re-evaluted regularly, such as
             * `overlayClose`.
             */
            options: function ( opts ) {
                options = opts;
            },

            /** Executes after the DOM nodes are created */
            afterCreate: returnIface(afterCreateEvent.watch),

            /** Executes a callback before this modal is closed */
            beforeShow: returnIface(beforeShowEvent.watch),

            /** Executes a callback after this modal is shown */
            afterShow: returnIface(afterShowEvent.watch),

            /** Executes a callback before this modal is closed */
            beforeClose: returnIface(beforeCloseEvent.watch),

            /** Executes a callback after this modal is closed */
            afterClose: returnIface(afterCloseEvent.watch)
        };


        // Records the currently focused element so state can be returned
        // after the modal closes
        if ( getOption("focus", true) ) {
            var focused;

            iface.afterShow(function focusModal() {
                focused = document.activeElement;
                modalElem().moveFocus();
            });

            iface.afterClose(function returnFocus() {
                // Restore the previously focused element when the modal closes
                focused.focus();
                focused = null;
            });

            // Capture tab key presses and loop them within the modal
            tabKey.watch(function tabKeyPress (event) {
                if ( !modalElem().isVisible() ) {
                    return false;
                }

                var first = modalElem().firstFocusable();
                var last = modalElem().lastFocusable();

                var from = event.shiftKey ? first : last;
                if ( from === document.activeElement ) {
                    (event.shiftKey ? last : first).focus();
                    event.preventDefault();
                }
            });
        }


        // If a user presses the 'escape' key, close the modal.
        // TODO: This is defaulting to false right now, but should default to
        //       `true` in the future. However, that would require a major
        //       version bump as it would allow modals to be closed that
        //       previously may have been locked open.
        if ( getOption("escCloses", false) ) {
            escapeKey.watch(function escapeKeyPress () {
                if ( iface.isVisible() ) {
                    iface.close();
                }
            });
        }

        return iface;
    };

}));
