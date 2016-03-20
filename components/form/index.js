(function() {

  tpl.set('counter.checkbox.checked', true);

  var counterInc = document.getElementById(tpl.get('counter.btn.id'));

  counterInc.addEventListener('click', function() {
    tpl.set('counter.input.value', function(value) {
      return ++value;
    });
  });

}());
