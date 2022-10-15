$(document).ready(function(){
    //hides dropdown content
    $(".appointment").hide();

    //shows by default the first pet
    $(".appointment").first().show();

    //listen to dropdown for change
    $("#doctor-appointments").change(function(){
        $(this).find("option:selected").each(function(){
            var optionValue = $(this).attr("value");
            if(optionValue){
                $(".appointment").not("." + optionValue).hide();
                $("." + optionValue).show();
            } else{
                $(".appointment").hide();
            }
        });
    })
});