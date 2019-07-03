# Poker Api Reference
Version 1

## Poker Client
The PokerClient can be initialized with a server address. After it successfully established a connection with the server, you can send and receive messages. Here is a short example:

```typescript
let client = new PokerClient("ws://1.2.3.4:8080");
client.on("ready", () => startMyClientCalls());
client.on("failed", (error) => console.log("connection failed :("));

function startMyClientCalls() {
  client.sendMessageCall("get_lobbies", (response: GetLobbiesResponse) => {
    console.log(response.lobbies);
  });
}
```

The PokerClient can emit the following meta-events:

| Event  | Description | Arguments |
|--------|-------------|-----------|
| ready  | Connection to the server got established. | - |
| error  | There was an error during the connection. | [Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error) |
| close  | The connection got closed. | - |

Apart from those meta-events it can also emit poker related commands. See [Server Events](#server-events).

You can of course also send poker commands to the server. There are two types:
* [Callback Messages](#callback-messages): those are commands consisting of a request and a response
* [One-Way Messages](#one-way-messages): those are commands that do not deliver a response, but will trigger an action on the server which might lead to another [event](#server-events)

## Callback Messages
These are function-like calls that you can send to the server with a single object argument, and get a single object in return.

**Here is an example:**<br>
exampleCommand(RequestExample):ResponseExample
```typescript
let request = new RequestExample();
request.parameter = value;
pokerClient.sendMessageCall("exampleCommand", (response: ResponseExample) => {
  console.log(response.paramter);
}, request);
```

##### get_lobbies(): GetLobbiesResponse
Returns a list of all visible lobbies.
###### GetLobbiesResponse
```typescript
{
    lobbies: LobbyPreview[]
}
```
uses: [LobbyPreview](#lobbypreview)

##### join_lobby(JoinLobbyRequest):JoinLobbyResponse
Tries to join a lobby.
###### JoinLobbyRequest
```typescript
{
  id: string, //id of lobby to join
  spectate: boolean, //if you want to spectate only, no name needed
  playerName?: string //name if not spectating (1 to 20 characters)
}
```
###### JoinLobbyResponse
```typescript
{
  success: boolean,
  reason?: "full" | "unknown_id" | "not_joinable" | "in_other_lobby",
  lobby?: Lobby //if success
}
```
uses: [Lobby](#lobby)

##### create_lobby(CreateLobbyRequest):[Lobby](#lobby)
Create a new lobby, with yourself as leader.
###### CreateLobbyRequest
```typescript
{
  name: string, //lobby name (1 to 20 characters)
  hidden: boolean, //whether the lobby is publicly visible or not
  playerName: string //your name (1 to 20 characters)
}
```

## One-Way Messages
These are commands that you can send to the server, where nothing is returned to you.

##### leave_lobby()
Disconnects you from the current lobby.

##### change_gamemode(ChangeGameModeRequest)
If you are leader of a lobby, you can change its game mode. Will trigger a lobby_update event, if successful.
###### ChangeGameModeRequest
```typescript
{
  type: GameModeType; //string with the correct game mode
}
```
uses: [GameModeType](#gamemodetype)
see: [Game Modes](#game-modes)

##### chat_out(ChatOut)
Send a chat message to all players of your current lobby.
###### ChatOut
```typescript
{
  message: string;
}
```

##### start_game()
If you are the leader of a lobby, you can start the game.

##### change_settings([Settings](#settings))
If you are the leader of a lobby, you can change game mode specific options here.

Warning: You can not change the game mode itself this way! Use chnage_gamemode instead.

## Server Events
These are messages, the server sends to you, because you are in a certain state of the game, or because you sent a [One-Way Message](#one-way-messages)

##### disconnect:DisconnectEvent
The server let's you know upfront that it is closing your connection.
###### DisconnectEvent
```typescript
{
  reason: string;
}
```

##### lobby_update:[Lobby](#lobby)
Notifies you that an attribute of your current lobby changed.

##### chat_in:ChatIn
Notifies you about an incoming chat message.
###### ChatIn
```typescript
{
  message: string;
  sender: Player;
}
```
uses: [Player](#player)

## Api Objects

##### LobbyPreview
```typescript
{
  name: string,
  id: string,
  currentPlayers: number, //number of players
  maxPlayers: number, //maximum number of players
  running: boolean, //if a game is currently running
  joinable: boolean, //if the lobby can be joined
  gameMode: string, //proper name of the current gamemode (no identifier)
  players: string[] //names of connected players
}
```

##### Lobby
```typescript
{
  name: string,
  id: string,
  currentPlayers: number, //number of connected players
  currentSpectators: number, //number of spectators (anonymous)
  hidden: boolean, //is this lobby private?
  running: boolean, //if a game is currently running
  joinable: boolean, //if the lobby can be joined
  settings: Settings, //currently selected settings
  players: Record<number, Player, //key=Player.id
  leader: number, //Player.id of the player who can edit the settings
  yourId: boolean //your id
}
```
uses: [Player](#player), [Settings](#settings)

##### Player
```typescript
{
  id: number,
  name: string
}
```

##### Settings
Abstract class only describing the type of game mode. Please cast respectively. See [Game Modes](#game-modes)
```typescript
{
  type: GameModeType,
  maxPlayers: number
}
```

##### Card
A playing card.
```typescript
{
  color: string; //d, s, h, c
  value: string; //2-10, J, Q, K, A
}
```

## Game Modes
Every game mode has its own objects and messages/events.

### Texas Hold'Em Poker (texasholdem)
#### TH One-Way Messages
##### th_action(THAction)
Perfom a player action, either after you got a notice that it is your turn or for "giveup" at any point.
###### THAction
```typescript
{
  action: "call" | "fold" | "check" | "raise" | "allin" | "giveup",
  value?: number;
}
```

#### TH Events
##### th_start:THStartGame
Notifies you that the game has started.
###### THStartGame
```typescript
{
  players: THPlayer[],
  yourIndex: number, //index of you in the above array
  settings: THSettings
}
```
uses: [THPlayer](#thplayer), [THSettings](#thsettings)

##### th_new_round:THNewRound
Notifies you that a new round/hand has started.
###### THNewRound
```typescript
{
  players: THPlayer[],
  yourIndex: number, //index of you in the above array
  yourCards: Card[],
  hand: number, //round number
  smallBlind: number,
  bigBlind: number,
  smallBlindPlayer: number, //the id of the player who is small blind
  bigBlindPlayer: number //the id of the player who is big blind
}
```
uses: [THPlayer](#thplayer), [Card](#card)

##### th_player_action:THPlayerAction
Notifies you that a player is performing an action.
"turn" means it's their turn.
###### THPlayerAction
```typescript
{
  player: THPlayer,
  action: "call" | "fold" | "check" | "raise" | "allin" | "giveup" | "turn",
  value?: string | number | Player,
}
```

##### th_your_turn:THYourTurn
It's your turn. Please respond with th_action and one of the available options. timeout tells you how much time you have until you automatically perform a fold.
###### THYourTurn
```typescript
{
  options: string[],
  minRaise: number, //min amount to for a raise
  maxRaise: number, //max amount for a raise
  firstBet: boolean, //if this is you first betting chance
  timeout: number //time in seconds
}
```

##### th_community_card:THCommunityCard
One or more community cards are being played.
###### THCommunityCard
```typescript
{
  communityCards: Card[],
  players: THPlayer[],
  pot: number
}
```
uses: [Card](#card), [THPlayer](#thplayer)

##### th_end_round:THEndRound
Notifies you of the end of the round, revealing the winners.
###### THEndRound
```typescript
{
  reason: string,
  winners: THPlayer[],
  winningCards: Card[],
  players: THPlayer[]
}
```
uses: [THPlayer](#thplayer), [Card](#card)

##### th_lost
You lost the game and are now a spectator.

##### th_end_game:THPlayer
Only one player is left: the winner of this poker game.

#### TH Api Objects

##### THPlayer
extends [Player](#player)
```typescript
{
  cards?: Card[], //may be undefined or empty
  money: number,
  bet: number,
  allIn: boolean, //whether this player is all in
  folded: boolean, //whether this player has already folded
  index: number //index in the player array
}
```

##### THSettings
extends [Settings](#settings)
```typescript
{
  startMoney: number, //min 1
  turnTime: number, //0 for unlimited
  useSidepots: boolean,
  blindsTimeInsteadOfHands: boolean, //true=use time for blinds, false=use hand for blinds
  blindsRate: number //0-10, blind increase rate
}
```
