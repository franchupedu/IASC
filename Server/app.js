const express = require('express')
const socketio = require('socket.io')
const app = express()
const cors = require('cors');
const os = require('os');
var bodyParser = require('body-parser')
const path = require("path");
const router = express.Router();

const { v4: uuidv4 } = require('uuid');

var urlencodedParser = bodyParser.urlencoded({ extended: false })

app.set('view engine', 'ejs')
app.use(express.json());
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, 'public')));
app.set("view engine", "pug");

var buyers = [];
var conections = [];

var bids = [];

app.get('/', function(req, res)
{
    res.sendFile(__dirname + '/views/index.html');
});

app.get('/bids', function(req, res)
{
    console.log(bids)
    return res.render('bids', {results: bids});
})

/* POST /buyers
    {
        "buyer": {
            "name": "Test User",
            "ip" : "192.180.55.66",
            "tags": ["Inmuebles", "Jueguitos"]
        }
    }
*/
app.post('/buyers', urlencodedParser, function (req, res) 
{
    var buyer = req.body;
    buyers.push(buyer);

    return res.redirect('/bids');    
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

app.get('/info', function(req, res)
{
    return res.send(`<h3>It's ${os.hostname()}</h3>`);
})

const server = app.listen(process.env.PORT || 5000, () => 
{
    console.log(`Server Started on Port  5000`)
})

//Initialize socket for the server
const io = socketio(server,
    {
        cors: {
            origin: "http://localhost:5000",
            methods: ["GET", "POST"],
            transports: ['websocket', 'polling'],
            credentials: true
        },
        allowEIO3: true
    }
);

io.on('connection', socket => 
{
    console.log("User connected");

    socket.username = "Anonymous";

    conections.push(socket)

    socket.on('post_bid', newBid =>
    {
        console.log(newBid.bidId);
        console.log(newBid.ammount);
        
        validateBid(newBid.bidId, newBid.ammount).then( res =>
        {
            bids.filter(b => b.id == newBid.bidId)[0].price = newBid.ammount
            console.log(bids)
            io.emit('bid_updated', newBid)
        })
    })
})

function notifyBuyers(bid)
{
    console.log(conections.length);

    io.emit('new_bid', {bid: bid})
}

function validateBid(bidId, ammount)
{
    return new Promise((resolve, reject) => 
    {
        resolve ();
    })
}