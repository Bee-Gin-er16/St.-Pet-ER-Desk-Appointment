const express = require("express");
const app = express();
const ejs = require("ejs");
const session = require('express-session');
const admin = require("firebase-admin");
const credentials = require("./key.json");
const config = require("./config.json");
const {initializeApp} = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } = require('firebase/auth');

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

var errorMsg = "";
var signupError = "";
var signinError = "";
var licenseError = "";
var scheduleError = "";
var addStatus = "";
var addPetMessage = "";
var deletePetMessage="";
var deleteStatus;

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

app.get("/", (req,res) => {
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
            if(count == 0) {
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
        res.render("client_schedule", {username:req.session.username, userInfo: req.session.userData}); 
    }else{
        res.redirect("/");
    }
})

app.get("/appointment", (req,res) => {
    if(req.session.isLoggedIn == true){
        console.log("Logged In")
        res.render("doctor_appointment", {username:req.session.username});
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
        // if(success) res.redirect("/profile")
        console.log(req.session.userData)
        res.redirect("/profile")
    })
})

app.post("/submit-add-nooking", async (req,res) => {
    var bookingDate = req.body.bookingDate;
    var bookingTime = req.body.bookingTime;
    var bookingTimestamp;
    var bookingPet = req.body.bookingPet;
    const bookingJson = {
        bookingTimestamp: bookingTimestamp,
        bookingPet: bookingPet
    }
    await db.collection("users")
            .where('email','==',req.session.email)
            .get().then((querySnapshot) => {
                querySnapshot.docs.forEach((document) => {
                    document.ref.update({
                        'bookingList': admin.firestore.FieldValue.arrayRemove(petToDelete)
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
})

app.get("/transaction", (req,res) => {
    if(req.session.isLoggedIn == true){
        res.render("client_transaction", {userInfo:req.session.userData});
    }else{  
        res.redirect("/")
    }
})

app.get("/signout", (req,res) => {
    req.session.destroy();
    console.log("Logged out");
    // res.redirect("/")
})


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is running on PORT ${PORT}`);
});
