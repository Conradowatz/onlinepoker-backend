import {User} from "./User";
import {Player} from "./Player";
import {Spectator} from "./Spectator";
import {GameMode} from "./GameMode";
import {TexasHoldEm} from "./TexasHoldEm";
import {LobbyPreview, Lobby as ApiLobby, Player as ApiPlayer} from "../pokerapi/messages/ApiObjects";

export class Lobby {

  players = new Map<number, Player>();
  spectators = new Map<number, Spectator>();
  running: boolean;
  gameMode: GameMode;
  maxPlayers: number;

  constructor(public id:string, public leader: User, public name: string, public hidden: boolean) {
    this.gameMode = new TexasHoldEm();
    this.running = false;
  }

  spectate(id: number) {
    this.spectators.set(id, new Spectator(id));
  }

  join(id: number, name: string) {
    this.players.set(id, new Player(id, name));
  }

  apiLobbyPreview():LobbyPreview {
    let players = [];
    for (let player of this.players.values()) {
      players.push(player.name);
    }
    return {
      name: this.name,
      id: this.id,
      currentPlayers: this.players.size,
      maxPlayers: this.maxPlayers,
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
      gameMode: this.gameMode.apiGameMode(),
      players: playerMap,
      leader: this.leader.id,
      youAreLeader: id == this.leader.id
    }
  }
}