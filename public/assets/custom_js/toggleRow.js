$(document).ready(function(){
    $(".transaction-details").hide();
    var toShow = false;
    $("tr").click(function(){
        var rowID = $(this).attr("id");
        toShow = !toShow;
        if(toShow){
            $("#"+rowID+"-conclusion").show(500);
        }else{
            $("#"+rowID+"-conclusion").hide(500);
        }
    })
})