import {User} from "./User";
import {Player} from "./Player";
import {Spectator} from "./Spectator";
import {GameMode} from "./GameMode";
import {TexasHoldEm} from "./TexasHoldEm";
import {LobbyListItem} from "../pokerapi/messages/ApiObjects";

export class Lobby {

  users = Array<User>();
  players = Array<Player>();
  spectator = Array<Spectator>();
  running: boolean;
  gameMode: GameMode;
  maxPlayers: number;

  constructor(public id:string, public leader: User, public name: string, public hidden: boolean) {
    this.gameMode = new TexasHoldEm();
    this.running = false;
  }

  toLobbyListItem():LobbyListItem {
    return {
      name: this.name,
      id: this.id,
      currentPlayers: this.users.length,
      maxPlayers: this.maxPlayers
    }
  }
}