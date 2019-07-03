import {PokerMessage} from "./PokerMessage";
import {GameMode} from "../../src/GameMode";
import {
  IsAlphanumeric,
  IsBoolean, IsIn,
  IsInt, IsString,
  Length, Max, Min, ValidateIf,
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
  @ValidateIf(o => !o.spectate)
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
  yourId: number;
}

export class Card extends PokerMessage {
  color: string;
  value: string;
}

export class THSettings extends Settings {
  @IsInt()
  @Min(1)
  startMoney: number;
  @IsInt()
  @Min(0)
  turnTime: number;
  @IsBoolean()
  useSidepots: boolean;
  @IsBoolean()
  blindsTimeInsteadOfHands: boolean;
  @IsInt()
  @Min(0)
  @Max(10)
  blindsRate: number;
}

export class THPlayer extends Player {
  cards: Card[];
  money: number;
  bet: number;
  allIn: boolean;
  folded: boolean;
  index: number;
}

export class THStartGame extends PokerMessage {
  players: THPlayer[];
  yourIndex: number;
  settings: THSettings
}

export class THNewRound extends PokerMessage {
  players: THPlayer[];
  yourIndex: number;
  yourCards: Card[];
  hand: number;
  smallBlind: number;
  bigBlind: number;
  smallBlindPlayer: number;
  bigBlindPlayer: number;
}

export type THPlayerActionType = "call" | "fold" | "check" | "raise" | "allin" | "giveup" | "turn";

export class THPlayerAction extends PokerMessage {
  player: THPlayer;
  action: THPlayerActionType;
  value?: string | number | Player;
}

export class THYourTurn extends PokerMessage {
  options: string[];
  timeout: number;
  minRaise: number;
  maxRaise: number;
  firstBet: boolean;
}

export class THAction extends PokerMessage {
  @IsString()
  @IsIn(["call", "fold", "check", "raise", "allin", "giveup"])
  action: "call" | "fold" | "check" | "raise" | "allin" | "giveup";
  @ValidateIf((o) => o.action==="raise")
  @IsInt()
  value?: number;
}

export class THCommunityCard extends PokerMessage {
  communityCards: Card[];
  players: THPlayer[];
  pot: number;
}

export class THEndRound extends PokerMessage {
  reason: string;
  winners: THPlayer[];
  winningCards: Card[];
  players: THPlayer[];
}

export class JoinLobbyResponse extends PokerMessage {
  success: boolean;
  reason?: "full" | "unknown_id" | "not_joinable" | "in_other_lobby";
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
  message: string;
  sender: Player;
}