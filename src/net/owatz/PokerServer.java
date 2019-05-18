package net.owatz;

import java.io.File;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.Collection;
import java.util.Scanner;

import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class PokerServer extends WebSocketServer {

    public static void main(String[] args) {

        readConfig();

        int port = 8887;
        PokerServer server = new PokerServer(new InetSocketAddress(port));
        new Thread(server).start();
        System.out.println("Server running!");
        server.isGameRunning = false;
        System.out.println("Lobby open");

        Scanner in = new Scanner(System.in);;
        while (in.hasNext()) {
            String[] cmd = in.next().split(" ");
            switch (cmd[0]) {
                case "startgame":
                    if (!server.isGameRunning) {
                        server.startGame();
                    }
                    break;
                case "nextplayer":
                    if (server.isGameRunning) {
                        table.turn = table.getNextPlayer(table.turn);
                        table.nextPlayer();
                    } else {
                        System.out.println("No game running!");
                    }
                    break;
                case "nextccard":
                    if (server.isGameRunning) {
                        table.nextCCard();
                        break;
                    } else {
                        System.out.println("Game already running!");
                    }
                case "stop":
                    try {
                        server.disconnectClients();
                        server.stop();
                    } catch (IOException | InterruptedException e) {
                        e.printStackTrace();
                    }
                    System.exit(0);
                    return;
                case "playerlist":
                    System.out.println("Name\t|\tChair\t|\tMoney\t|\tAnte");
                    for (Player p: table.players) {
                        System.out.println(p.name+"\t|\t"+p.chair+"\t|\t"+p.money+"\t|\t"+p.ante);
                    }
                    break;
            }
        }
    }

    private static void readConfig() {

        File optionsFile = new File("options.txt");
        if (optionsFile.exists() && !optionsFile.isDirectory()) {
            try {
                Options.readOptionsFile(optionsFile);
            } catch (Exception e) {
                System.out.println("Error reading options.txt: "+e.getMessage());
                Options.createNewOptionsFile();
            }
        } else {
            System.out.println("No options file found.");
            Options.createNewOptionsFile();
        }

        File blindsFile = new File("blinds.txt");
        if (blindsFile.exists() && !blindsFile.isDirectory()) {
            try {
                Options.readBlindsFile(blindsFile);
            } catch (Exception e) {
                System.out.println("Error reading blinds.txt: "+e.getMessage());
                Options.createNewBlindsFile();
            }
        } else {
            System.out.println("No blinds file found.");
            Options.createNewBlindsFile();
        }
    }

    public PokerServer(InetSocketAddress address) {
        super(address);
    }

    public static Table table = new Table();
    public boolean isGameRunning;

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        if (connections().size()>Options.maxConnections) {
            conn.close();
            return;
        }

        if (!Options.allowSameIp) {
            for (WebSocket c : connections()) {
                if ((c!=conn) && (c.getRemoteSocketAddress().getAddress().equals(conn.getRemoteSocketAddress().getAddress()))) {
                    conn.close();
                    return;
                }
            }
        }

        System.out.println(conn.getRemoteSocketAddress() + " connected");
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        System.out.println(conn.getRemoteSocketAddress() + " left. Exit code: " + code + " Additional info: " + reason);
        playerLeft(conn);
    }

    @Override
    public void onMessage(WebSocket conn, String m) {

        boolean noCmd = false;

        if (!isJSONValid(m)) return;
        JSONObject message = new JSONObject(m);
        if (message.has("c")) {
            String cmd = message.getString("c");
            switch (cmd) {
                case "lobby_open?":
                    conn.send(parseResponse("lobby_open", isGameRunning ? "no" : "yes"));
                    break;
                case "connected?":
                    conn.send(parseResponse("connected"));
                    break;
                case "join":
                    if (isGameRunning || table.players.size() == 6) {
                        conn.send("joined full");
                        break;
                    }
                    String name = message.getString("d");
                    if (name.length() > 14) break;
                    table.players.add(new Player(conn, name));
                    sendJoined(conn);
                    break;
                case "sit_chair":
                    if (isGameRunning) break;
                    int chair = message.getInt("d");
                    boolean taken = false;
                    Player thisPlayer = null;
                    for (Player player : table.players) {
                        if (player.connection == conn) thisPlayer = player;
                        if (player.chair == chair) taken = true;
                    }
                    if (!taken) {
                        thisPlayer.chair = chair;
                        for (Player player : table.players) sendPlayerInfo(player.connection);
                    } else sendJoined(conn);
                    break;
                case "option":
                    if (!table.awaitingOption) return;
                    for (int i = 0; i < table.players.size(); i++) {
                        Player player = table.players.get(i);
                        if (conn == player.connection && table.players.indexOf(player) == table.turn) {
                            JSONObject data = message.getJSONObject("d");
                            table.tookOption(data.getInt("option"), data.getInt("value"));
                        }
                    }
                    break;
                case "leave":
                    playerLeft(conn);
                    break;
                case "spectate":
                    if (!isGameRunning) return;
                    if ((table.spectators.size()>=Options.maxSpectators) || (table.players.size()<2)) return;
                    Spectator spectator = new Spectator(conn);
                    table.spectators.add(spectator);
                    spectator.send(parseResponse("spectate_info", table.getSpectatorInfo()));
                    break;
                default:
                    noCmd = true;
            }
        }

        if (!noCmd) System.out.println(conn.getRemoteSocketAddress() + " -> " + m);
    }

    public boolean isJSONValid(String test) {
        try {
            new JSONObject(test);
        } catch (JSONException ex) {
            try {
                new JSONArray(test);
            } catch (JSONException ex1) {
                return false;
            }
        }
        return true;
    }

    private void playerLeft(WebSocket conn) {

        for (int i=0; i<table.players.size(); i++) {
            Player player = table.players.get(i);
            if (conn==player.connection) {
                if (!isGameRunning) {
                    table.players.remove(player);
                    for (Player p: table.players) sendPlayerInfo(p.connection);
                } else {
                    player.money = 0;
                    player.isActive = false;
                    if (table.turn==i) table.nextPlayer();
                    for (Player p: table.players) p.send(parseResponse("update_players", table.getUpdatePlayerInfo()));
                }
                return;
            }
        }
        for (int i=0; i<table.spectators.size(); i++) {
            Spectator spectator = table.spectators.get(i);
            if (conn==spectator.connection) {
                table.spectators.remove(i);
                return;
            }
        }
    }

    private void sendPlayerInfo(WebSocket conn) {

        conn.send(parseResponse("playerinfo", table.getPlayerInfo()));
    }

    private void sendJoined(WebSocket conn) {

        conn.send(parseResponse("joined", table.getPlayerInfo()));
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        if (conn!=null) System.err.println("ERROR " + conn.getRemoteSocketAddress()  + ":" + ex);
        ex.printStackTrace();
    }

    public void startGame() {

        System.out.println("Game started");
        isGameRunning = true;
        table.startNewGame();
    }

    public static String parseResponse(String command, String data) {

        JSONObject responseObject = new JSONObject();
        responseObject.put("c", command);
        responseObject.put("d", data);
        return responseObject.toString();
    }

    public static String parseResponse(String command) {

        JSONObject responseObject = new JSONObject();
        responseObject.put("c", command);
        return responseObject.toString();
    }

    public static String parseResponse(String command, JSONObject data) {

        JSONObject responseObject = new JSONObject();
        responseObject.put("c", command);
        responseObject.put("d", data);
        return responseObject.toString();
    }

    public static String parseResponse(String command, JSONArray data) {

        JSONObject responseObject = new JSONObject();
        responseObject.put("c", command);
        responseObject.put("d", data);
        return responseObject.toString();
    }

    public void disconnectClients() {

        for (WebSocket c : connections()) {
            c.send(parseResponse("server_closed"));
            c.close();
        }
    }

    public void sendToAll(String text) {
        Collection<WebSocket> con = connections();
        synchronized ( con ) {
            for( WebSocket c : con ) {
                c.send( text );
            }
        }
    }
}