$(document).ready(function(){
    //hides dropdown content
    $(".pet").hide();
    
    //unhides first option content
    $("#pet-content:first").show();
    
    //listen to dropdown for change
    $("#user-pets").change(function(){
      //rehide content on change
      $('.pet').hide();
      //unhides current item
      $('#'+$(this).val()).show();
    }); 
});