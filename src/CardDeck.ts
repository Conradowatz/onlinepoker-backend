import {Card} from "./Card";

export class CardDeck {
  deck: Card[];

  constructor() {
    this.deck = [];
    for (let value=1; value<=13; value++) {
      for (let color=0; color<=3; color++) {
        this.deck.push(new Card(color, value))
      }
    }
    CardDeck.shuffleArray(this.deck);
  }

  getRandomCard():Card {
    return this.deck.pop();
  }

  /**
   * https://en.wikipedia.org/wiki/Fisher–Yates_shuffle
   * https://stackoverflow.com/a/12646864
   * @param array to shuffle
   */
  private static shuffleArray<T>(array: Array<T>) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}