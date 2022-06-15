const express = require('express')
const socketio = require('socket.io')
const app = express()
const cors = require('cors');

const { v4: uuidv4 } = require('uuid');

app.set('view engine', 'ejs')
app.use(express.static('public'))
app.use(express.json());

var buyers = [];
var conections = [];

var bids = [];

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

/* POST /bids
    {
        "bid": 
        {
            "tags": ["Inmuebles", "Jueguitos"],
            "price" : 92.5,
            "duration": 50,
            "article": ""
        }
    }
*/
app.post('/bids', function (req, res) 
{
    var bid = req.body.bid;
    bid.id = uuidv4();
    bid.bids = [];
    bids.push(bid);

    notifyBuyers(bid);

    return res.send('Subasta numero agregada exitosamente');
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

function notifyBuyers(bid)
{
    var targets = conections.filter(c => c.buyer.tags.some(t => bid.tags.includes(t)));

    console.log(targets);

    for(const target of targets)
    {
        target.socket.emit('new_bid', {article: bid.article, price: bid.price});
    }
}