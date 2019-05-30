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
  ;

export type ServerCommand =
  "disconnect"
  | "lobby_update"
  | "chat_in"
  ;

let commands = [
  "get_lobbies",
  "join_lobby",
  "create_lobby",
];

let serverCommands = [
  "disconnect",
  "lobby_update",
  "chat_in"
];

let clientCommands = [
  "change_settings",
  "change_gamemode",
  "start_game",
  "chat_out",
  "leave_lobby"
];

let commandsWithoutData = [
  "get_lobbies",
  "start_game",
  "leave_lobby"
];

export class ServerMessage {
  @IsIn(commands.concat(serverCommands))
  command: Command | ServerCommand;
  @ValidateIf(o => !commandsWithoutData.includes(o.command))
  @IsDefined()
  @Type(() => PokerMessage)
  data: PokerMessage;
}

export class ClientMessage {
  @IsIn(commands.concat(clientCommands))
  command: Command | ClientCommand;
  @ValidateIf(o => !commandsWithoutData.includes(o.command))
  @IsDefined()
  @Type(() => PokerMessage)
  data: PokerMessage;
}