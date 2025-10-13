export default class WS {
  constructor(url) {
    this.socket = new WebSocket(url);

    this.watchSocketConnection();
  }

  watchSocketConnection() {
    this.socket.addEventListener('open', () => {
      console.log('WebSocket连接已打开');
    });

    this.socket.addEventListener('close', () => {
      console.log('WebSocket连接已关闭');
    });

    this.socket.addEventListener('error', (error) => {
      console.error('WebSocket错误:', error);
    });
  }

  close() {
    this.socket.close();
  }
}
