;(function(w, factory) {

  /**
   * General options
   * @type {Object}
   */
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
      // get namespace from view
      // e.g. <!-- namespace:someVar --> => someVar
      namespace: /(?:<!--\s*)(?:namespace:)([\w.]+)(?:\s*-->)/g,
      // get variable from view
      // e.g. {{ someVar }} => someVar
      placeholder: /(?:{{)(.+)(?:}})/g,
      // cut html tags
      // e.g. This is <span>the text</span> => This is the text
      tags: /(<(?:.|\n)*?>)/g,
      // cut html tags and inner text
      // e.g. Hello<span>, world</span>! => Hello!
      empty: /(<(?:.|\n)*>)/g
    },
    notation: '.',
    binder: {
      prefix: 'data-tpl-',
      unique: 'data-tpl-key'
    }
  };

  // set allowed data-binding attributes
  // [data attribute postfix]:[element attribute]
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
    {}); // Id:id => tplId: { name: "id", binder: "data-tpl-id" }

  (typeof module === 'object' && typeof module.exports === 'object')
    ? module.exports = factory(w, OPTIONS)
    : factory(w, OPTIONS);

}(typeof window !== 'undefined' ? window : this, function(window, opt) {

  'use strict';

  // container for elements with data-binding attributes
  let map = [];

  /**
   * Data storage
   */
  let storage = (function() {
    let data = {};
    return {
      set(key, value) {
        if (typeof key === 'undefined') return;
        return !!~key.indexOf(opt.notation) // e.g. 'counter.btn.submit'
          ? tpl.fn.parse(key.split(opt.notation), data, value)
          : data[key] = value;
      },
      get(key) {
        if (typeof key === 'undefined') return;
        return !!~key.indexOf(opt.notation)
          ? tpl.fn.parse(key.split(opt.notation), data)
          : data[key];
      },
      print() {
        return data;
      }
    }
  }());

  /**
   * Handler for getView function
   * @param  {string} data  Template
   * @return {Function}     Doc parser
   * @see tpl.fn.getView
   */
  let viewHandler = function(data) {
    return tpl.fn.parseDoc(data, (nodes, data) => {
      // get namespace passed by template
      let namespace = '';
      if (namespace = opt.regex.namespace.exec(data))
        namespace = namespace[1] + '.';
      // loop through nodes
      [].forEach.call(nodes, (el) => {
        let items = [];
        // search for allowed attributes inside each node
        tpl.fn.walk(opt.allowed, (key) => {
          let attr = opt.allowed[key],
              string = el.getAttribute(attr.name) || el[attr.name];
          // remove html tags from attribute
          string = tpl.fn.stripTags(string, true);
          if (!string) return;
          let match = null;
          // search for placeholders inside current node
          while (match = opt.regex.placeholder.exec(string)) {
            let item = namespace + match[1].trim(),
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

  let tpl = {};

  tpl.fn = {};

  /**
   * Pub/sub
   */
  tpl.fn.pubsub = (function() {
    let topics = {};
    return {
      subscribe(topic, listener) {
        if (!topics[topic]) topics[topic] = [];
        topics[topic].push(listener);
      },
      publish(topic) {
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
      let xhr = new XMLHttpRequest();
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
    for (let prop in obj) {
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
    let ref = output || {},
        last = items.length - 1;
    for (let i = 0; i < last; i ++) {
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
    let fn = (target, data) => {
      let ref = target;
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
    let regex = (empty) ? opt.regex.empty : opt.regex.tags;
    return string.replace(regex, '');
  };

  /**
   * HTML document parser
   * @param  {string}   data  Document
   * @param  {Function} fn    Handler
   * @return {HTMLDocument}   Handled document
   */
  tpl.fn.parseDoc = function(data, fn) {
    let doc = new DOMParser().parseFromString(data, 'text/html');
    let nodes = null;
    try {
      // get all document nodes
      nodes = doc.body.getElementsByTagName('*');
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
    let link = document.createElement('link');
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
    let script = document.createElement('script');
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
    key: null,
    // value getted from storage
    value: null,
    // HTMLElement
    el: null
  };

  /**
   * Set value of the storage key
   * @param  {string} key     Target key
   * @param  {*}      value   New value or the function to set it
   * @return {*}              New value
   * @see storage
   */
  tpl.set = function(key, value) {
    // define short helper
    let publish = (k, v) => tpl.fn.pubsub.publish('model:changed', k, v);
    // set new storage value and update variable
    value = storage.set(key, value);
    // check if new value is object
    (value !== null && typeof value === 'object')
      // if true loop through the first level and publish each property
      ? tpl.fn.walk(value, (item) => publish(`${key}.${item}`, value[item]))
      // else just publish new value
      : publish(key, value);
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
    let path = `${ opt.root }/${ item.id }/index`;
    // get component
    Promise.resolve(path + opt.ext.data)
      .then(tpl.fn.request)
      // load data from json to storage
      .then(response => {
        if (!response) return;
        let data = JSON.parse(response);
        // merge json data with storage
        tpl.fn.walk(data, (key) => tpl.fn.merge(tpl.print(), data[key]));
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
      let el = document.querySelector(`[${ opt.binder.unique }="${ index }"]`);
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
    let data = {},
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
