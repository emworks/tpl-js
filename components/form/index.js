(function() {

  tpl.set('counter.checkbox.checked', true);

  // increment button
  tpl.get('counter.btn.inc.id').on('click', function() {
    tpl.set('counter.input.value', (value) => ++value);
  });

  // decrement button
  tpl.get('counter.btn.dec.id').on('click', function() {
    tpl.set('counter.input', function(input) {
      input.value -= 1;
      return input;
    });
  });

}());
