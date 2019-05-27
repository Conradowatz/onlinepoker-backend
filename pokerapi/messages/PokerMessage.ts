import {Type} from "class-transformer";
import {IsDefined, IsIn, ValidateIf} from "class-validator";

export class PokerMessage {

}

export type Command =
  "get_lobbies"
  | "join_lobby"
  | "create_lobby"
  ;

export type ClientCommand = string;

export type ServerCommand =
  "disconnect"
  ;

let commands = [
  "get_lobbies",
  "join_lobby",
  "create_lobby",
];

let serverCommands = [
  "disconnect",
];

let clientCommands = [

];

let commandsWithoutData = [
  "get_lobbies"
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