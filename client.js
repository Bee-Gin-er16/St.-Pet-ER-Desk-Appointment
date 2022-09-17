class Client{
    constructor(name,password){
        this.name = name;
        this.password = password;
        console.log(name);
        console.log(password);

    }

    display(){
        return `Client name: ${this.name} Client password: ${this.password}`;
    }
}

function getdata(){
    let jname = document.getElementById("user-name").value;
    let jpass = document.getElementById("psw").value;
    if(jpass != document.getElementById("psw-repeat").value | document.getElementById("psw-repeat").innerHTML.length === 0){
        console.log("Confirm password not the same or is empty");
    }
    const client1 = new Client(jname, jpass);
    // console.log(jname);
    // console.log(jpass);
    console.log(client1.display());
}