/* globals requestAnimationFrame, io */
const kbd = require('@dasilvacontin/keyboard')
const deepEqual = require('deep-equal')

const socket = io()

let myPlayerId = null
const myInputs = {
  LEFT_ARROW: false,
  RIGHT_ARROW: false,
  UP_ARROW: false,
  DOWN_ARROW: false
}

const ACCEL = 1 / 500

class GameClient {
  constructor () {
    this.players = {}
    this.coins = {}
  }

  onWorldInit (serverPlayers, serverCoins) {
    this.players = serverPlayers
    this.coins = serverCoins
  }

  onCoinRespawn (coin) {
    this.coins[coin.id] = coin
  }

  onPlayerMoved (player) {
    //console.log(player)
    this.players[player.id] = player

    const delta = (Date.now() + clockDiff) - player.timestamp

        // increment position due to current velocity
        // and update our velocity accordingly
    player.x += player.vx * delta
    player.y += player.vy * delta

    const { inputs } = player
    if (inputs.LEFT_ARROW && !inputs.RIGHT_ARROW) {
      player.x -= ACCEL * Math.pow(delta, 2) / 2
      player.vx -= ACCEL * delta
    } else if (!inputs.LEFT_ARROW && inputs.RIGHT_ARROW) {
      player.x += ACCEL * Math.pow(delta, 2) / 2
      player.vx += ACCEL * delta
    }
    if (inputs.UP_ARROW && !inputs.DOWN_ARROW) {
      player.y -= ACCEL * Math.pow(delta, 2) / 2
      player.vy -= ACCEL * delta
    } else if (!inputs.UP_ARROW && inputs.DOWN_ARROW) {
      player.y += ACCEL * Math.pow(delta, 2) / 2
      player.vy += ACCEL * delta
    }
  }

  onPlayerDisconnected (playerId) {
    delete this.players[playerId]
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
    }
  }
}
const game = new GameClient()

function updateInputs () {
  const oldInputs = Object.assign({}, myInputs)

  for (let key in myInputs) {
    myInputs[key] = kbd.isKeyDown(kbd[key])
  }

  if (!deepEqual(myInputs, oldInputs)) {
    socket.emit('move', myInputs)

    // update our local player' inputs so that we see instant change
    // (inputs get taken into account in logic simulation)
    const myPlayer = game.players[myPlayerId]
    myPlayer.inputs = Object.assign({}, myInputs)
  }
}

const canvas = document.createElement('canvas')
canvas.width = window.innerWidth
canvas.height = window.innerHeight
document.body.appendChild(canvas)

const ctx = canvas.getContext('2d')

function gameRenderer (game) {
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight)

  for (let playerId in game.players) {
    const { color, x, y } = game.players[playerId]
    ctx.fillStyle = color
    ctx.fillRect(x, y, 50, 50)
    if (playerId === myPlayerId) {
      ctx.strokeRect(x, y, 50, 50)
      for (let coinId in game.coins) {
        let deltax = (x-game.coins[coinId].x)
        let deltay = (y-game.coins[coinId].y)
        if ((-50 <= deltax) && (deltax <= 40) && (-50 <= deltay) && (deltay <= 40)) {

          console.log("MONEDA TOCADA")
          delete game.coins[coinId]
          //AVISAR AL SERVIDOR
          socket.emit('coin:picked', coinId)
        } 
      }
    }
  }
  
  for (let coinId in game.coins) {
    var coinImage = new Image()
    coinImage.src = 'images/moneda.png'

    ctx.drawImage(coinImage, game.coins[coinId].x, game.coins[coinId].y, 40, 40);
  }
}

let past = Date.now()
function gameloop () {
  requestAnimationFrame(gameloop)


  const now = Date.now()
  const delta = now - past
  past = now

  updateInputs()
  game.logic(delta)
  gameRenderer(game)
}

let lastPingTimestamp
let clockDiff = 0 // how many ms the server is ahead from us
let ping = Infinity

function startPingHandshake () {
  lastPingTimestamp = Date.now()
  socket.emit('game:ping')
}
setInterval(startPingHandshake, 250)

socket.on('connect', function () {
  socket.on('world:init', function (serverPlayers, myId, serverCoins) {
    game.onWorldInit(serverPlayers, serverCoins)
    myPlayerId = myId
  })
  socket.on('playerMoved', game.onPlayerMoved.bind(game))
  socket.on('coin respawn', function (coin) {
    game.onCoinRespawn(coin)
  })
  socket.on('playerDisconnected', game.onPlayerDisconnected.bind(game))

  socket.on('game:pong', (serverNow) => {
    ping = (Date.now() - lastPingTimestamp) / 2
    clockDiff = (serverNow + ping) - Date.now()
    //console.log({ ping, clockDiff })
  })
})

requestAnimationFrame(gameloop)