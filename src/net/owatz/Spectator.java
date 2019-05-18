package net.owatz;

import org.java_websocket.WebSocket;
import sun.rmi.runtime.Log;

public class Spectator {

    public WebSocket connection;
    public boolean isSuper;

    public Spectator(WebSocket connection) {

        this.connection = connection;
        this.isSuper = false;
    }

    public void send(String message) {

        if (connection.isOpen()) {
            connection.send(message);
        }
    }
}
