const socketio = require('socket.io');
const { io } = require("socket.io-client");
const axios = require('axios')

console.log("Conecting");
let socket = io('http://localhost:3000');

const buyer = 
{
    "buyer": 
    {
        "name": "Test User",
        "ip" : "192.180.55.66",
        "tags": ["Inmuebles", "Jueguitos"]
    }
}

axios.post('http://localhost:3000/buyers', buyer).then((res) =>
{
    console.log(res.data);
    socket.emit('register_buyer', buyer.buyer);
})
.catch((err) =>
{
    console.log(err);
});

socket.on('error', err => 
{
    console.log(err);
});