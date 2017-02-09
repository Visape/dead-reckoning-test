// http://socket.io/get-started/chat/
const express = require('express')
var app = express()
var http = require('http').Server(app)
var io = require('socket.io')(http)
const randomColor = require('randomcolor')

/*
// middleware
app.use(function (req, res, next) {
    console.log(arguments)
    next()
})
*/

app.use(express.static('public'))

const ACCEL = 1 / 500

class GameServer {
  constructor () {
    this.players = {}
    this.coins = {}
    this.lastCoin = 0
    this.coinCount = 0

    for (let i = 0; i < 5; ++i) {
      const coin = {
        id: this.lastCoin,
        x: Math.random() * 500,
        y: Math.random() * 500,
        value: Math.floor(Math.random() * 5) + 1
      }
      this.coins[this.lastCoin] = coin
      ++this.lastCoin
      ++this.coinCount
    }
  }

  onCoinSpawn () {
    if (this.coinCount < 10) {
      const coin = {
        id: this.lastCoin,
        x: Math.random() * 500,
        y: Math.random() * 500,
        value: Math.floor(Math.random() * 5) + 1
      }
      this.coins[this.lastCoin] = coin
      ++this.lastCoin
      ++this.coinCount

      io.sockets.emit('coin respawn', coin)
    }
  }

  onPlayerConnected (socket) {
    console.log(`${socket.id} connected`)
    const inputs = {
      LEFT_ARROW: false,
      RIGHT_ARROW: false,
      UP_ARROW: false,
      DOWN_ARROW: false
    }

    const player = {
      x: Math.random() * 500,
      y: Math.random() * 500,
      vx: 0,
      vy: 0,
      color: randomColor(),
      id: socket.id,
      score: 0,
      inputs
    }
    this.players[socket.id] = player

    socket.emit('world:init', this.players, socket.id, this.coins)

    // so that the new players appears on other people's screen
    this.onPlayerMoved(socket, inputs)
  }

  onPlayerMoved (socket, inputs) {
    console.log(inputs)
    console.log(`${new Date()}: ${socket.id} moved`)
    const player = this.players[socket.id]
    player.timestamp = Date.now()
    player.inputs = inputs
    io.sockets.emit('playerMoved', player)
  }

  onCoinPicked (coinId, playerId) {
    this.players[playerId].score += this.coins[coinId].value
    --this.coinCount
    delete this.coins[coinId]
    io.sockets.emit('coinPicked', coinId, playerId)
  }

  onPlayerDisconnected (socket) {
    console.log(`${socket.id} disconnected`)
    delete this.players[socket.id]
    socket.broadcast.emit('playerDisconnected', socket.id)
  }

  logic (delta) {
    const vInc = ACCEL * delta
    for (let playerId in this.players) {
      const player = this.players[playerId]
      const { inputs } = player
      if (inputs.LEFT_ARROW) player.vx -= vInc
      if (inputs.RIGHT_ARROW) player.vx += vInc
      if (inputs.UP_ARROW) player.vy -= vInc
      if (inputs.DOWN_ARROW) player.vy += vInc

      player.x += player.vx * delta
      player.y += player.vy * delta

      for (let coinId in this.coins) {
        let deltax = (this.players[playerId].x-this.coins[coinId].x)
        let deltay = (this.players[playerId].y-this.coins[coinId].y)
        if ((-50 <= deltax) && (deltax <= 40) && (-50 <= deltay) && (deltay <= 40)) {
          this.onCoinPicked(coinId, playerId)
        }
      }
    }
  }
}

io.on('connection', function (socket) {

  game.onPlayerConnected(socket)

  // let lastPongTimestamp
  // let ping = 50
  socket.on('game:ping', () => {
    // lastPongTimestamp = Date.now()
    socket.emit('game:pong', Date.now())
  })
  socket.on('game:pung', () => {
    // ping = (Date.now() - lastPongTimestamp) / 2
  })

  socket.on('move', (inputs) => {
    game.onPlayerMoved(socket, inputs)
  })

  socket.on('disconnect', () => {
    game.onPlayerDisconnected(socket)
  })
})

setInterval(function () {
    game.onCoinSpawn()
  }, 10000)

const game = new GameServer()
let past = Date.now()
setInterval(function () {
  const now = Date.now()
  const delta = now - past
  past = now
  game.logic(delta)
}, 20)


http.listen(process.env.PORT || 3000, function () {
  console.log('listening on *:3000')
})