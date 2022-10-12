$(document).ready(function(){
    $(".delete-btn").click(function(){
        var petIndex = $(this).val();
        swal({
            title: "Are you sure?",
            text: "This will remove your pet from your record.",
            icon: "warning",
            buttons: true,
            dangerMode: true,
          })
          .then((willDelete) => {
            if (willDelete) {
                axios({
                    method: 'POST',
                    url: '/delete-pet',
                    data: {
                        petIndex: petIndex,
                    }
                }).then((success) => {
                    location.reload();
                });
            }
        });
    });
})