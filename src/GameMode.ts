import {Settings} from "../pokerapi/messages/ApiObjects";

export abstract class GameMode {

  abstract getName():string;
  abstract getMaxPlayers():number;
  abstract isRunning():boolean;
  abstract isJoinable():boolean;
  abstract apiSettings():Settings;
  abstract startGame():void;

  static availableGamemodes = ["texasholdem"];
}