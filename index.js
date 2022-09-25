const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const Database = require('@replit/database');

const PORT = process.env.PORT || 3001;

const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const db = new Database();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(__dirname + '/public'))

function findMatches() {
    let matches = [];
    db.list().then(keys => {
    	for (key in keys) {
    		db.get(keys[key]).then(value => {
    			console.log(value); 
    			if (value.match === -1) {
    				matches.push(value);
    			}
    		});
    	}
    });
    return matches;
}

var matches = findMatches();
app.get('/favicon.png', (req, res) => {
    res.sendFile(__dirname + '/favicon.png');
});

app.get('/', (req, res) => {
	if (req.cookies.user !== undefined) {
		db.list().then(keys => {
			if (keys.includes(req.cookies.user)) {
				db.get(req.cookies.user).then(value => {
					if (value.match === -1) {
						console.log('Redirecting / to loading.html');
						res.sendFile(__dirname + '/loading.html');
						return;
					} else {
						console.log('Redirecting / to chat.html');
						res.sendFile(__dirname + '/chat.html');
						return;
					}
				});
			} else {
				console.log('Redirecting / to register.html');
				res.sendFile(__dirname + '/register.html');
			}
		});
	} else {
		console.log('Redirecting / to register.html');
		res.sendFile(__dirname + '/register.html');
	}
});

app.get('/test', (req, res) => {
	res.sendFile(__dirname + '/chat.html');
});

app.post('/register', (req, res) => {
	console.log(req.body);
	let cookie = parseInt(Math.random() * 99999);
	console.log(`New entry: ${cookie}`);
	let entry = {
		id: cookie,
		imie: req.body.imie,
		wiek: req.body.wiek,
		plec: req.body.plec,
		jezyk: req.body.jezyk,
		umiem: req.body.umiem,
		potrzebuje: req.body.potrzebuje,
        zainteresowanie: req.body.zainteresowanie,
		match: -1
	};
	db.set(cookie, entry).then(() => {
		res.cookie('user', cookie).redirect('/');
		matches.push(entry);
	});
});



setInterval(function() {
    if(matches.length < 4)
        return;
    console.log(matches)
    
	let create_matches = matches;
	let matrix = [...Array(matches.length)].map(_=>Array(matches.length).fill(0));
    for(let i = 0; i < matches.length; i++) {
        for(let j = 0; j < matches.length; j++) {
            if(i == j) {
                matrix[i][j] = -10000;
            } else {
                matrix[i][j] = evaluatePair(matches[i], matches[j]);                
            }
        }
    }
    for(let k = 0; k < (matches.length-1) / 2; k++) {
        let max = -100000;
        let max_i = 0;
        let max_j = 0;
        for(let i = 0; i < matches.length; i++) {
            for(let j = 0; j < matches.length; j++) {
                if(matrix[i][j] > max) {
                    max = matrix[i][j]
                    max_i = i;
                    max_j = j;
                }
            }
        }
    
        matches[max_i].match = matches[max_j].id;
		matches[max_j].match = matches[max_i].id;
        db.set(matches[max_i].id, matches[max_i]).then(() => {});
		db.set(matches[max_j].id, matches[max_j]).then(() => {});
        console.log(`Matched: ${matches[max_i].id} -> ${matches[max_j].id}`);
        for(let i = 0; i < matches.length; i++) {
            matrix[max_i][i] = 0;
            matrix[i][max_j] = 0;
        }
        console.log(matrix)
    }
    matches = findMatches();
    
	/*while (matches.length >= 2) {
		matches[0].match = matches[1].id;
		matches[1].match = matches[0].id;
		db.set(matches[0].id, matches[0]).then(() => {});
		db.set(matches[1].id, matches[1]).then(() => {});
		console.log(`Matched: ${matches[0].id} -> ${matches[1].id}`);
		matches[0] = matches[matches.length - 1];
		matches.pop();
		matches[0] = matches[matches.length - 1];
		matches.pop();
		if (matches.length == 1) {
			console.log(`One match left`);
		}
	}*/
}, 30_000);

server.listen(PORT, () => {
	console.log('Server is running on port: ' + PORT);
});

function evaluatePair(userA, userB) {
    let points = 0;
    if(userA === null || userB === null) {
        return -10000;
    }
    
    if(userA.umiem.length == 2 && userB.potrzebuje.length >= 1) {
            points +=  400;
    } else {
        if(userB.potrzebuje.includes(userA.umiem)) {
            points +=  400;
        }
    }
    if(userB.umiem.length == 2 && userA.potrzebuje.length === 0) {
            points -=  400;
    } else {
        if(!userA.potrzebuje.includes(userB.umiem)) {
            points -=  400;
        }
    }
    if(userA.zainteresowanie.includes(userB.zainteresowanie)) {
        points += 300;
    }
    if(Math.abs(parseInt(userA.wiek) - parseInt(userB.wiek) >= 3)) {
        points += 200
    }
    else if(Math.abs(parseInt(userA.wiek) - parseInt(userB.wiek) >= 5)) {
        points += 150
    }
    else if(Math.abs(parseInt(userA.wiek) - parseInt(userB.wiek) >= 10)) {
        points += 100
    }
    else if(Math.abs(parseInt(userA.wiek) - parseInt(userB.wiek) >= 15)) {
        points += 50
    }
    points += 100 * (userA.plec === userB.plec)

    return points;
}
io.on('connection', (socket) => {

    
    socket.on('disconnect', () => {
      io.emit('send message', {message: `${socket.data.imie} opuścił czat`, user:"[System]"})
   }); 

    
	socket.on('new message', (msg) => {
		console.log(msg);
		db.get(socket.username).then(value => {
			io.to(socket.msgChannel).emit('send message', {
				message: msg,
				user: value.imie
			});
		});
	});

	socket.on('new user', (usr) => {
		socket.username = usr;
		console.log(socket.username);
		db.get(socket.username).then(value => {
			let channel =
				Math.min(value.id, value.match) * 1000000 +
				Math.max(value.id, value.match);
			socket.join(channel);
			socket.msgChannel = channel;
            socket.data = value
			console.log(`User ${value.id} joined channel ${channel}`);
			io.to(socket.msgChannel).emit('send message', {
				message: `${value.imie} dołączył do czatu`,
				user: '[System]'
			});
            db.get(value.match).then(value => {
                io.to(socket.msgChannel).emit('send buddy', {
    				buddy: value.imie
    			});
                console.log(`send buddy ${value.imie}`)
            
		    });
        });
	});
});