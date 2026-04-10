from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.user_connections: dict[int, list[WebSocket]] = defaultdict(list)
        self.stock_connections: list[WebSocket] = []

    async def connect_user(self, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self.user_connections[user_id].append(websocket)

    async def connect_stocks(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.stock_connections.append(websocket)

    def disconnect_user(self, user_id: int, websocket: WebSocket) -> None:
        if websocket in self.user_connections.get(user_id, []):
            self.user_connections[user_id].remove(websocket)

    def disconnect_stock(self, websocket: WebSocket) -> None:
        if websocket in self.stock_connections:
            self.stock_connections.remove(websocket)

    async def send_user_notification(self, user_id: int, payload: dict) -> None:
        for connection in self.user_connections.get(user_id, []):
            await connection.send_json(payload)

    async def broadcast_stock_update(self, payload: dict) -> None:
        for connection in self.stock_connections:
            await connection.send_json(payload)


manager = ConnectionManager()
