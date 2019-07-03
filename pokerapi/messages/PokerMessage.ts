import {Type} from "class-transformer";
import {IsAlphanumeric, IsDefined, IsIn, IsOptional, ValidateIf} from "class-validator";

export class PokerMessage {

}

export type Command =
  "get_lobbies"
  | "join_lobby"
  | "create_lobby"
  ;

export type ClientCommand =
  "change_settings"
  | "change_gamemode"
  | "start_game"
  | "chat_out"
  | "leave_lobby"
  | "th_action"
  ;

export type ServerCommand =
  "disconnect"
  | "lobby_update"
  | "chat_in"
  | "th_start" | "th_new_round" | "th_player_action" | "th_your_turn" | "th_community_card" | "th_end_round" | "th_end_game" | "th_lost"
  ;

let clientCommands = [
  "get_lobbies",
  "join_lobby",
  "create_lobby",
  "change_settings",
  "change_gamemode",
  "start_game",
  "chat_out",
  "leave_lobby",
  "th_action"
];

let commandsWithoutData = [
  "get_lobbies",
  "start_game",
  "leave_lobby"
];

export class ServerMessage {
  command: Command | ServerCommand;
  data: PokerMessage;
}

export class ClientMessage {
  @IsIn(clientCommands)
  command: Command | ClientCommand;
  @ValidateIf(o => !commandsWithoutData.includes(o.command))
  @IsDefined()
  @Type(() => PokerMessage)
  data: PokerMessage;
}