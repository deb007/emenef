function validate() {
  if($( "input:checked" ).length == 0){
    alert ("You may want to select to either Add to Memories or Add to Forecast !");
    return false;
  } else {
    $('#f').submit();
    return false;
  }
}

$(document).ready(function(){
  $(".button-collapse").sideNav();
  $('select').material_select();

  if($('#verb').val() != '' && $('#task').val() != '') {
    $.ajax({
      type: 'GET',
      url: '/api/get_tasks?v='+$('#verb').val()+'&t='+$('#task').val(),
      success: function(resp) {

        var dataTasks = {};
        $('#task').val(resp[0].task);
        $('#last_date').val(resp[0].entry_date);
        $('#days_ago').val(get_diff());
        $('#task').autocomplete({
          data: {}
        });
      }
    })
  }

  $( "#entry_date" ).change(function() {
    $('#days_ago').val(get_diff());
  })

  function get_diff() {
    var one_day=1000*60*60*24;
    var ld = $('#last_date').val();
    if(ld != '') {
      var ed = $('#entry_date').val();
      var da = Date.parse(ed) - Date.parse(ld);
      return Math.round(da/one_day);
    }
  };

  $(function() {
    $.ajax({
      type: 'GET',
      url: '/api/get_verbs',
      success: function(response) {

        var dataVerbs = {};
        for (var i = 0; i < response.length; i++) {
          dataVerbs[response[i].verb] = null; //countryArray[i].flag or null
        }

        $('#verb').autocomplete({
          data: dataVerbs,
          limit: 5, // The max amount of results that can be shown at once. Default: Infinity.
          onAutocomplete: function(val) {
            $.ajax({
              type: 'GET',
              url: '/api/get_tasks?v='+val,
              success: function(resp) {

                var dataTasks = {};
                if(resp.length == 1) {
                  $('#task').val(resp[0].task);
                  $('#last_date').val(resp[0].entry_date);
                  $('#days_ago').val(get_diff());
                  $('#task').autocomplete({
                    data: {}
                  });
                }
                else {
                  $('#task').val('');
                  $('#last_date').val('');
                  $('#days_ago').val('');
                  for (var i = 0; i < resp.length; i++) {
                    var strkey = resp[i].task + '. Last entry on:' + resp[i].entry_date;
                    dataTasks[strkey] = null;
                  }

                  $('#task').autocomplete({
                    data: dataTasks,
                    limit: 5, // The max amount of results that can be shown at once. Default: Infinity.
                    onAutocomplete: function(valT) {
                      var res = valT.split(". Last entry on:");
                      $('#task').val(res[0]);
                      $('#last_date').val(res[1]);
                      $('#days_ago').val(get_diff());
                    },
                    minLength: 1, // The minimum length of the input for the autocomplete to start. Default: 1.
                  });
                }
              }
            });
          },
          minLength: 1, // The minimum length of the input for the autocomplete to start. Default: 1.
        });
      }
    });
  });
})
$('.datepicker').pickadate({
  selectMonths: true, // Creates a dropdown to control month
  selectYears: 15, // Creates a dropdown of 15 years to control year,
  today: 'Today',
  clear: 'Clear',
  close: 'Ok',
  closeOnSelect: false, // Close upon selecting a date
  formatSubmit: 'yyyy/mm/dd',
  onStart: function ()
  {
      var date = new Date();
      this.set('select', [date.getFullYear(), date.getMonth(), date.getDate()]);
  },
});
