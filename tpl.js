var el = 'TPL',
    ext = '.html',
    regex = /(?:{{)(.+)(?:}})/g,
    notation = '.',
    dataAttr = 'data-tpl-',
    map = [];

var allowed = {
  'tplClass': 'className',
  'tplText': 'textContent',
  'tplValue': 'value'
};

var allowedAttrs = {
  'className': dataAttr + 'class',
  'textContent': dataAttr + 'text',
  'value': dataAttr + 'value'
};

var walk = function(obj, fn, check) {
  for (var prop in obj) {
    if (check && obj.hasOwnProperty(prop)) continue;
    if (typeof fn === 'function') fn(prop);
  }
};

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

document.addEventListener('change', function(event) {
  pubsub.publish(
    'view:changed', event.target.dataset.tplValue, event.target.value
  );
});

pubsub.subscribe('model:changed', function(event, key, value) {
  [].filter.call(map, function(item, index) {
    if (!~item.indexOf(key)) return;
    var el = document.querySelector('[' + dataAttr + 'id="' + index + '"]');
    walk(el.dataset, function(attr) {
      if (el.dataset[attr] === key) el[allowed[attr]] = value;
    });
  });
});

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

var tpl = (function() {
  var data = {};
  var tpl = {
    set: function(key, value) {
      !!~key.indexOf(notation)
        ? parse(key.split(notation), data, value)
        : data[key] = value;
      pubsub.publish('model:changed', key, value);
    },
    get: function(key) {
      return !!~key.indexOf(notation)
        ? parse(key.split(notation), data)
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

[].forEach.call(document.getElementsByTagName(el.toLowerCase()), function(item) {
  if (item.nodeName !== el) return false;
  request(item.id + ext, function(xml) {
    var nodes = xml.getElementsByTagName('*');
    for (var i = 0; i < nodes.length; i++) {
      var toMap = [];
      walk(allowedAttrs, function(attr) {
        var match = null,
            where = nodes[i][attr] || nodes[i].getAttribute(attr);
        if (match = regex.exec(where)) {
          var string = match[1].trim();
          if (!tpl.get(string)) parse(string.split(notation), tpl.print());
          if (nodes[i].getAttribute(dataAttr + 'id') === null)
            nodes[i].setAttribute(dataAttr + 'id', map.length);
          nodes[i].setAttribute(allowedAttrs[attr], string);
          (nodes[i][attr])
            ? nodes[i][attr] = tpl.get(string) || " "
            : nodes[i].setAttribute(attr, tpl.get(string) || " ");
          toMap.push(string);
        }
      });
      map.push(toMap);
      toMap = [];
    }
    item.outerHTML = new XMLSerializer().serializeToString(xml);
  });
});
