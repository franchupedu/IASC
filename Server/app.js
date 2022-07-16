const express = require('express')
const socketio = require('socket.io')
const app = express()
const os = require('os');
var bodyParser = require('body-parser')
const path = require("path");
const { io } = require("socket.io-client");

const { v4: uuidv4 } = require('uuid');
const repository = require("./repositoryAdapter");

var urlencodedParser = bodyParser.urlencoded({ extended: false })

app.set('view engine', 'ejs')
app.use(express.json());
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, 'public')));
app.set("view engine", "pug");

var conections = [];

app.get('/', function(req, res)
{
    res.sendFile(__dirname + '/views/index.html');
});

app.get('/bids/:userName', function(req, res)
{
    repository.GetBids({}, (error, bidList) =>
    {
        if (error != null) 
            res.sendStatus(500);
        else
        {
            var currentBids = bidList.bids.forEach(b => b.duration = new Date(parseInt(b.startTimestamp) + parseInt(b.duration)))
            return res.render('bids', {results: bidList.bids, user: req.params.userName});
        }
            
    });
    
})

app.get('/bids', function(req, res)
{
    return res.redirect('/');
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
    buyer.tags = buyer.tags.split(',').map(s => s.trim());

    repository.PostBuyer(buyer, (error, result) => 
    {
        if (result.status != 'S') 
        {
            console.log("Error: " + result.error)
            return res.status(400).json({status: 400, message: result.error})
        }
        else
        {
            console.log("Result: " + result.status);
            return res.redirect('/bids/' + buyer.name);  
        }   
    });  
});

/* POST /bids
    {
        "bid": 
        {
            "tags": ["Inmuebles", "Jueguitos"],
            "price" : 92.5,
            "duration": 50,
            "article": "",
        }
    }
*/
app.post('/bids', function (req, res) 
{   
    var bid = req.body.bid;
    bid.id = uuidv4();
    bid.startTimestamp = + new Date();
    bid.winningSon = "None";

    repository.PostBid(bid, (error, result) =>
    {
        if (result.status != 'S') 
        {
            console.log("Error: " + result.error)
            return res.status(400).json({status: 400, message: result.error})
        }
        else
        {
            console.log("Result: " + result.status);
            notifyBuyers(bid);
            return res.send('Subasta numero agregada exitosamente');
        }
    })
});

app.get('/info', function(req, res)
{
    return res.send(`<h3>It's ${os.hostname()}</h3>`);
})

const server = app.listen(process.env.PORT || 5000, () => 
{
    console.log(`Server Started on Port 5000`)
})

//Initialize socket for the server
const ioServer = socketio(server,
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

ioServer.on('connection', socket => 
{
    conections.push(socket)

    socket.on('post_bid', newBid =>
    {       
        console.log(newBid.user);
        repository.PostNewBid({id: newBid.bidId, price: newBid.ammount, user: newBid.user}, (error, result) =>
        {
            if (result.status != 'S') 
            {
                console.log("Error: " + result.error);
                ioServer.emit('bid_updated', newBid);
            }
            else
            {
                console.log("Result: " + result.status);
                ioServer.emit('bid_updated', newBid);
            }
        });
    })

    socket.on('disconnect', function() 
    {
        var i = conections.indexOf(socket);
        conections.splice(i, 1);
     });
})

let socket = io('http://localhost:4000');

socket.on('new_bid', bid =>
{
    notifyBuyers(bid);
});

socket.on('update_bid', newBid =>
{
    ioServer.emit('bid_updated', newBid);
});


function notifyBuyers(bid)
{
    ioServer.emit('new_bid', {bid: bid})
}