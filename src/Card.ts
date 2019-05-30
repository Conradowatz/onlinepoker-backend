import {Card as ApiCard} from "../pokerapi/messages/ApiObjects";

export class Card {

  highlighted = false;

  constructor(public color: number, public value: number) {

  }

  getValueName():string {
    switch (this.value) {
      case 1: return "A";
      case 11: return "J";
      case 12: return "Q";
      case 13: return "K";
      case 14: return "A";
      default: return this.value.toString();
    }
  }

  getColorName():string {
    switch (this.color) {
      case 0: return "H";
      case 1: return "D";
      case 2: return "C";
      case 3: return "S";
    }
  }

  getSolverString():string {
    let result = "";
    switch (this.value) {
      case 1: result+="A"; break;
      case 10: result+="T"; break;
      case 11: result+="J"; break;
      case 12: result+="Q"; break;
      case 13: result+="K"; break;
      case 14: result+="A"; break;
      default: result+=this.value.toString();
    }
    switch (this.color) {
      case 0: result+="h"; break;
      case 1: result+="d"; break;
      case 2: result+="c"; break;
      case 3: result+="s";
    }
    return result;
  }

  static fromString(string: string):Card {
    let card = new Card(0, 0);
    let colorPart = string.slice(-1);
    let valuePart = string.slice(0, -1);
    switch (colorPart) {
      case "h": card.color = 0; break;
      case "d": card.color = 1; break;
      case "c": card.color = 2; break;
      case "s": card.color = 3;
    }
    switch (valuePart) {
      case "J": card.value = 11; break;
      case "Q": card.value = 12; break;
      case "K": card.value = 13; break;
      case "A": card.value = 14; break;
      default: card.value = parseInt(valuePart);
    }
    return card;
  }

  apiCard():ApiCard {
    return {
      value: this.getValueName(),
      color: this.getColorName()
    }
  }
}