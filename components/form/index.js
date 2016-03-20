(function() {

  tpl.set('counter.checkbox.checked', true);

  var counterInc = document.getElementById(tpl.get('counter.btn.id'));

  counterInc.addEventListener('click', function() {
    var value = tpl.get('counter.input.value');
    tpl.set('counter.input.value', ++value);
  });

}());
