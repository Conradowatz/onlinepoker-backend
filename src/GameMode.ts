import {GameMode as ApiGameMode} from "../pokerapi/messages/ApiObjects";

export abstract class GameMode {

  abstract getName():string;
  abstract getMaxPlayers():number;
  abstract apiGameMode():ApiGameMode;
}