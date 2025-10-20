export default class UploadManager {
  constructor(files) {
    this.maxChunkSize = 5 * 1024 * 1024;
    this.maxConcurrentUploads = 5;
    this.files = files || [];

    this.recordMap = new Map();
    this.chunks = 0; // 记录当前上传的chunk数量
  }

  createRecord(fileIndex) {
    const uploadId = 'xxx';
    const maxChunks = Math.ceil(this.files[fileIndex].size / this.maxChunkSize);
    const record = {
      uploadId,
      hash: '',
      maxChunks,
      status: 'pending',
      sliced: 0, // 记录当前slice的chunk的index
      inprogress: new Set(), // 记录正在上传的part
      completed: new Set(), // 记录已完成上传的part
      error: new Set(), // 记录上传失败的part
    };

    this.recordMap.set(fileIndex, record);

    const worker = new Worker(new URL('./hash-worker.js', import.meta.url));
    worker.postMessage({ file: this.files[fileIndex], size: 1 * 1024 * 1024 });

    worker.onmessage = (event) => {
      const { status, hash } = event.data;

      if (status === 'success') {
        record.hash = hash;
        console.log(record);
      } else {
        console.error('Hashing failed:', event.data);
      }

      worker.terminate();
    };

    return record;
  }

  createChunk(fileIndex) {
    const record = this.recordMap.get(fileIndex);
    const file = this.files[fileIndex];

    const { uploadId, sliced } = record;

    const start = sliced * this.maxChunkSize;
    const end = Math.min((sliced + 1) * this.maxChunkSize, file.size);
    const chunk = file.slice(start, end);

    const chunkInfo = {
      fileIndex,
      uploadId,
      chunk,
      partNumber: sliced + 1,
    };

    return chunkInfo;
  }

  uploadNewFile(fileIndex) {
    const record = this.createRecord(fileIndex);

    const { maxChunks } = record;
    const availableChunks = this.maxConcurrentUploads - this.chunks;
    if (availableChunks <= 0) return;

    console.log(
      'new file',
      fileIndex,
      `最多可以拆分的chunk数目${maxChunks}`,
      `可用的chunk数目${availableChunks}`
    );

    if (maxChunks > availableChunks) {
      for (let i = 0; i < availableChunks; i += 1) {
        const chunkInfo = this.createChunk(fileIndex);
        this.handleUpload(chunkInfo);
      }
    } else {
      for (let i = 0; i < maxChunks; i += 1) {
        const chunkInfo = this.createChunk(fileIndex);
        this.handleUpload(chunkInfo);
      }

      if (this.files.length > fileIndex + 1) this.uploadNewFile(fileIndex + 1);
    }
  }

  uploadNextChunk(fileIndex) {
    const chunkInfo = this.createChunk(fileIndex);
    this.handleUpload(chunkInfo);
  }

  handleUpload(chunkInfo) {
    const { fileIndex, partNumber } = chunkInfo;
    const record = this.recordMap.get(fileIndex);
    record.inprogress.add(partNumber);
    record.status = 'uploading';
    record.sliced += 1;
    this.chunks += 1;

    new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.5) {
          resolve();
        } else {
          reject();
        }
      }, 1000);
    }).then(
      () => {
        record.inprogress.delete(partNumber);
        record.completed.add(partNumber);
        this.chunks -= 1;

        if (record.completed.size === record.maxChunks) {
          this.handleMerge(fileIndex);
        } else {
          this.uploadNextChunk(fileIndex);
        }
      },
      () => {
        // record.inprogress.delete(partNumber); // retry or delete
        // record.status = 'chunk error';
        // this.chunks -= 1;
        record.error.add(partNumber);
      }
    );
  }

  handleMerge(fileIndex) {
    const record = this.recordMap.get(fileIndex);
    record.inprogress.clear();
    record.completed.clear();
    record.error.clear();

    if (record) {
      new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, 1000);
      }).then(
        () => {
          record.status = 'completed';

          const lastKey = Array.from(this.recordMap.keys()).pop();
          // const lastKey = this.recordMap.size;
          this.uploadNewFile(lastKey);
        },
        () => {
          record.status = 'merge error';
        }
      );
    }
  }

  upload(fileIndex) {
    const record = this.recordMap.get(fileIndex);
    if (!record) {
      this.uploadNewFile(fileIndex);
    } else {
      this.uploadNextChunk(fileIndex);
    }
  }
}
