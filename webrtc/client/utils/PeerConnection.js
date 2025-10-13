const RTCPeerConnection =
  window.RTCPeerConnection ||
  window.mozRTCPeerConnection ||
  window.webkitRTCPeerConnection;

export default class PeerConnection {
  constructor(signalling) {
    this.pc = new RTCPeerConnection({
      iceServer: [
        { url: 'stun:stun.l.google.com:19302' }, // google 提供的 stun 公共服务
      ],
    });
    this.signalling = signalling; // 创建 websocket 服务作为 信令服务器

    this.watchPeerConnection(); // 监听P2P连接状态变化和ICE候选地址收集
    this.watchSignallingMessages(); // 监听信令服务器消息
  }

  // 创建并发送offer - SDP
  async createOffer() {
    const offer = await this.pc.createOffer(); // createOffer() 方法会生成一个 RTCSessionDescription 对象,这个对象的核心就是 SDP 字符串
    await this.pc.setLocalDescription(offer); // 在调用 setLocalDescription(offer) 之后，浏览器才会正式开始收集 ICE 候选连接地址，收集过程中，每发现一个候选，就会触发 onicecandidate 事件并通过信令服务器发送
    this.signalling.send(JSON.stringify({ type: 'offer', data: { offer } }));
  }

  watchPeerConnection() {
    // 监听P2P连接
    this.pc.addEventListener('connectionstatechange', () => {
      console.log('P2P连接状态变化:', this.pc.connectionState);
    });

    // 监听收集 ICE 候选地址
    this.pc.addEventListener('icecandidate', (event) => {
      if (event.candidate) {
        console.log('新 ICE 候选地址:', event.candidate);
      } else {
        console.log('ICE 候选地址收集完毕');
      }
    });
  }

  watchSignallingMessages() {
    this.signalling.addEventListener('message', (event) => {
      const { type, data } = JSON.parse(event.data);
      switch (type) {
        case 'offer':
          console.log('收到SDP Offer:', type, data);
          this.onRemoteOffer(data);
          break;
        case 'answer':
          console.log('收到SDP Answer:', type, data);
          this.onRemoteAnswer(data);
          break;
        case 'ice-candidate':
          console.log('收到ICE候选者:', type, data);
          break;
        default:
          console.warn('未知WebSocket消息类型:', type, data);
      }
    });
  }

  async onRemoteOffer(data) {
    const { offer } = data;
    this.pc.setRemoteDescription(offer);

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.ws.send(JSON.stringify({ type: 'answer', data: { answer } }));
  }

  async onRemoteAnswer(data) {
    const { answer } = data;
    this.pc.setRemoteDescription(answer);
  }

  closeConnection() {
    this.pc.close();
    this.localStream.getTracks().forEach((track) => track.stop());
    this.remoteStream.getTracks().forEach((track) => track.stop());
  }
}
