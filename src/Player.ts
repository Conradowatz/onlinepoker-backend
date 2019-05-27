import {User} from "./User";
import {Player as ApiPlayer} from "../pokerapi/messages/ApiObjects";

export class Player implements User {

  constructor(public id: number, public name:string) {

  }

  apiPlayer():ApiPlayer {
    return {
      id: this.id,
      name: this.name
    };
  }
}