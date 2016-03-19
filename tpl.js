;(function(w, factory) {

  var options = {
    el: 'tpl',
    ext: {
      view: '.html',
      data: '.json'
    },
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
        !!~key.indexOf(opt.notation)
          ? tpl.fn.parse(key.split(opt.notation), data, value)
          : data[key] = value;
      },
      get: function(key) {
        return !!~key.indexOf(opt.notation)
          ? tpl.fn.parse(key.split(opt.notation), data)
          : data[key];
      },
      print: function() {
        return data;
      }
    }
  }());

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
          if (!tplItem) {
            tpl.fn.parse(item.split(opt.notation), tpl.print());
            nodes[i].removeAttribute(opt.allowed[attr].name);
          }
          else {
            (typeof nodes[i][opt.allowed[attr].name] !== 'undefined')
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
    return new XMLSerializer().serializeToString(response);
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

  tpl.fn.request = function(url, fn, json) {
    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.onreadystatechange = function() {
      if (this.readyState !== 4) return;
      (this.status >= 200 && this.status < 400)
        ? fn( (json) ? this.responseText : this.responseXML )
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
      tpl.fn.merge(tpl.print(), JSON.parse(response)[0]);
    }, true);
    tpl.fn.request(item.id + opt.ext.view, function(response) {
      item.outerHTML = getTemplate(response);
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
        break;
    }
    tpl.fn.pubsub.publish(
      'view:changed', data.key, data.value
    );
  });

  window.tpl = tpl;

  return tpl;

}));
