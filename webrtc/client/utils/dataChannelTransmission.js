// eslint-disable-next-line max-classes-per-file
class orderedTextDataChannel {
  constructor(peerConnection) {
    this.peerConnection = peerConnection;
    this.dataChannel = null;

    this.start();
  }

  start() {
    // 默认类型
    this.dataChannel = this.peerConnection.pc.createDataChannel(
      'ordered-text',
      {
        ordered: true, // 保证消息顺序
        maxRetransmits: 5, // 最大重传次数
      }
    );

    this.dataChannel.onmessage = (event) => {
      console.log('收到标准顺序文本:', event.data);
    };

    this.peerConnection.createOffer();
  }

  send(msg) {
    this.dataChannel.send(msg);
  }
}

class disorderedUnreliableBinaryDataChannel {
  constructor(peerConnection) {
    this.peerConnection = peerConnection;
    this.dataChannel = null;

    this.start();
  }

  start() {
    // 适合实时游戏数据
    this.dataChannel = this.peerConnection.pc.createDataChannel(
      'unreliable-binary',
      {
        ordered: false, // 不保证顺序
        maxRetransmitTime: 100, // 最大重传时间(ms)
        maxRetransmits: 0, // 0 表示不可靠模式
      }
    );

    this.dataChannel.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        const view = new Uint8Array(event.data);
        console.log('收到二进制数据:', view);
      }
    };

    this.peerConnection.createOffer();
  }

  send(buffer) {
    this.dataChannel.send(buffer);
  }
}

class fileDataChannel {
  constructor(peerConnection) {
    this.peerConnection = peerConnection;
    this.dataChannel = null;

    this.start();
  }

  start() {
    // 适合大文件传输
    this.dataChannel = this.peerConnection.pc.createDataChannel('file', {
      ordered: true, // 文件需要有序传输
      maxPacketLifeTime: 1000, // 包生命周期
    });

    this.dataChannel.onopen = () => {
      console.log('文件传输通道已就绪');
    };

    this.dataChannel.onmessage = (event) => {
      if (typeof event.data === 'string') {
        const metadata = JSON.parse(event.data);

        if (metadata.type === 'file-metadata') {
          this.currentFile = {
            name: metadata.name,
            size: metadata.size,
            type: metadata.type,
            totalChunks: metadata.totalChunks,
            receivedChunks: 0,
            chunks: new Array(metadata.totalChunks),
          };
          console.log('开始接收文件:', metadata.name);
        }
      } else if (event.data instanceof ArrayBuffer) {
        // 处理二进制数据块
        console.log('收到文件数据块:', event.data);
      }
    };

    this.peerConnection.createOffer();
  }

  async send(file) {
    if (this.dataChannel.readyState !== 'open') {
      console.error('文件通道未就绪');
      return;
    }

    const chunkSize = 16 * 1024; // 16KB 分块
    const totalChunks = Math.ceil(file.size / chunkSize);

    // 发送文件元数据
    this.dataChannel.send(
      JSON.stringify({
        type: 'file-metadata',
        name: file.name,
        size: file.size,
        defaultType: file.type,
        totalChunks,
      })
    );

    // 分块发送文件数据
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
      const start = chunkIndex * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const blob = file.slice(start, end);

      blob.arrayBuffer().then((buffer) => {
        this.dataChannel.send(
          JSON.stringify({
            type: 'file-chunk',
            chunkIndex,
            totalChunks,
            data: buffer,
          })
        );
        // 进度更新
        const progress = ((chunkIndex + 1) / totalChunks) * 100;
        console.log(progress);
      });
    }
  }
}

/**
 * 如果是做游戏的话，可以设置dataChannel的参数如下：
 * {
      ordered: false,        // 游戏状态不要求顺序
      maxRetransmitTime: 50, // 很短的重传时间
      maxRetransmits: 1      // 只重传一次
    }
 */

export {
  orderedTextDataChannel,
  disorderedUnreliableBinaryDataChannel,
  fileDataChannel,
};
