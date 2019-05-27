import {PokerMessage} from "./PokerMessage";
import {Type} from "class-transformer";
import {
  IsAlphanumeric,
  IsBoolean, IsIn,
  IsInt,
  IsString, Length,
  ValidateIf,
  ValidateNested
} from "class-validator";

export class DisconnectEvent {
  reason: string;
}

export class LobbyPreview {
  name: string;
  id: string;
  currentPlayers: number;
  maxPlayers: number;
  gameMode: string;
  players: string[];
}

export class GetLobbiesResponse extends PokerMessage {
  lobbies: LobbyPreview[]
}

export class JoinLobbyRequest extends PokerMessage {
  @IsAlphanumeric()
  id: string;
  @IsBoolean()
  spectate: boolean;
  @Length(1, 20)
  playerName?: string;
}

export class Player {
  id: number;
  name: string;
}

export class GameMode {
  type: string;
  maxPlayers: number;
}

export class Lobby extends PokerMessage {
  name: string;
  id: string;
  currentPlayers: number;
  currentSpectators: number;
  hidden: boolean;
  gameMode: GameMode;
  players: Map<number, Player>; //key=Player.id
  leader: number; //Player.id
  youAreLeader: boolean;
}

export class TexasHoldEm extends GameMode {
  //TODO add texas hold'em options
}

export class JoinLobbyResponse extends PokerMessage {
  success: boolean;
  reason?: "full" | "unknown_id" | "no_name";
  lobby?: Lobby;
}

export class CreateLobbyRequest extends PokerMessage {
  @Length(1, 20)
  name: string;
  @IsBoolean()
  hidden: boolean;
  @Length(1, 20)
  playerName: string;
}