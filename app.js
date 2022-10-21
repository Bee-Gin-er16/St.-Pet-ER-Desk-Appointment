//============ PACKAGE IMPORTS ============//
const express = require("express");
const app = express();
const ejs = require("ejs");
const session = require('express-session');
const admin = require("firebase-admin");
const credentials = require("./key.json");
const config = require("./config.json");
const {initializeApp} = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } = require('firebase/auth');

//============  INITIALIZATION (FIRESTORE AND SESSION) ============//
const firebaseApp = initializeApp(config);
admin.initializeApp({
    credential: admin.credential.cert(credentials)
})

//session for log in
app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true,
}));

const auth = getAuth(firebaseApp);
const db = admin.firestore();

app.set('view engine', 'ejs');
app.use(express.static("./public"));
app.use(express.json());
app.use(express.urlencoded({extended:true}));

//============ VARIABLE DECLARATION ============//
var errorMsg = "";
var signupError = "";
var signinError = "";
var licenseError = "";
var scheduleError = "";
var addStatus = "";
var addPetMessage = "";
var deletePetMessage="";
var deleteStatus;
var addBookingMessage="";
var addBookingStatus="";
var updateBookingStatus="";
var updateBookingMessage="";

//============ FUNCTION DEFINITION ============//
//Used to refresh details of client (like name, email, etc.)
//During loading after registration and signin
//to ensure that data is up-to-date
async function authenticateUser(req, res){
    var result = await db.collection("users").where('email','==',req.session.email).get();
    var resultArr = [];
    result.forEach((doc)=> {
        resultArr.push(doc.data());
    })
    if(resultArr != []){
        req.session.userData = resultArr[0];
        req.session.username = resultArr[0].username;
        if(resultArr[0].type == "client"){
            res.redirect("/schedule");
        }else{
            res.redirect("/appointment");
        }
    }else{
        signinError = "Invalid User!"
        res.redirect("/")
    }
}

//Used to refresh data of the user when there are major changes made
//like delete a pet, add a booking, accept a transaction, etc.
async function refreshData(req,res){
    var result = await db.collection("users").where('email','==',req.session.email).get();
    var resultArr = [];
    result.forEach((doc)=> {
        resultArr.push(doc.data());
    })
    if(resultArr != []){
        req.session.userData = resultArr[0];
        req.session.username = resultArr[0].username;
        return true;
    }else{
        return false;
    }
}

//Used during doctor registration 
//in order to verify that no other doctor has taken the schedule
//the user is signing up for
async function validateDoctorScheduler(scheduleDay, scheduleTime)
{
    var resultArr = [];
    var result = await db.collection("users")
            .where('scheduleDay','array-contains', scheduleDay)
            .get();
    result.forEach((doc)=> {
        if(doc.data().scheduleSlot.includes(scheduleTime)){
            resultArr.push(doc.data());
        }
    })
    return resultArr;
}

//Converts time to 24-hour format
//Example#1: 08:30AM --> 08:30
//Example#2: 01:30PM --> 13:30
function convertTime (timeSlot)
{
    var hrs = Number(timeSlot.match(/^(\d+)/)[1]);
    var mnts = Number(timeSlot.match(/:(\d+)/)[1]);
    var format = timeSlot.match(/([AaPp][Mm])/)[1];
    if (format == "PM" && hrs < 12) hrs = hrs + 12;
    if (format == "AM" && hrs == 12) hrs = hrs - 12;
    var hours = hrs.toString();
    var minutes = mnts.toString();
    if (hrs < 10) hours = "0" + hours;
    if (mnts < 10) minutes = "0" + minutes;
    var timeEnd = hours + ":" + minutes;
    return timeEnd;
}

//Used to retrieve the details of the doctor
//that an appointment is assigned to when a client
//makes a booking
async function retrieveDoctorBySchedule(scheduleDay,scheduleTime)
{   
    var result = await db.collection("users")
                         .where('scheduleDay','array-contains', scheduleDay)
                         .get();
    var resultArr = [];
    var schedule = scheduleTime.split("-")[0];
    var convertedSchedule = convertTime(schedule)

    result.forEach((doc)=> {
        var startTime = doc.data().scheduleSlot.split("-")[0];
        var endTime = doc.data().scheduleSlot.split("-")[1];
        var convertedStartTime = convertTime(startTime);
        var convertedEndTime = convertTime(endTime);
        if(convertedSchedule >= convertedStartTime && convertedSchedule <= convertedEndTime){
            resultArr.push(doc.data());
        }
    });
    return resultArr[0];  
}

//Used to validate if there is already a booking 
//that exists with the same details for a user
//There should be no duplicate bookings
async function validateDuplicateBookings(bookingJson){
    var result = await db.collection("users")
                         .where('bookings','array-contains', bookingJson)
                         .get();
    var resultArr = [];
    result.forEach((doc)=> {
        resultArr.push(doc.data());
    });
    return resultArr;
}

//Retrieves the CONFIRMED bookings made by specific user
//that are due the current week
function retrieveBookingsThisWeek(req){
    var bookings = req.session.userData.bookings;
    var curr = new Date; // get current date
    var first = curr.getDate() - curr.getDay(); // First day is the day of the month - the day of the week
    var last = first + 6; // last day is the first day + 6

    var firstDay = new Date(curr.setDate(first)).setHours(0,0,0,0);
    var lastDay = new Date(curr.setDate(last)).setHours(0,0,0,0);
    var appointmentDate;
    var bookingsThisWeek = [];
    if(bookings != undefined){
        bookings.forEach((b)=> {
            appointmentDate = b.dateOfAppointment.split(", ")[0];
            appointmentDate = new Date(appointmentDate).setHours(0,0,0,0);
            if(appointmentDate >= firstDay && appointmentDate <= lastDay && b.bookingStatus == "confirmed"){
                bookingsThisWeek.push(b);
            }
        })
    }
    return bookingsThisWeek;
}

//Genereates the appointment ID assigned to the different appointments
function generateAppointmentID(petName,dateOfAppointment,timeOfAppointment){
    return "Apt_"+petName+"_"+dateOfAppointment.replace(/-/g,"")+timeOfAppointment.replace(/:/g,"").replace(/-/g,"").replace(/AM/g,"").replace(/PM/g,"");
}

//Retrieves all the appointments
//If type == "client", it retrieves all bookings for that client
//If type == "doctor", it retrieves all bookings confirmed by that doctor 
//and includes the name of the client for that booking
async function retrieveAppointments(req,type,name){
    var result = await db.collection("users")
                         .where('type','==', type)
                         .get();
    var resultArr = [];
    result.forEach((doc) => {
        console.log(doc.data())
        if(name != ""){
            if(doc.data().bookings != undefined){
                for (var i = 0; i< doc.data().bookings.length; i++){
                    var appointmentDetails = {
                        doctor: name
                    }
                    if(doc.data().bookings[i].doctor == name){
                        appointmentDetails["appointmentID"] = doc.data().bookings[i].appointmentID;
                        appointmentDetails["clientName"] = doc.data().name;
                        appointmentDetails["petName"] = doc.data().bookings[i].bookingPet;
                        appointmentDetails["petType"] = doc.data().bookings[i].petType;
                        appointmentDetails["petBreed"] = doc.data().bookings[i].petBreed;
                        appointmentDetails["schedule"] = doc.data().bookings[i].dateOfAppointment;
                        appointmentDetails["dateBooked"] = doc.data().bookings[i].dateBooked;
                        appointmentDetails["time"] = doc.data().bookings[i].bookingTime;
                        appointmentDetails["day"] = doc.data().bookings[i].bookingDate;
                        appointmentDetails["doctor"] = doc.data().bookings[i].doctor;
                        appointmentDetails["status"] = doc.data().bookings[i].bookingStatus.toUpperCase();
                        appointmentDetails["petFindings"] = doc.data().bookings[i].petFindings;
                        appointmentDetails["petPrescription"] = doc.data().bookings[i].petPrescription;
                        resultArr.push(appointmentDetails);
                    }
                }
            }
        }else{
            if(doc.data().bookings != undefined){
                if(doc.data().email == req.session.email){
                    resultArr = doc.data().bookings;
                }
            }
        }
    })
    console.log("KAPOY",resultArr)
    req.session.userData.appointments = resultArr;
}

//Retrieves a client bookings
//Used for when the application needs to find the details 
//of the booking when deleting or updating a bookin
async function retrieveClientBookings(req,clientName){
    var result = await db.collection("users")
                         .where('name','==', clientName)
                         .get();
    var resultArr = [];
    result.forEach((doc) => {
        resultArr.push(doc.data());
    })
    return resultArr[0].bookings;
}

//============ START OF ROUTING ============//
app.get("/", async (req,res) => {
    res.render("log_in", {signinError: signinError});
    signinError = "";
})

app.get("/d-register", (req,res) => {
    res.render("doctor_reg", {errormsg:errorMsg, signupError: signupError, licenseError:licenseError, scheduleError:scheduleError});
    errorMsg="";
    signupError="";
    licenseError = "";
    scheduleError = "";
})

app.get("/c-register", (req,res) => {
    res.render("client_reg", {errormsg:errorMsg, signupError: signupError});
    errorMsg="";
    signupError="";
})

app.post("/submit-c-register", async (req,res) => {
    if (req.body.psw === req.body.pswrepeat){
        try{
            var petName = req.body.petName;
            var petBreed = req.body.petBreed;
            var petType = req.body.petType;
            var petGender = req.body.petGender;
            var petAge = req.body.petAge;
            var petWeight = req.body.petWeight;
            var vaccination = req.body.checked === undefined ? [] : req.body.checked;
            var username = req.body.username;
            var name = req.body.clientName;
            var userAge = req.body.clientAge;
            var userGender = req.body.clientGender;
            var email = req.body.emailAddress;
            var contactNumber = req.body.contactNumber;
            var address = req.body.address;
            var type = "client"

            const petJson = {
                petName: petName,
                petBreed: petBreed,
                petType: petType,
                petGender: petGender,
                petAge: petAge,
                petWeight: petWeight,
                petVaccine: vaccination
            }
            const userJson = {
                username: username,
                name: name,
                userAge: userAge,
                userGender: userGender,
                email: email,
                contactNumber: contactNumber,
                address: address,
                petInfo: [petJson],
                type: type
            };

            createUserWithEmailAndPassword(auth, email, req.body.psw).then((cred) => {
                db.collection('users').add(userJson).then((response) => {
                    if (response._path){
                        req.session.isLoggedIn = true;
                        req.session.username = username;
                        req.session.email = email;
                        authenticateUser(req, res);
                    }
                }) 
            }).catch(error => {
                signupError = error;
                if(error == "FirebaseError: Firebase: Error (auth/email-already-in-use)."){
                    signupError = "E-mail address is already in use. Please use a different email."
                }else if(error == "FirebaseError: Firebase: Password should be at least 6 characters (auth/weak-password)."){
                    signupError = "Password should be at least 6 characters"
                }
                res.redirect("/c-register");
            })
        }catch(ex){
            signupError = "Error connecting to database. Please try again."
            res.redirect("/c-register");
        }
    }else{
        errorMsg = "Passwords do not match!"
        res.redirect("/c-register")
    }
})

app.post("/submit-d-register", async (req,res) => {
    if (req.body.psw === req.body.pswrepeat) {
        try{
            var count = 0;
            var schedCount = 0;
            var dayTaken = [];
            var username = req.body.username;
            var name = req.body.name;
            var email = req.body.email;
            var clinicAddress = req.body.clinicAddress;
            var doctorAge = req.body.doctorAge;
            var doctorGender = req.body.doctorGender;
            var contactNumber = req.body.contactNumber;
            var licenseNumber = req.body.doctorLicense;
            var scheduleDay = req.body.checked === undefined ? "" : req.body.checked;
            var scheduleSlot = req.body.scheduleSlot;
            var type = "doctor";

            if(licenseNumber.length == 0) {
                licenseError = "Incorrect license number format!"
                count = count+1;
            }
            if(scheduleDay == "") {
                scheduleError = "Must pick at least one schedule day!"
                count = count+1;
            }
            
            for(var i=0; i<scheduleDay.length; i++){
                var isValid = await validateDoctorScheduler(scheduleDay[i],scheduleSlot);
                if(isValid.length != 0){
                    schedCount = schedCount + 1;
                    dayTaken.push(scheduleDay[i])
                }
            }

            if(schedCount > 0){
                signupError = "Sorry. The schedule "+dayTaken.join()+" at "+scheduleSlot+" has already been taken. Please try another schedule";
            }

            if(count == 0 && schedCount == 0) {
                const doctorJson = {
                    username: username,
                    name: name,
                    email: email,
                    clinicAddress: clinicAddress,
                    doctorAge: doctorAge,
                    doctorGender: doctorGender,
                    contactNumber: contactNumber,
                    licenseNumber: licenseNumber,
                    scheduleDay: scheduleDay,
                    scheduleSlot: scheduleSlot,
                    type: type
                }
                createUserWithEmailAndPassword(auth, email, req.body.psw).then((cred) => {
                    db.collection('users').add(doctorJson).then((response) => {
                        if (response._path){
                            req.session.isLoggedIn = true;
                            req.session.username = username;
                            req.session.email = email;
                            authenticateUser(req,res);
                        }
                    }) 
                }).catch(error => {
                    signupError = error;
                    if(error == "FirebaseError: Firebase: Error (auth/email-already-in-use)."){
                        signupError = "E-mail address is already in use. Please use a different email."
                    }else if(error == "FirebaseError: Firebase: Password should be at least 6 characters (auth/weak-password)."){
                        signupError = "Password should be at least 6 characters"
                    }
                    res.redirect("/d-register");
                })
            }else{
                res.redirect("d-register");
            }
        }catch(ex){
            signupError = "Error connecting to database. Please try again."
            res.redirect("/d-register");
        }
    }else{
        errorMsg = "Passwords do not match!"
        res.redirect("/d-register")
    }
})

app.post("/signin", (req,res) => {
    var email = req.body.email;
    signInWithEmailAndPassword(auth, email, req.body.psw).then((userCredential) => {
        req.session.isLoggedIn = true;
        req.session.email = email;
        authenticateUser(req,res);
    })
    .catch((error) => {
        signinError = "Unable to sign in user. Try again.";
        res.redirect("/");
    });
})

app.post("/authenticate", async (req,res) => {
    var result = await db.collection("users").where('email','==',req.session.email).get();
    var resultArr = [];
    result.forEach((doc)=> {
        resultArr.push(doc.data());
    })
    if(resultArr != []){
        req.session.userData = resultArr[0];
        req.session.username = resultArr[0].username;
        if(resultArr[0].type == "client"){
            res.redirect("/schedule");
        }else{
            res.redirect("/appointment");
        }
    }else{
        signinError = "Invalid User!"
        res.redirect("/")
    }
})

app.get ("/schedule", async (req,res) => {
    if(req.session.isLoggedIn == true){
        console.log("Logged In")
        if(req.session.userData.type == "client"){
            weekBookings = retrieveBookingsThisWeek(req);
            res.render("client_schedule", {username:req.session.username, userInfo: req.session.userData, addBookingMessage:addBookingMessage, addBookingStatus:addBookingStatus, weekBookings:weekBookings}); 
            addBookingStatus = "";
            addBookingMessage = "";
        }else{
            await retrieveAppointments(req,"client",req.session.userData.name);
            res.render("doctor_schedule", {username:req.session.username, transaction:req.session.userData.appointments, updateBookingStatus:updateBookingStatus, updateBookingMessage:updateBookingMessage});
            updateBookingStatus = "";
            updateBookingMessage = "";
        }
    }else{
        res.redirect("/");
    }
})

app.get("/appointment", async (req,res) => {
    if(req.session.isLoggedIn == true){
        console.log("Logged In");
        await retrieveAppointments(req,"client",req.session.userData.name);
        res.render("doctor_appointment", {username:req.session.username, appointments: req.session.userData.appointments, updateBookingStatus:updateBookingStatus, updateBookingMessage:updateBookingMessage});
        updateBookingStatus="";
        updateBookingMessage="";
    }else{
        res.redirect("/");
    }
})

app.get("/profile", async (req,res) => {
    if(req.session.isLoggedIn == true) {
        if(req.session.userData.type == "client"){
            res.render("client_profile", {userInfo:req.session.userData, deleteStatus:deleteStatus, deleteMessage:deletePetMessage})
            deleteStatus="";
            deletePetMessage="";
        }else{
            res.render("doctor_profile", {userInfo:req.session.userData})
        }
    }else{
        res.redirect("/");
    }
})

app.get("/add-pet", (req,res) => {
    if(req.session.isLoggedIn == true) {
        res.render("client_add_pet", {userInfo:req.session.userData, addStatus:addStatus, addMessage:addPetMessage});
        addStatus = "";
        addPetMessage = ""
    }else{
        res.redirect("/");
    }
})

app.post("/submit-add-pet", async (req,res) => {
    var petName = req.body.petName;
    var petBreed = req.body.petBreed;
    var petType = req.body.petType;
    var petGender = req.body.petGender;
    var petAge = req.body.petAge;
    var petWeight = req.body.petWeight;
    var vaccination = req.body.checked === undefined ? [] : req.body.checked;
    const petJson = {
        petName: petName,
        petBreed: petBreed,
        petType: petType,
        petGender: petGender,
        petAge: petAge,
        petWeight: petWeight,
        petVaccine: vaccination
    }
    await db.collection("users")
            .where('email','==',req.session.email)
            .get().then((querySnapshot) => {
                querySnapshot.docs.forEach((document) => {
                    document.ref.update({
                        'petInfo': admin.firestore.FieldValue.arrayUnion(petJson)
                    }).then((result) => {
                        addStatus = "success"
                        addPetMessage = "Pet has been successfully added. Check your profile to view details"
                        refreshData(req,res).then((success) => {
                            if(success) res.redirect("/add-pet")
                        })
                    }).catch(error => {
                        console.log("Error", error);
                        addPetMessage = "Unable to add pet. Please try again."
                        addStatus = "fail"
                        refreshData(req,res).then((success) => {
                            res.redirect("/add-pet")
                        })
                    })
                })
    });
})

app.post("/delete-pet", async (req,res) => {
    var index = parseInt(req.body.petIndex);
    var petToDelete = req.session.userData.petInfo[index];
    await db.collection("users")
            .where('email','==',req.session.email)
            .get().then((querySnapshot) => {
                querySnapshot.docs.forEach((document) => {
                    document.ref.update({
                        'petInfo': admin.firestore.FieldValue.arrayRemove(petToDelete)
                    }).then((result) => {
                        deleteStatus = "success"
                        deletePetMessage = "Pet record was deleted successfully."
                    }).catch(error => {
                        console.log("Error", error);
                        deletePetMessage = "Unable to delete pet record. Please try again."
                        deleteStatus = "fail"
                        refreshData(req,res).then((success) => {
                            res.redirect("/profile")
                        })
                    })
                })
    });
    await refreshData(req,res).then((success) => {
        res.redirect("/profile")
    })
})

app.post("/submit-add-booking", async (req,res) => {
    var bookingDate = new Date(req.body.bookingDate).toLocaleString('en-us', {  weekday: 'long' });
    var bookingPet = req.body.bookingPet;
    var retrievedDoctor = await retrieveDoctorBySchedule(bookingDate, req.body.bookingTime);
    var currentDateTime = new Date();
    var currentDate = (currentDateTime.getFullYear()).toString()+"-"+(currentDateTime.getMonth()+1).toString()+"-"+(currentDateTime.getDate()).toString();
    var petToBook = req.session.userData.petInfo[bookingPet];
    var appoinmentID = generateAppointmentID(petToBook.petName, req.body.bookingDate, req.body.bookingTime);
    const bookingJson = {
        appointmentID: appoinmentID,
        bookingDate: bookingDate,
        bookingTime: req.body.bookingTime,
        bookingPet: petToBook.petName,
        petType: petToBook.petType,
        petBreed: petToBook.petBreed,
        dateOfAppointment: req.body.bookingDate + ", " + req.body.bookingTime ,
        doctor: retrievedDoctor === undefined ? "" : retrievedDoctor.name,
        bookingStatus: "pending",
        dateBooked: currentDate
    }
    if(retrievedDoctor !== undefined){
        var isBookingValid = await validateDuplicateBookings(bookingJson);
        if(isBookingValid.length == 0) {
            bookingJson["dateBooked"]= currentDate;
            await db.collection('users')
            .where('petInfo', 'array-contains', petToBook)
            .get().then((querySnapshot)=> {
                querySnapshot.docs.forEach((document) => {
                    document.ref.update({
                        'bookings': admin.firestore.FieldValue.arrayUnion(bookingJson)
                    }).then((result) => {
                        addBookingStatus = "success";
                        addBookingMessage = "Added booking. Booking is pending Dr. "+retrievedDoctor.name;
                        refreshData(req,res).then((success) => {
                            res.redirect("/schedule");
                        })
                    })
                })
            }).catch(error => {
                addBookingMessage = "Unable to add booking. Please try again."
                addBookingStatus = "fail";
                refreshData(req,res).then((success) => {
                    res.redirect("/schedule")
                })
            })
        }else{
            addBookingStatus = "fail";
            addBookingMessage = "You have a pending booking for this pet. Please try for another schedule.";
            res.redirect("/schedule");
        }
    }else{
        addBookingStatus = "fail";
        addBookingMessage = "No doctor is available for that chosen schedule. Try another schedule instead.";
        res.redirect("/schedule")
    }
})

app.get("/transaction", async (req,res) => {
    if(req.session.isLoggedIn == true){
        console.log(req.session.userData);

        if(req.session.userData.type == "client"){
            await retrieveAppointments(req, req.session.userData.type,"")
            res.render("client_transaction", {userInfo:req.session.userData, transaction: req.session.userData.appointments});
        }else{
            await retrieveAppointments(req, "client", req.session.userData.name)
            res.render("doctor_transaction", {userInfo:req.session.userData, transaction: req.session.userData.appointments});
        }
    }else{  
        res.redirect("/")
    }
})

app.post("/update-pet-appointment", async (req,res) => {
    var index = parseInt(req.body.petIndex);
    var findings = req.body.petFindings;
    var prescription = req.body.petPrescription;
    var clientName = req.body.clientName;
    var bookingToDelete = await retrieveClientBookings(req,clientName);
    bookingToDelete = bookingToDelete[index]
    var bookingToUpdate = await retrieveClientBookings(req,clientName);
    bookingToUpdate = bookingToUpdate[index]
    bookingToUpdate["petFindings"] = findings;
    bookingToUpdate["petPrescription"] = prescription;
    bookingToUpdate.bookingStatus = "closed"
    result = await db.collection("users")
            .where('name','==',clientName)
            .get().then((querySnapshot) => {
                querySnapshot.docs.forEach((document) => {
                    document.ref.update({
                        'bookings': admin.firestore.FieldValue.arrayRemove(bookingToDelete),
                    }).then((success1) => {
                        document.ref.update({
                            'bookings': admin.firestore.FieldValue.arrayUnion(bookingToUpdate)
                        }).then((result) => {
                            updateBookingStatus = "success"
                            updateBookingMessage = "Successfully completed transaction."
                        })
                    }).catch(error => {
                        console.log("Error", error);
                        updateBookingMessage = "Unable to update findings. Please try again."
                        updateBookingStatus = "fail"
                        refreshData(req,res).then((success) => {
                            res.redirect("/appointment")
                        })
                    })
                })
    });
    await refreshData(req,res).then((success) => {
        res.redirect("/appointment")
    })
})

app.post("/update-status",async (req,res) => {
    var index = parseInt(req.body.appointmentIndex);
    var status = req.body.appointmentStatus;
    var clientName = req.session.userData.appointments[index].clientName;
    var bookingJson = {
        appointmentID: req.session.userData.appointments[index].appointmentID,
        bookingDate: req.session.userData.appointments[index].day,
        bookingPet: req.session.userData.appointments[index].petName,
        bookingStatus: req.session.userData.appointments[index].status.toLowerCase(),
        bookingTime: req.session.userData.appointments[index].time,
        dateBooked: req.session.userData.appointments[index].dateBooked,
        dateOfAppointment: req.session.userData.appointments[index].schedule,
        doctor: req.session.userData.appointments[index].doctor,
        petBreed: req.session.userData.appointments[index].petBreed,
        petType: req.session.userData.appointments[index].petType
    }
    if(req.session.userData.appointments[index].petFindings != undefined){
        bookingJson["petFindings"] = req.session.userData.appointments[index].petFindings;
    }
    if(req.session.userData.appointments[index].petPrescription != undefined){
        bookingJson["petPrescription"] = req.session.userData.appointments[index].petPrescription;
    }
    result = await db.collection("users")
            .where('name','==',clientName)
            .get().then((querySnapshot) => {
                querySnapshot.docs.forEach((document) => {
                    document.ref.update({
                        'bookings': admin.firestore.FieldValue.arrayRemove(bookingJson),
                    }).then((success1) => {
                        bookingJson.bookingStatus = status;
                        document.ref.update({
                            'bookings': admin.firestore.FieldValue.arrayUnion(bookingJson)
                        }).then((result) => {
                            updateBookingStatus = "success"
                            updateBookingMessage = "Successfully updated status."
                            refreshData(req,res);
                        })
                    }).catch(error => {
                        console.log("Error", error);
                        updateBookingMessage = "Unable to update status. Please try again."
                        updateBookingStatus = "fail"
                        refreshData(req,res).then((success) => {
                            res.redirect("/schedule")
                        })
                    })
                })
    });
    await refreshData(req,res).then((success) => {
        res.redirect("/schedule")
    })
})

app.get("/signout", (req,res) => {
    req.session.destroy();
    console.log("Logged out");
    res.redirect("/")
})


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is running on PORT ${PORT}`);
});
