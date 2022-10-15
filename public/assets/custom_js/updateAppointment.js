$(document).ready(function(){
    $(".error-msg").hide();
    $("#confirm-details-button").click(function(){
        var petIndex = $(this).val();
        var petFindings = $(".findings").val();
        var petPrescription = $(".prescription").val();
        var clientName = $("#appointment-client-name").text();
        if(petFindings == ""){
            $(".error-msg").show();
            return;
        }
        swal({
            title: "Confirm findings?",
            text: "Updating this pet appointment closes the appointment and makes the updates visible to the pet parent.",
            icon: "warning",
            buttons: true,
            dangerMode: true,
          })
          .then((willUpdate) => {
            if (willUpdate) {
                axios({
                    method: 'POST',
                    url: '/update-pet-appointment',
                    data: {
                        petIndex: petIndex,
                        petFindings: petFindings,
                        petPrescription: petPrescription,
                        clientName: clientName
                    }
                }).then((success) => {
                    location.reload();
                });
            }
        });
    });
})