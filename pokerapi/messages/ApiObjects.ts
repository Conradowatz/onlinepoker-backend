import {PokerMessage} from "./PokerMessage";
import {GameMode} from "../../src/GameMode";
import {
  Equals,
  IsAlphanumeric,
  IsBoolean, IsIn,
  IsInt, IsString,
  Length, Min,
} from "class-validator";

export class DisconnectEvent {
  reason: string;
}

export class LobbyPreview {
  name: string;
  id: string;
  currentPlayers: number;
  maxPlayers: number;
  running: boolean;
  joinable: boolean;
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

export type GameModeType = "texasholdem";

export class Settings extends PokerMessage {
  @IsIn(GameMode.availableGamemodes)
  gameMode: GameModeType;
  @IsInt()
  @Min(1)
  maxPlayers: number;
}

export class Lobby extends PokerMessage {
  name: string;
  id: string;
  currentPlayers: number;
  currentSpectators: number;
  hidden: boolean;
  running: boolean;
  joinable: boolean;
  settings: Settings;
  availableGamemodes: string[];
  players: Map<number, Player>; //key=Player.id
  leader: number; //Player.id
  youAreLeader: boolean;
}

export class TexasHoldEmSettings extends Settings {
  @IsInt()
  @Min(1)
  startMoney: number;
  @IsInt()
  @Min(0)
  turnTime: number;
  @IsBoolean()
  useSidepots: boolean;
  @IsInt({each: true})
  @Min(1, {each: true})
  blinds: Map<number, number>;
}

export class JoinLobbyResponse extends PokerMessage {
  success: boolean;
  reason?: "full" | "unknown_id" | "not_joinable";
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

export class ChangeGameModeRequest extends PokerMessage {
  @IsIn(GameMode.availableGamemodes)
  type: GameModeType;
}

export class ChatOut extends PokerMessage {
  @IsString()
  message: string;
}

export class ChatIn extends PokerMessage {
  @IsString()
  message: string;
  sender: Player;
}