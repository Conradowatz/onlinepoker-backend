package net.owatz;

import org.java_websocket.WebSocket;

public class Player {

    public WebSocket connection;
    public String name;
    public int chair;
    public Card[] cards = new Card[2];
    public int money;
    public int ante;
    public boolean[] options = new boolean[5];
    public boolean afk;
    public int potnum;
    public boolean isActive;
    public boolean allin;

    public Player(WebSocket webSocket, String name) {
        this.name = name;
        this.money = 0;
        this.connection = webSocket;
    }

    public void send(String message) {

        if (connection.isOpen()) {
            connection.send(message);
        }
    }

}
