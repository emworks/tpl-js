(function() {

  tpl.set('counter.checkbox.checked', true);

  tpl.get('counter.btn.id').on('click', function() {
    tpl.set('counter.input.value', (value) => ++value);
  });

}());
