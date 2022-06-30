const express = require('express')
const socketio = require('socket.io')
const app = express()
const os = require('os');
var bodyParser = require('body-parser')
const path = require("path");

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

app.get('/bids', function(req, res)
{
    repository.GetBids({}, (error, bidList) =>
    {
        if (error != null) 
            res.sendStatus(500);
        else
        {
            return res.render('bids', {results: bidList.bids});
        }
            
    });
    
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
            return res.redirect('/bids');  
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
            "article": ""
        }
    }
*/
app.post('/bids', function (req, res) 
{   
    var bid = req.body.bid;
    bid.id = uuidv4();
    bid.startTimestamp = + new Date();

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

    conections.push(socket)

    socket.on('post_bid', newBid =>
    {        
        repository.PostNewBid({id: newBid.bidId, price: newBid.ammount}, (error, result) =>
        {
            if (result.status != 'S') 
            {
                console.log("Error: " + result.error);
                io.emit('bid_updated', newBid);
            }
            else
            {
                console.log("Result: " + result.status);
                io.emit('bid_updated', newBid);
            }
        });
    })
})

function notifyBuyers(bid)
{
    io.emit('new_bid', {bid: bid})
}