$(document).ready(function(){
    $(".option-btn").click(function(){
        var appointmentIndex = $(this).val();
        var option = $(this).text();
        switch(option){
            case "ACCEPT":
                option = "confirmed";
                break;
            case "RESCHEDULE":
                option = "rescheduled";
                break;
            case "CANCEL":
                option = "cancelled";
                break;
            default:
                break;
        }
        swal({
            title: "Update Status?",
            text: "This changes the current appointment status to "+option.toUpperCase(),
            icon: "warning",
            buttons: true,
            dangerMode: true,
          })
          .then((willUpdate) => {
            if (willUpdate) {
                axios({
                    method: 'POST',
                    url: '/update-status',
                    data: {
                        appointmentStatus:option,
                        appointmentIndex:appointmentIndex
                    }
                }).then((success) => {
                    location.reload();
                });
            }
        });
    })
})