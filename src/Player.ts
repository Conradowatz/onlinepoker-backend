import {User} from "./User";
import {Player as ApiPlayer} from "../pokerapi/messages/ApiObjects";

export class Player extends User {

  id: number;
  name: string;

  apiPlayer():ApiPlayer {
    return {
      id: this.id,
      name: this.name
    };
  }
}