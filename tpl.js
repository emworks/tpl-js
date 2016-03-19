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

  var data = {};

  var map = [];

  var getTemplate = function(response) {
    var nodes = response.getElementsByTagName('*');
    for (var i = 0; i < nodes.length; i++) {
      var items = [];
      tpl.fn.walk(opt.allowed, function(attr) {
        var match = null,
            where = nodes[i][opt.allowed[attr].name] ||
                    nodes[i].getAttribute(opt.allowed[attr].name);
        if (match = opt.regex.exec(where)) {
          var item = match[1].trim(),
              tplItem = tpl.get(item);
          if (!tplItem) tpl.fn.parse(item.split(opt.notation), tpl.print());
          if (nodes[i].getAttribute(opt.binder + 'id') === null)
            nodes[i].setAttribute(opt.binder + 'id', map.length);
          nodes[i].setAttribute(opt.allowed[attr].binder, item);
          (nodes[i][opt.allowed[attr].name])
            ? nodes[i][opt.allowed[attr].name] = tplItem || " "
            : nodes[i].setAttribute(opt.allowed[attr].name, tplItem || " ");
          items.push(item);
        }
      });
      map.push(items);
      items = [];
    }
    return new XMLSerializer().serializeToString(response);
  };

  var tpl = {};

  tpl.fn = {};

  tpl.fn.request = function(url, fn, json) {
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
    ref[items[last]] = (value) ? value : ref[items[last]] || null;
    return ref[items[last]];
  };

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

  tpl.set = function(key, value) {
    !!~key.indexOf(opt.notation)
      ? tpl.fn.parse(key.split(opt.notation), data, value)
      : data[key] = value;
    tpl.fn.pubsub.publish('model:changed', key, value);
  };

  tpl.get = function(key) {
    return !!~key.indexOf(opt.notation)
      ? tpl.fn.parse(key.split(opt.notation), data)
      : data[key];
  };

  tpl.print = function() {
    return data;
  };

  [].forEach.call(document.getElementsByTagName(opt.el), function(item) {
    if (item.nodeName.toLowerCase() !== opt.el) return false;
    tpl.fn.request(item.id + opt.ext, function(response) {
      item.outerHTML = getTemplate(response);
    });
  });

  tpl.fn.pubsub.subscribe('model:changed', function(event, key, value) {
    [].filter.call(map, function(item, index) {
      if (!~item.indexOf(key)) return;
      var el = document.querySelector('[' + opt.binder + 'id="' + index + '"]');
      tpl.fn.walk(el.dataset, function(attr) {
        if (el.dataset[attr] === key) el[opt.allowed[attr].name] = value;
      });
    });
  });

  tpl.fn.pubsub.subscribe('view:changed', function(event, key, value) {
    tpl.set(key, value);
  });

  document.addEventListener('change', function(event) {
    tpl.fn.pubsub.publish(
      'view:changed', event.target.dataset.tplValue, event.target.value
    );
  });

  window.tpl = tpl;

  return tpl;

}));
