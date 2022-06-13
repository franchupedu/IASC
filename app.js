const express = require('express')
const socketio = require('socket.io')
const app = express()
const cors = require('cors');

app.set('view engine', 'ejs')
app.use(express.static('public'))
app.use(express.json());

var buyers = [];
var conections = [];

/* POST /buyers
    {
        "buyer": {
            "name": "Test User",
            "ip" : "192.180.55.66",
            "tags": ["Inmuebles", "Jueguitos"]
        }
    }
*/
app.post('/buyers', function (req, res) 
{
    var buyer = req.body.buyer;
    buyers.push(buyer);

    return res.send('Comprador '+ buyer.name + ' agregado exitosamente');    
});

const server = app.listen(process.env.PORT || 3000, () => 
{
    console.log("Server is running")
})

//Initialize socket for the server
const io = socketio(server,
    {
        cors: {
            origin: "http://localhost:3000",
            methods: ["GET", "POST"],
            transports: ['websocket', 'polling'],
            credentials: true
        },
        allowEIO3: true
    }
);

io.on('connection', socket => 
{
    socket.username = "Anonymous";

    socket.on('register_buyer', buyer => 
    {
        if(Object.keys(buyers.find(b => b.name == buyer.name)).length != 0)
        {
            conections.push({buyer: buyer, socket: socket});
            socket.username = buyer.name;
            console.log("New user " + socket.username + " connected");
        }
        else
            socket.emit('error', "You first need to register via POST to /buyers");
    })
})