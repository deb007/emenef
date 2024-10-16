function validate() {
  if ($("#memories:checked, #forecast:checked").length == 0) {
    alert("You may want to select either 'Add to Memories' or 'Add to Forecast'!");
    return false;
  } else {
    $('#f').submit();
    return false;
  }
}

function getTodayDate() {
  var today = new Date();
  var dd = String(today.getDate()).padStart(2, '0');
  var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
  var yyyy = today.getFullYear();

  return yyyy + '-' + mm + '-' + dd;
}

function show_status(isNew) {
  var v = $('#verb').val();
  var t = $('#task').val();

  if (v != '' && t != '') {
    $('#s_verb').text(v);
    $('#s_task').text(t);
    $.ajax({
      type: 'GET',
      url: '/api/get_tasks?v=' + v + '&t=' + t,
      success: function (respo) {
        console.log('respo');
        console.log(respo);
        if (respo.length == 0) {
          console.log('New entry');
          $('#div_status').removeClass('d-block').addClass('d-none');

        } else {

          $('#s_last_date').text($('#last_date').val());
          $('#s_days_ago').text($('#days_ago').val());
          $('#div_status').removeClass('d-none').addClass('d-block');

          $.ajax({
            type: 'GET',
            url: '/api/get_avg?v=' + v + '&t=' + t,
            success: function (resp) {
              console.log("Resp...");
              console.log(resp);
              if (resp[0] && resp[0].avg_days_ago > 0) {
                var avgd = parseInt(resp[0].avg_days_ago);
                var mls = 'same as average';

                if (avgd > $('#days_ago').val()) {
                  mls = 'less than average';
                } else if (avgd < $('#days_ago').val()) {
                  mls = 'more than average';
                }

                $('#s_usual').text(avgd);
                $('#s_more_less').text(mls);
                $('#line2').removeClass('d-none').addClass('d-block');
              } else {
                $('#line2').removeClass('d-block').addClass('d-none');
              }
            }
          })

          if ($('#days_ago').val() != '') {
            $('#div_status').removeClass('d-none').addClass('d-block');
          }
        }
      }
    })
    console.log('----');

  }
  else {
    $('#div_status').removeClass('d-block').addClass('d-none');
  }
}

function get_diff() {
  var one_day = 1000 * 60 * 60 * 24;
  var ld = $('#last_date').val();
  if (ld != '') {
    var ed = $('#entry_date').val();
    var da = Date.parse(ed) - Date.parse(ld);
    return Math.round(da / one_day);
  } else {
    return '';
  }
}

function set_values(task, edate, dataTasks) {
  $('#task').val(task);
  $('#last_date').val(edate);
  $('#days_ago').val(get_diff());
  show_status();

  if (dataTasks == '') {
    $('#task').typeahead('destroy');
    $('#task').typeahead({
      source: [],
      autoSelect: true,
      minLength: 1
    });
  } else {
    $('#task').typeahead('destroy');
    $('#task').typeahead({
      source: Object.keys(dataTasks),
      autoSelect: true,
      afterSelect: function (valT) {
        console.log("valT");
        console.log(valT);
        var res = valT.split(". Last entry on:");
        set_values(res[0], res[1], '');
      },
      minLength: 1
    });
  }
}

$("#entry_date").change(function () {
  $('#days_ago').val(get_diff());
  show_status();
})


$(document).ready(function () {

  if ($('#verb').val() != '' && $('#task').val() != '') {
    $.ajax({
      type: 'GET',
      url: '/api/get_tasks?v=' + $('#verb').val() + '&t=' + $('#task').val(),
      success: function (resp) {
        set_values(resp[0].task, resp[0].entry_date, '');
      }
    })
  }

  $(function () {
    $.ajax({
      type: 'GET',
      url: '/api/get_verbs',
      success: function (response) {

        var dataVerbs = {};
        for (var i = 0; i < response.length; i++) {
          dataVerbs[response[i].verb] = null;
        }

        $('#verb').typeahead({
          source: Object.keys(dataVerbs),
          autoSelect: true,
          afterSelect: function (val) {
            $.ajax({
              type: 'GET',
              url: '/api/get_tasks?v=' + val,
              success: function (resp) {
                var dataTasks = {};
                if (resp.length == 1) {
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
          minLength: 1
        });
      }
    });
  });


  // Set default date for entry_date
  $('#entry_date').val(getTodayDate());

  // Initialize datepicker
  $('.datepicker').datepicker({
    format: 'yyyy-mm-dd',
    autoclose: true,
    todayHighlight: true,
    todayBtn: 'linked'
  });

  // Trigger change event to update days_ago
  $('#entry_date').trigger('change');
});
