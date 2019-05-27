import {Type} from "class-transformer";
import {Allow, IsDefined, IsIn, ValidateIf} from "class-validator";

export class PokerMessage {
    
}

export type Command =
  "get_lobbies"
  | "join_lobby"
  | "create_lobby"
  ;

let commands = [
  "get_lobbies",
  "join_lobby",
  "create_lobby"
];

let commandsWithoutData = [
  "get_lobbies"
];

export class GenericMessage {
  @IsIn(commands)
  command: Command;
  @ValidateIf(o => !commandsWithoutData.includes(o.command))
  @IsDefined()
  @Type(() => PokerMessage)
  data: PokerMessage;
}