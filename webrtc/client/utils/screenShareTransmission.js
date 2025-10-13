export default class screenShareTransmission {
  constructor(peerConnection) {
    this.peerConnection = peerConnection;
    this.localStream = null;
    this.remoteStream = null;

    this.start();
    this.watchPeerConnection();
  }

  // 启用并发送本地媒体流
  async start() {
    try {
      // 获取摄像头和麦克风权限
      this.localStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always', // 显示鼠标
          displaySurface: 'window', // 共享窗口
        },
        audio: true, // 是否共享系统音频
      });

      // 将屏幕轨道添加到 PeerConnection
      const videoTrack = this.localStream.getVideoTracks()[0];
      const audioTrack = this.localStream.getAudioTracks()[0];

      if (videoTrack) {
        this.peerConnection.pc.addTrack(videoTrack, this.localStream);
      }
      if (audioTrack) {
        this.peerConnection.pc.addTrack(audioTrack, this.localStream);
      }

      // 监听屏幕共享停止
      videoTrack.onended = () => {
        console.log('屏幕共享已停止');
        this.stopScreenShare();
      };

      // 在WebRTC中，createOffer()的调用顺序需遵循‌媒体流优先原则‌，即必须先通过getUserMedia获取本地媒体流，再通过addTrack将流添加到RTCPeerConnection实例中，最后才能调用createOffer生成SDP Offer，这样才能确保SDP包含完整的媒体描述
      this.peerConnection.createOffer();
    } catch (error) {
      console.error('获取媒体设备失败:', error);
    }
  }

  watchPeerConnection() {
    // 接收远程媒体流
    this.peerConnection.pc.addEventListener('track', (event) => {
      console.log('收到远程媒体流:', event.track.kind, '轨道');

      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }

      // 将远程轨道添加到媒体流
      this.remoteStream.addTrack(event.track);
    });
  }

  stopScreenShare() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }
}
