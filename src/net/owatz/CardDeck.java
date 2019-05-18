package net.owatz;

import java.util.ArrayList;

public class CardDeck {

    public ArrayList<Card> deck;

    public CardDeck() {
        newDeck();
    }

    public void newDeck() {

        deck = new ArrayList<>();
        for (int value=1; value<=13; value++) {
            for (int color=1; color<=4; color++) {
                deck.add(new Card(color, value, (value-1)*4+color-1));
            }
        }
    }

    public Card getRandomCard() {

        int randNum = (int)(Math.random() * (deck.size()));
        Card randCard = deck.get(randNum);
        deck.remove(randNum);
        return randCard;
    }
}
