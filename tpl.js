;(function(w, factory) {

  const OPTIONS = {
    // components HTMLElement placeholder
    el: 'tpl',
    // folder with components
    root: 'components',
    // extensions of component files
    ext: {
      view: '.html',
      data: '.json',
      styles: '.css',
      script: '.js'
    },
    regex: {
      namespace: /(?:<!--\s*)(?:namespace:)([\w.]+)(?:\s*-->)/g,
      placeholder: /(?:{{)(.+)(?:}})/g,
      tags: /(<(?:.|\n)*?>)/g,
      empty: /(<(?:.|\n)*>)/g
    },
    notation: '.',
    binder: {
      prefix: 'data-tpl-',
      unique: 'data-tpl-key'
    }
  };

  // set allowed data-binding attributes
  OPTIONS.allowed = [
    'Id:id',
    'Class:className',
    'Text:innerHTML',
    'Value:value',
    'Checked:checked'
  ].map((attr) => attr.split(':')).reduce((obj, attr) =>
      (obj[`tpl${attr[0]}`] = {
        name: attr[1],
        binder: OPTIONS.binder.prefix + attr[0].toLowerCase()
      }) ? obj : {},
    {});

  (typeof module === 'object' && typeof module.exports === 'object')
    ? module.exports = factory(w, OPTIONS)
    : factory(w, OPTIONS);

}(typeof window !== 'undefined' ? window : this, function(window, opt) {

  'use strict';

  // container for elements with data-binding attributes
  var map = [];

  /**
   * Data storage
   */
  var storage = (function() {
    var data = {};
    return {
      set: (key, value) => {
        if (typeof key === 'undefined') return;
        return !!~key.indexOf(opt.notation) // e.g. 'counter.btn.submit'
          ? tpl.fn.parse(key.split(opt.notation), data, value)
          : data[key] = value;
      },
      get: (key) => {
        if (typeof key === 'undefined') return;
        return !!~key.indexOf(opt.notation)
          ? tpl.fn.parse(key.split(opt.notation), data)
          : data[key];
      },
      print: () => data
    }
  }());

  /**
   * Handler for getView function
   * @param  {string} data  Template
   * @return {Function}     Doc parser
   * @see tpl.fn.getView
   */
  var viewHandler = function(data) {
    return tpl.fn.parseDoc(data, (nodes, data) => {
      // get namespace passed by template
      var namespace = '';
      if (namespace = opt.regex.namespace.exec(data))
        namespace = namespace[1] + '.';
      // loop through nodes
      [].forEach.call(nodes, (el) => {
        var items = [];
        // search for allowed attributes inside each node
        tpl.fn.walk(opt.allowed, (key) => {
          var attr = opt.allowed[key],
              string = el.getAttribute(attr.name) || el[attr.name];
          // remove html tags from attribute
          string = tpl.fn.stripTags(string, true);
          if (!string) return;
          var match = null;
          // search for placeholders inside current node
          while (match = opt.regex.placeholder.exec(string)) {
            var item = namespace + match[1].trim(),
                storageItem = tpl.get(item).value();
            // set new storage item if it doesn't exist
            if (typeof storageItem === 'undefined')
              tpl.fn.parse(item.split(opt.notation), tpl.print());
            // update node attribute:
            // set attribute from storage or
            // remove attribute if it doesn't exist in storage
            (el.getAttribute(attr.name) === null)
              // set/remove for className, innerHTML etc.
              ? el[attr.name] = storageItem || ''
              // set/remove for value, checked etc.
              : (storageItem)
                ? el.setAttribute(attr.name, storageItem)
                : el.removeAttribute(attr.name);
            // set unique id
            if (el.getAttribute(opt.binder.unique) === null)
              el.setAttribute(opt.binder.unique, map.length);
            // set binder for attribute
            el.setAttribute(attr.binder, item);
            items.push(item);
          }
        });
        map.push(items);
        items = [];
      });
    });
  };

  var tpl = {};

  tpl.fn = {};

  /**
   * Pub/sub
   */
  tpl.fn.pubsub = (function() {
    var topics = {};
    return {
      subscribe: function(topic, listener) {
        if (!topics[topic]) topics[topic] = [];
        topics[topic].push(listener);
      },
      publish: function(topic) {
        if (!topics[topic] || !topics[topic].length) return;
        topics[topic].forEach((listener) => listener.apply(this, arguments));
      }
    };
  }());

  /**
   * XMLHttpRequest
   * @param  {string}   url
   */
  tpl.fn.request = function(url) {
    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.onreadystatechange = function() {
        if (this.readyState !== 4) return;
        (this.status >= 200 && this.status < 400)
          ? resolve(this.responseText)
          : reject(this.statusText, this.status);
      };
      try {
        xhr.send();
      } catch (e) {
        tpl.fn.log(e);
      }
      xhr = null;
    });
  }

  /**
   * For..in wrapper with some options
   * @param  {object}   obj   Target object
   * @param  {Function} fn    Handler called for each property
   * @param  {boolean}  check If true check for hasOwnProperty
   */
  tpl.fn.walk = function(obj, fn, check) {
    for (var prop in obj) {
      if (check && obj.hasOwnProperty(prop)) continue;
      if (typeof fn === 'function') fn(prop);
    }
  };

  /**
   * Parse array elements to the object-tree structure
   * @param  {array} items    Parsed array
   * @param  {object} output  Target object
   * @param  {*} tail         May be value or function to set it
   * @return {*}              Last item
   */
  tpl.fn.parse = function(items, output, tail) {
    var ref = output || {},
        last = items.length - 1;
    for (var i = 0; i < last; i ++) {
      if (!ref[items[i]]) ref[items[i]] = {};
      ref = ref[items[i]];
    }
    switch (typeof tail) {
      case 'function':
        ref[items[last]] = tail(ref[items[last]]);
        break;
      case 'undefined':
        break;
      default:
        ref[items[last]] = tail;
    }
    return ref[items[last]];
  };

  /**
   * Merge two objects recursively
   * values in the first object will be replaced by the second
   * @param  {object} target  Target object
   * @param  {object} data    Merging data
   */
  tpl.fn.merge = function(target, data) {
    var fn = (target, data) => {
      var ref = target;
      tpl.fn.walk(data, (key) => {
        try {
          (data[key].constructor === Object)
            ? ref[key] = fn(ref[key], data[key])
            : ref[key] = data[key];
        } catch(e) {
          ref[key] = data[key];
        }
      });
    };
    fn(target, data);
  };

  /**
   * Log
   */
  tpl.fn.log = function() {
    tpl.log.push(arguments);
    if (window.console) console.log([].slice.call(arguments));
  };

  /**
   * Strip html tags from string
   * @param  {string} string  String contains html tags
   * @param  {boolean} empty  If true content of tags also will be stripped
   * @return {string}         String without html tags
   */
  tpl.fn.stripTags = function(string, empty) {
    if (!string || typeof string !== 'string') return;
    var regex = (empty) ? opt.regex.empty : opt.regex.tags;
    return string.replace(regex, '');
  };

  /**
   * HTML document parser
   * @param  {string}   data  Document
   * @param  {Function} fn    Handler
   * @return {HTMLDocument}   Handled document
   */
  tpl.fn.parseDoc = function(data, fn) {
    var doc = new DOMParser().parseFromString(data, 'text/html');
    try {
      // get all document nodes
      var nodes = doc.body.getElementsByTagName('*');
    } catch(e) {
      tpl.fn.log('Doc is empty at: ' + location.href);
    }
    if (typeof nodes === 'undefined') return '';
    // call handler for nodes
    if (typeof fn === 'function') fn.call(this, nodes, data);
    return doc;
  };

  /**
   * Get template
   * @param  {string}   data  Template
   * @param  {Function} fn    Handler
   * @return {string}         Handled template
   */
  tpl.fn.getView = function(data, fn) {
    if (typeof fn === 'function') data = fn(data);
    return (data.body) ? data.body.innerHTML : data;
  };

  /**
   * Get stylesheet
   * @param  {string} path  Path to the stylesheet
   * @return {HTMLElement}  Link tag
   */
  tpl.fn.getStyles = function(path) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = path;
    return link;
  };

  /**
   * Get script
   * @param  {string} path  Path to the script
   * @return {HTMLElement}  Script tag
   */
  tpl.fn.getScript = function(path) {
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = path;
    return script;
  };

  /**
   * Log
   * @type {Array}
   * @see tpl.fn.log
   */
  tpl.log = [];

  /**
   * Object contains current values
   * @type {Object}
   */
  tpl.current = {
    // selected key
    'key': null,
    // value getted from storage
    'value': null,
    // HTMLElement
    'el': null
  };

  /**
   * Set value of the storage key
   * @param  {string} key     Target key
   * @param  {*}      value   New value or the function to set it
   * @return {*}              New value
   * @see storage
   */
  tpl.set = function(key, value) {
    value = storage.set(key, value);
    tpl.fn.pubsub.publish('model:changed', key, value);
    return value;
  };

  /**
   * Set current values:
   * set key
   * set value from the storage value by key
   * set element by id selector
   * @param  {string} key   Target key
   * @return {object}       tpl object
   * @see storage
   */
  tpl.get = function(key) {
    this.current.key = key;
    this.current.value = storage.get(key);
    this.current.el = document.getElementById(this.current.value) || null;
    return this;
  };

  /**
   * Get current value
   * @return {*}
   */
  tpl.value = () => tpl.current.value;

  /**
   * Filter and set current element by selector
   * @param  {string} sel   CSS selector
   * @return {object}       tpl object
   */
  tpl.find = function(sel) {
    try {
      this.current.el = this.current.el.querySelector(sel);
    } catch(e) {
      tpl.fn.log(e.message);
    }
    return this;
  };

  /**
   * Add event listener to the current element
   * @param  {string}   event click/change etc
   * @param  {Function} fn    Listener function
   * @return {object}         tpl object
   */
  tpl.on = function(event, fn) {
    try {
      this.current.el.addEventListener(event, fn);
    } catch(e) {
      tpl.fn.log(e.message);
    }
    return this;
  };

  /**
   * Get all of the storage data
   * @return {object} Storage data
   * @see storage
   */
  tpl.print = () => storage.print();

  /**
   * Get and render component
   * @param  {HTMLElement} item   Root element
   */
  tpl.render = function(item) {
    if (!(item instanceof HTMLElement)) return;
    if (item.nodeName.toLowerCase() !== opt.el) return;
    // get path to component
    var path = `${ opt.root }/${ item.id }/index`;
    // get component
    Promise.resolve(path + opt.ext.data)
      .then(tpl.fn.request)
      // load data from json to storage
      .then(response => {
        if (!response) return;
        var data = JSON.parse(response);
        tpl.fn.walk(data, (key) => {
          // merge json data with storage
          tpl.fn.merge(tpl.print(), data[key]);
        });
        return tpl.fn.request(path + opt.ext.view);
      })
      // load template
      .then(response => {
        if (!response) return;
        // insert template to the root element
        item.innerHTML = tpl.fn.getView(response, viewHandler);
        // insert component stylesheet
        item.insertBefore(
          tpl.fn.getStyles(path + opt.ext.styles), item.firstChild
        );
        // insert component script
        item.appendChild(tpl.fn.getScript(path + opt.ext.script));
      })
      .catch(error => tpl.fn.log(''));
  };

  // render all components on the page
  [].forEach.call(document.getElementsByTagName(opt.el), tpl.render);

  // subscribe on setting new storage key
  tpl.fn.pubsub.subscribe('model:changed', (event, key, value) => {
    // search in map for all HTMLElements with changed key
    [].filter.call(map, (item, index) => {
      if (!~item.indexOf(key)) return;
      // get changed HTMLElement by unique key
      var el = document.querySelector(`[${ opt.binder.unique }="${ index }"]`);
      // search for changed key in HTMLElement data-binding attributes
      tpl.fn.walk(el.dataset, (attr) => {
        // set/remove html attributes depending on the value
        if (el.dataset[attr] === key) (value)
          ? el[opt.allowed[attr].name] = value
          : el.removeAttribute(opt.allowed[attr].name);
      });
    });
  });

  // subscribe on form element changes
  tpl.fn.pubsub.subscribe('view:changed', function(event, key, value) {
    tpl.set(key, value);
  });

  // set up publishing on view changes
  window.document.addEventListener('change', (event) => {
    if (!event.target.dataset) return;
    var data = {},
        el = event.target;
    // prepare data depending on the type of the form element
    switch (el.type) {
      case 'checkbox':
        data.key = el.dataset.tplChecked;
        data.value = el.checked;
        break;
      case 'text':
        data.key = el.dataset.tplValue;
        data.value = el.value;
        break;
      default:
        data.key = el.dataset.tplValue;
        data.value = el.value;
    }
    // publish view changes
    tpl.fn.pubsub.publish('view:changed', data.key, data.value);
  });

  window.tpl = tpl;

  return tpl;

}));
