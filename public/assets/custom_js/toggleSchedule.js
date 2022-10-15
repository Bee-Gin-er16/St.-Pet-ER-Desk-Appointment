$(document).ready(function(){
    $(".transaction-options").hide();
    var toShow = false;
    $("tr").click(function(){
        var rowID = $(this).attr("id");
        if(rowID.includes("pending")){
            toShow = !toShow;
            if(toShow){
                $("#"+rowID+"-options").show(500);
            }else{
                $("#"+rowID+"-options").hide(500);
            }
        }
    })
})