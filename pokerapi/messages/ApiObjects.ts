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

export class LobbyPreview {
  @IsString()
  name: string;
  @IsInt()
  id: string;
  @IsInt()
  currentPlayers: number;
  @IsInt()
  maxPlayers: number;
  @IsString()
  gameMode: string;
  @IsString({each: true})
  players: string[];
}

export class GetLobbiesResponse extends PokerMessage {
  @ValidateNested({each: true})
  @Type(() => LobbyPreview)
  lobbies: LobbyPreview[]
}

export class JoinLobbyRequest extends PokerMessage {
  @IsString()
  id: string;
  @IsBoolean()
  spectate: boolean;
  @Length(1, 20)
  playerName?: string;
}

export class Player {
  @IsInt()
  id: number;
  @Length(1, 20)
  name: string;
}

export class GameMode {
  @IsString()
  type: string;
  @IsInt()
  maxPlayers: number;
}

export class Lobby extends PokerMessage {
  @IsString()
  name: string;
  @IsAlphanumeric()
  id: string;
  @IsInt()
  currentPlayers: number;
  @IsInt()
  currentSpectators: number;
  @IsBoolean()
  hidden: boolean;
  @ValidateNested()
  @Type(() => GameMode)
  gameMode: GameMode;
  @ValidateNested({each: true})
  @Type(() => Player)
  players: Map<number, Player>; //key=Player.id
  @IsInt()
  leader: number; //Player.id
  @IsBoolean()
  youAreLeader: boolean;
}

export class TexasHoldEm extends GameMode {
  //TODO add texas hold'em options
}

export class JoinLobbyResponse extends PokerMessage {
  @IsBoolean()
  success: boolean;
  @ValidateIf(o => !o.success)
  @IsIn(["full", "unknown_id", "no_name"])
  reason?: "full" | "unknown_id" | "no_name";
  @ValidateIf(o => o.success)
  @ValidateNested()
  @Type(() => Lobby)
  lobby?: Lobby;
}

export class CreateLobbyRequest extends PokerMessage {

}