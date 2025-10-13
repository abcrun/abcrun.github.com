export default class MediaTransmission {
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
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 1280,
          height: 720,
          frameRate: 30,
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // 将媒体轨道添加到 PeerConnection
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.pc.addTrack(track, this.localStream);
      });

      // 在WebRTC中，createOffer()的调用顺序需遵循‌媒体流优先原则‌，即必须先通过getUserMedia获取本地媒体流，再通过addTrack将流添加到RTCPeerConnection实例中，最后才能调用createOffer生成SDP Offer，这样才能确保SDP包含完整的媒体描述
      this.peerConnection.createOffer();

      console.log(
        '本地媒体流已添加:',
        this.localStream.getTracks().length,
        '个轨道'
      );
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

  static showLocalVideo(stream) {
    const video = document.getElementById('localVideo');
    if (video) {
      video.srcObject = stream;
      video.muted = true; // 本地视频静音避免回声
    }
  }

  static showRemoteVideo(stream) {
    const video = document.getElementById('remoteVideo');
    if (video) {
      video.srcObject = stream;
    }
  }

  // 控制媒体轨道
  toggleVideo(enabled) {
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = enabled;
      console.log('视频', enabled ? '开启' : '关闭');
    }
  }

  toggleAudio(enabled) {
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = enabled;
      console.log('音频', enabled ? '开启' : '关闭');
    }
  }

  // 切换摄像头
  async switchCamera() {
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (!videoTrack) return;

    // 获取所有视频设备
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(
      (device) => device.kind === 'videoinput'
    );

    if (videoDevices.length < 2) {
      console.log('没有可用的备用摄像头');
      return;
    }

    // 停止当前视频轨道
    videoTrack.stop();

    // 获取新的视频流
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: videoDevices[1].deviceId }, // 切换到第二个摄像头
        width: 1280,
        height: 720,
      },
      audio: false,
    });

    const newVideoTrack = newStream.getVideoTracks()[0];

    // 替换 PeerConnection 中的视频轨道
    const sender = this.pc
      .getSenders()
      .find((s) => s.track && s.track.kind === 'video');

    if (sender) {
      await sender.replaceTrack(newVideoTrack);
    }

    // 更新本地流
    this.localStream.removeTrack(videoTrack);
    this.localStream.addTrack(newVideoTrack);

    console.log('摄像头已切换');
  }
}
