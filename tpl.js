;(function(w, factory) {

  var options = {
    el: 'tpl',
    ext: {
      view: '.html',
      data: '.json',
      styles: '.css',
      script: '.js'
    },
    regex: {
      placeholder: /(?:{{)(.+)(?:}})/g,
      tags: /(<(?:.|\n)*?>)/g,
      empty: /(<(?:.|\n)*>)/g
    },
    notation: '.',
    binder: 'data-tpl-'
  };

  options.allowed = {
    tplClass: {
      name: 'className',
      binder: options.binder + 'class'
    },
    tplText: {
      name: 'innerHTML',
      binder: options.binder + 'text'
    },
    tplValue: {
      name: 'value',
      binder: options.binder + 'value'
    },
    tplChecked: {
      name: 'checked',
      binder: options.binder + 'checked'
    }
  };

  (typeof module === 'object' && typeof module.exports === 'object')
    ? module.exports = factory(w, options)
    : factory(w, options);

}(typeof window !== 'undefined' ? window : this, function(window, opt) {

  var map = [];

  var storage = (function() {
    var data = {};
    return {
      set: function(key, value) {
        if (typeof key === 'undefined') return;
        !!~key.indexOf(opt.notation)
          ? tpl.fn.parse(key.split(opt.notation), data, value)
          : data[key] = value;
      },
      get: function(key) {
        if (typeof key === 'undefined') return;
        return !!~key.indexOf(opt.notation)
          ? tpl.fn.parse(key.split(opt.notation), data)
          : data[key];
      },
      print: function() {
        return data;
      }
    }
  }());

  var viewHandler = function(data) {
    var doc = new DOMParser().parseFromString(data, "text/html");
    try {
      var nodes = doc.body.getElementsByTagName('*');
    } catch(e) {
      tpl.fn.log('View is empty at: ' + location.href);
    }
    if (typeof nodes === 'undefined') return '';
    for (var i = 0; i < nodes.length; i++) {
      var items = [];
      // loop through allowed attributes
      tpl.fn.walk(opt.allowed, function(attr) {
        var match = null,
            string = tpl.fn.stripTags(
              nodes[i][opt.allowed[attr].name] ||
              nodes[i].getAttribute(opt.allowed[attr].name), true);
        if (match = opt.regex.placeholder.exec(string)) {
          console.log(string, match);
          var item = match[1].trim(),
              tplItem = tpl.get(item);
          if (!tplItem) {
            tpl.fn.parse(item.split(opt.notation), tpl.print());
            nodes[i].removeAttribute(opt.allowed[attr].name);
          }
          else {
            // console.log(tplItem, nodes[i][opt.allowed[attr].name]);
            (nodes[i][opt.allowed[attr].name])
              ? nodes[i][opt.allowed[attr].name] = tplItem
              : nodes[i].setAttribute(opt.allowed[attr].name, tplItem);
          }
          if (nodes[i].getAttribute(opt.binder + 'id') === null)
            nodes[i].setAttribute(opt.binder + 'id', map.length);
          nodes[i].setAttribute(opt.allowed[attr].binder, item);
          items.push(item);
        }
      });
      map.push(items);
      items = [];
    }
    return doc;
  };

  var tpl = {};

  tpl.fn = {};

  tpl.fn.pubsub = (function() {
    var topics = {};
    return {
      subscribe: function(topic, listener) {
        if (!topics[topic]) topics[topic] = [];
        topics[topic].push(listener);
      },
      publish: function(topic) {
        if (!topics[topic] || !topics[topic].length) return;
        var args = arguments;
        topics[topic].forEach(function(listener) {
          listener.apply(this, args);
        });
      }
    };
  }());

  tpl.fn.request = function(url, fn) {
    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.onreadystatechange = function() {
      if (this.readyState !== 4) return;
      (this.status >= 200 && this.status < 400)
        ? fn(this.responseText)
        : tpl.fn.log(this);
    };
    request.send();
    request = null;
  };

  tpl.fn.walk = function(obj, fn, check) {
    for (var prop in obj) {
      if (check && obj.hasOwnProperty(prop)) continue;
      if (typeof fn === 'function') fn(prop);
    }
  };

  tpl.fn.parse = function(items, output, value) {
    var ref = output || {},
        last = items.length - 1;
    for (var i = 0; i < last; i ++) {
      if (!ref[items[i]]) ref[items[i]] = {};
      ref = ref[items[i]];
    }
    ref[items[last]] = (typeof value !== 'undefined') ? value : ref[items[last]];
    return ref[items[last]];
  };

  tpl.fn.merge = function(target, data) {
    var fn = function(target, data) {
      var ref = target;
      tpl.fn.walk(data, function(key) {
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

  tpl.fn.log = function() {
    tpl.log.push(arguments);
    if (window.console) console.log([].slice.call(arguments));
  };

  tpl.fn.stripTags = function(string, empty) {
    if (!string || typeof string !== 'string') return;
    var regex = (empty) ? opt.regex.empty : opt.regex.tags;
    return string.replace(regex, "");
  };

  tpl.fn.getView = function(data, fn) {
    if (typeof fn === 'function') data = fn(data);
    return data.body.innerHTML;
  };

  tpl.fn.getStyles = function(path) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = path;
    return link;
  };

  tpl.fn.getScript = function(path) {
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = path;
    return script;
  };

  tpl.log = [];

  tpl.set = function(key, value) {
    storage.set(key, value);
    tpl.fn.pubsub.publish('model:changed', key, value);
  };

  tpl.get = function(key) {
    return storage.get(key);
  };

  tpl.print = function() {
    return storage.print();
  };

  tpl.render = function(item) {
    if (item.nodeName.toLowerCase() !== opt.el) return false;
    tpl.fn.request(item.id + opt.ext.data, function(response) {
      var data = JSON.parse(response);
      tpl.fn.walk(data, function(key) {
        tpl.fn.merge(tpl.print(), data[key]);
      });
    });
    tpl.fn.request(item.id + opt.ext.view, function(response) {
      item.innerHTML = tpl.fn.getView(response, viewHandler);
      item.insertBefore(
        tpl.fn.getStyles(item.id + opt.ext.styles), item.firstChild
      );
      item.appendChild(tpl.fn.getScript(item.id + opt.ext.script));
    });
  };

  [].forEach.call(document.getElementsByTagName(opt.el), tpl.render);

  tpl.fn.pubsub.subscribe('model:changed', function(event, key, value) {
    [].filter.call(map, function(item, index) {
      if (!~item.indexOf(key)) return;
      var el = document.querySelector('[' + opt.binder + 'id="' + index + '"]');
      tpl.fn.walk(el.dataset, function(attr) {
        if (el.dataset[attr] === key) (value)
          ? el[opt.allowed[attr].name] = value
          : el.removeAttribute(opt.allowed[attr].name);
      });
    });
  });

  tpl.fn.pubsub.subscribe('view:changed', function(event, key, value) {
    tpl.set(key, value);
  });

  window.document.addEventListener('change', function(event) {
    if (!event.target.dataset) return;
    var data = {};
    switch (event.target.type) {
      case 'checkbox':
        data.key = event.target.dataset.tplChecked;
        data.value = event.target.checked;
        break;
      case 'text':
        data.key = event.target.dataset.tplValue;
        data.value = event.target.value;
        break;
      default:
        data.key = event.target.dataset.tplValue;
        data.value = event.target.value;
    }
    tpl.fn.pubsub.publish(
      'view:changed', data.key, data.value
    );
  });

  window.tpl = tpl;

  return tpl;

}));
