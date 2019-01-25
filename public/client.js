function validate() {
  if($( "input:checked" ).length == 0){
    alert ("You may want to select to either Add to Memories or Add to Forecast !");
    return false;
  } else {
    $('#f').submit();
    return false;
  }
}

function show_status(isNew) {
  var v = $('#verb').val();
  var t = $('#task').val();

  if(v != '' && t != '') {
    $('#s_verb').text(v);
    $('#s_task').text(t);
    $('#s_last_date').text($('#last_date').val());
    $('#s_days_ago').text($('#days_ago').val());

    $.ajax({
      type: 'GET',
      url: '/api/get_avg?v='+v+'&t='+t,
      success: function(resp) {
        console.log("Resp...");
        console.log(resp);
        if(resp[0] && resp[0].avg_days_ago > 0) {
          var avgd = parseInt(resp[0].avg_days_ago);
          var mls = 'same as average';

          if(avgd > $('#days_ago').val()) {
            mls = 'less than average';
          } else if(avgd < $('#days_ago').val()) {
            mls = 'more than average';
          }

          $('#s_usual').text(avgd);
          $('#s_more_less').text(mls);
          $('#line2').show();
        } else {
          $('#line2').hide();
        }
      }
    })

    if($('#days_ago').val() != '') {
      $('#div_status').show();
    }
  }
  else {
    $('#div_status').hide();
  }
}

function get_diff() {
  var one_day=1000*60*60*24;
  var ld = $('#last_date').val();
  if(ld != '') {
    var ed = $('#entry_date').val();
    var da = Date.parse(ed) - Date.parse(ld);
    return Math.round(da/one_day);
  } else {
    return '';
  }
}

function set_values(task, edate, dataTasks) {
  $('#task').val(task);
  $('#last_date').val(edate);
  $('#days_ago').val(get_diff());
  show_status();

  if(dataTasks == '') {
    $('#task').autocomplete({
      data: {}
    });
  } else {
    $('#task').autocomplete({
      data: dataTasks,
      limit: 5, // The max amount of results that can be shown at once. Default: Infinity.
      onAutocomplete: function(valT) {
        console.log("valT");
        console.log(valT);
        var res = valT.split(". Last entry on:");
        set_values(res[0], res[1], '');
      },
      minLength: 1, // The minimum length of the input for the autocomplete to start. Default: 1.
    });
  }
}

$( "#entry_date" ).change(function() {
  $('#days_ago').val(get_diff());
  show_status();
})


$(document).ready(function(){
  $(".button-collapse").sideNav();
  $('select').material_select();

  if($('#verb').val() != '' && $('#task').val() != '') {
    $.ajax({
      type: 'GET',
      url: '/api/get_tasks?v='+$('#verb').val()+'&t='+$('#task').val(),
      success: function(resp) {
        set_values(resp[0].task, resp[0].entry_date, '');
      }
    })
  }

  $(function() {
    $.ajax({
      type: 'GET',
      url: '/api/get_verbs',
      success: function(response) {

        var dataVerbs = {};
        for (var i = 0; i < response.length; i++) {
          dataVerbs[response[i].verb] = null;
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
                  set_values(resp[0].task, resp[0].entry_date, '');
                }
                else {

                  for (var i = 0; i < resp.length; i++) {
                    var strkey = resp[i].task + '. Last entry on:' + resp[i].entry_date;
                    dataTasks[strkey] = null;
                  }
                  set_values('', '', dataTasks);

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
