import {api, deleteLobby} from "./Game"
import {User} from "./User";
import {Player} from "./Player";
import {Spectator} from "./Spectator";
import {GameMode} from "./GameMode";
import {TexasHoldEm} from "./TexasHoldEm/TexasHoldEm";
import {
  LobbyPreview,
  Lobby as ApiLobby,
  Player as ApiPlayer,
  ChangeGameModeRequest, ChatOut, ChatIn
} from "../pokerapi/messages/ApiObjects";
import {Command, PokerMessage, ServerCommand} from "../pokerapi/messages/PokerMessage";
import {EventEmitter} from "events";

export class Lobby extends EventEmitter {

  players = new Map<number, Player>();
  spectators = new Map<number, Spectator>();
  gameMode: GameMode;

  constructor(public id:string, public leader: User, public name: string, public hidden: boolean) {
    super();

    this.gameMode = new TexasHoldEm(this);
    this.registerListeners();
  }

  spectate(id: number) {
    this.spectators.set(id, new Spectator(id));
  }

  join(id: number, name: string) {
    this.players.set(id, new Player(id, name));
    this.sendLobbyUpdate();
  }

  private registerListeners() {

    api.onLobby(this.id, "drop_user", (id: number) => {
      if (this.spectators.has(id)) {
        this.spectators.delete(id);
      } else if (this.players.has(id)) {
        this.dropPlayer(id);
      }
    });

    api.onLobby(this.id, "leave_lobby", (id) => {
      this.dropPlayer(id);
    });

    api.onLobby(this.id,"change_gamemode", (id: number, req: ChangeGameModeRequest) => {
      //check for permissions
      if (id != this.leader.id) return;

      switch (req.type) {
        case "texasholdem":
          this.gameMode = new TexasHoldEm(this); break;
      }
      this.sendLobbyUpdate();
    });

    api.onLobby(this.id, "chat_out", (id, req: ChatOut) => {
      //check for permission (only players can chat)
      if (!this.players.has(id)) return;

      let response = new ChatIn();
      response.message = req.message;
      response.sender = this.players.get(id).apiPlayer();
      //broadcast to all members
      this.broadcastMembers("chat_in", response);
    })
  }

  public broadcastMembers(command: Command | ServerCommand, message: PokerMessage) {
    this.broadcastSpectators(command, message);
    this.broadcastPlayers(command, message)
  }

  public broadcastSpectators(command: Command | ServerCommand, message: PokerMessage) {
    for (let id of this.spectators.keys()) {
      api.sendMessage(id, command, message);
    }
  }

  public broadcastPlayers(command: Command | ServerCommand, message: PokerMessage) {
    for (let id of this.players.keys()) {
      api.sendMessage(id, command, message);
    }
  }

  public sendLobbyUpdate() {
    let apiLobby = this.apiLobby(-1);
    for (let id of this.spectators.keys()) {
      api.sendMessage(id, "lobby_update", apiLobby);
    }
    for (let id of this.players.keys()) {
      apiLobby.yourId = id;
      api.sendMessage(id, "lobby_update", apiLobby);
    }
  }

  private dropPlayer(id: number) {
    this.players.delete(id);
    api.removeUserFromLobby(this.id, id);
    if (this.players.size == 0) {
      deleteLobby(this.id);
      return;
    }
    if (this.leader.id == id) {
      //set new leader
      this.leader.id = this.players.keys().next().value;
    }
    this.sendLobbyUpdate();
  }


  //===Api Converters===
  apiLobbyPreview():LobbyPreview {
    let players = [];
    for (let player of this.players.values()) {
      players.push(player.name);
    }
    return {
      name: this.name,
      id: this.id,
      currentPlayers: this.players.size,
      maxPlayers: this.gameMode.getMaxPlayers(),
      running: this.gameMode.isRunning(),
      joinable: this.gameMode.isJoinable(),
      gameMode: this.gameMode.getName(),
      players: players
    }
  }
  apiLobby(id: number):ApiLobby {
    let playerMap = new Map<number, ApiPlayer>();
    for (let [id, player] of this.players) {
      playerMap.set(id, player.apiPlayer());
    }
    return {
      name: this.name,
      id: this.id,
      currentPlayers: this.players.size,
      currentSpectators: this.spectators.size,
      hidden: this.hidden,
      running: this.gameMode.isRunning(),
      joinable: this.gameMode.isJoinable(),
      settings: this.gameMode.apiSettings(),
      availableGamemodes: GameMode.availableGamemodes,
      players: playerMap,
      leader: this.leader.id,
      yourId: id
    }
  }
}