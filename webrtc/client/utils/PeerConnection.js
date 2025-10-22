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
    this.pc.onconnectionstatechange = () => {
      console.log('P2P连接状态变化:', this.pc.connectionState);
    };

    // 监听收集 ICE 候选地址
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('新 ICE 候选地址:', event.candidate);
      } else {
        console.log('ICE 候选地址收集完毕');
      }
    };

    // 需要进行新的信令交换以建立或更新连接时触发 - 可以在此事件中调用 createOffer 或 createAnswer 来发起新的 SDP
    this.pc.onnegotiationneeded = () => {
      console.log('需要进行新的信令交换');
    };

    // 当信令状态发生变化时触发。信令状态指的是连接的信令通道的不同状态（例如，stable, have-local-offer 等）
    this.pc.onsignalingstatechange = () => {
      console.log('信令状态变化:', this.pc.signalingState);
    };

    this.pc.oniceconnectionstatechange = () => {
      console.log('ICE连接状态变化:', this.pc.iceConnectionState);
    };
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
    // 1. 停止所有发送器
    this.pc.getSenders().forEach(sender => {
      if (sender.track) {
        sender.track.stop();
        sender.replaceTrack(null); // 移除track引用
      }
    });

    // 2. 移除所有接收器处理
    this.pc.getReceivers().forEach(receiver => {
      if (receiver.track) receiver.track.stop();
    });

    // 3. 关闭连接
    this.pc.close();

    // 4. 清理事件监听器
    this.pc.onconnectionstatechange = null;
    this.pc.oniceconnectionstatechange = null;
    this.pc.onsignalingstatechange = null;
    this.pc.onnegotiationneeded = null;
    this.pc.onicecandidate = null;

    // 5. 设置为null帮助GC
    setTimeout(() => {
      this.pc = null;
    }, 0);

    this.localStream.getTracks().forEach((track) => track.stop());
    this.remoteStream.getTracks().forEach((track) => track.stop());
  }
}
