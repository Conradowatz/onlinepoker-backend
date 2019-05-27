# Poker Api Reference
Version 1

## Api Objects

### LobbyPreview
```typescript
{
  name: string,
  id: string,
  currentPlayers: number, //number of players
  maxPlayers: number, //maximum number of players
  gameMode: string, //name of the current gamemode
  players: string[] //names of connected players
}
```

### Lobby
```typescript
{
  name: string,
  id: string,
  currentPlayers: number, //number of connected players
  currentSpectators: number, //number of spectators (anonymous)
  hidden: boolean, //is this lobby private?
  gameMode: GameMode,
  players: Map<number, [Player](#Player)>, //key=Player.id
  leader: number, //Player.id
  youAreLeader: boolean //whether or not you are leader and can edit lobby options
}
```
uses: [Player](#Player), [GameMode](#GameMode)

### Player
```typescript
{
  id: number,
  name: string
}
```

### GameMode
Abstract interface only describing the type of GameMode. Please cast respectively.
```typescript
{
  type: "texasholdem" | "other"
  maxPlayers: number
}
```
#### TexasHoldEm extends GameMode
```typescript
{
  type: "texasholdem"
  maxPlayers: number
  //TODO add texas hold'em options
}
```

## Api Functions
These are function-like calls that you can send to the server with a single object argument, and get a single object in return.
### get_lobbies(): [GetLobbiesResponse](#GetLobbiesResponse)
Returns a list of all visible lobbies.
#### GetLobbiesResponse
```typescript
{
    lobbies: LobbyPreview[]
}
```
uses: [LobbyPreview](#LobbyPreview)

### join_lobby([JoinLobbyRequest](#JoinLobbyRequest)):[JoinLobbyResponse](#JoinLobbyResponse)
Tries to join a lobby.
### JoinLobbyRequest
```typescript
{
  id: string, //id of lobby to join
  spectate: boolean, //if you want to spectate only, no name needed
  playerName?: string //name if not spectating
}
```

## Api Calls
These are commands that you can send to the server, where nothing is returned to you.

## Api Hooks
These are messages, the server sends to you, because you are in a certain state of the game. You can not trigger these hooks manually.

### lobby_update: [Lobby](#Lobby)
