$(document).ready(function(){
    $(".btn-cancel").click(function(){
        swal({
            title: "Cancel booking appointment?",
            text: "You will no longer be going through with your appointment",
            icon: "warning",
            buttons: true,
            dangerMode: true,
          })
          .then((willUpdate) => {
            if (willUpdate) {
                $("form").trigger("reset");
            }
        });
    })
})