;(function(w, factory) {

  var options = {
    el: 'tpl',
    ext: '.html',
    regex: /(?:{{)(.+)(?:}})/g,
    notation: '.',
    binder: 'data-tpl-'
  };

  options.allowed = {
    tplClass: {
      name: 'className',
      binder: options.binder + 'class'
    },
    tplText: {
      name: 'textContent',
      binder: options.binder + 'text'
    },
    tplValue: {
      name: 'value',
      binder: options.binder + 'value'
    }
  };

  (typeof module === 'object' && typeof module.exports === 'object')
    ? module.exports = factory(w, options)
    : factory(w, options);

}(typeof window !== "undefined" ? window : this, function(window, opt) {

  var pubsub = {
    topics: {},
    subscribe: function(topic, listener) {
      if (!this.topics[topic]) this.topics[topic] = [];
      this.topics[topic].push(listener);
    },
    publish: function(topic) {
      if (!this.topics[topic] || !this.topics[topic].length) return;
      var args = arguments;
      this.topics[topic].forEach(function(listener) {
        listener.apply(this, args);
      });
    }
  };

  var request = function(url, fn, json) {
    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.onreadystatechange = function() {
      if (this.readyState !== 4) return;
      (this.status >= 200 && this.status < 400)
        ? (json) ? responseText : fn(this.responseXML)
        : console.log(this);
    };
    request.send();
    if (!json) request.contentType = 'document';
    request = null;
  };

  var walk = function(obj, fn, check) {
    for (var prop in obj) {
      if (check && obj.hasOwnProperty(prop)) continue;
      if (typeof fn === 'function') fn(prop);
    }
  };

  document.addEventListener('change', function(event) {
    pubsub.publish(
      'view:changed', event.target.dataset.tplValue, event.target.value
    );
  });

  pubsub.subscribe('model:changed', function(event, key, value) {
    var items = map.print();
    [].filter.call(items, function(item, index) {
      if (!~item.indexOf(key)) return;
      var el = document.querySelector('[' + opt.binder + 'id="' + index + '"]');
      walk(el.dataset, function(attr) {
        if (el.dataset[attr] === key) el[opt.allowed[attr].name] = value;
      });
    });
  });

  var parse = function(items, output, value) {
    var ref = output || {},
        last = items.length - 1;
    for (var i = 0; i < last; i ++) {
      if (!ref[items[i]]) ref[items[i]] = {};
      ref = ref[items[i]];
    }
    ref[items[last]] = (value) ? value : ref[items[last]] || null;
    return ref[items[last]];
  };

  var map = (function() {
    var data = [];
    var map = {
      add: function(item) {
        data.push(item);
      },
      print: function() {
        return data;
      }
    }
    return map;
  }());

  var tpl = (function() {
    var data = {};
    var tpl = {
      set: function(key, value) {
        !!~key.indexOf(opt.notation)
          ? parse(key.split(opt.notation), data, value)
          : data[key] = value;
        pubsub.publish('model:changed', key, value);
      },
      get: function(key) {
        return !!~key.indexOf(opt.notation)
          ? parse(key.split(opt.notation), data)
          : data[key];
      },
      print: function() {
        return data;
      }
    };
    pubsub.subscribe('view:changed', function(event, key, value) {
      tpl.set(key, value);
    });
    return tpl;
  }());

  [].forEach.call(document.getElementsByTagName(opt.el), function(item) {
    if (item.nodeName.toLowerCase() !== opt.el) return false;
    request(item.id + opt.ext, function(xml) {
      var nodes = xml.getElementsByTagName('*');
      for (var i = 0; i < nodes.length; i++) {
        var items = [],
            currentId = map.print().length;
        walk(opt.allowed, function(attr) {
          var match = null,
              where = nodes[i][opt.allowed[attr].name] ||
                      nodes[i].getAttribute(opt.allowed[attr].name);
          if (match = opt.regex.exec(where)) {
            var item = match[1].trim(),
                tplItem = tpl.get(item);
            if (!tplItem) parse(item.split(opt.notation), tpl.print());
            if (nodes[i].getAttribute(opt.binder + 'id') === null)
              nodes[i].setAttribute(opt.binder + 'id', currentId);
            nodes[i].setAttribute(opt.allowed[attr].binder, item);
            (nodes[i][opt.allowed[attr].name])
              ? nodes[i][opt.allowed[attr].name] = tplItem || " "
              : nodes[i].setAttribute(opt.allowed[attr].name, tplItem || " ");
            items.push(item);
          }
        });
        map.add(items);
        items = [];
      }
      item.outerHTML = new XMLSerializer().serializeToString(xml);
    });
  });

  window.tpl = tpl;

  return tpl;

}));
