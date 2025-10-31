import {
  S3Client,
  CreateMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  UploadPartCommand,
  ListPartsCommand,
} from "@aws-sdk/client-s3";

function blobToArrayBuffer(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = function () {
      const arrayBuffer = reader.result;
      resolve(arrayBuffer);
    };

    reader.onerror = function () {
      reject(new Error("无法读取blob文件"));
    };

    reader.readAsArrayBuffer(blob);
  });
}

export default class UploadManager {
  S3Client = null;

  bucket = "panda-private";

  maxChunkSize = 5 * 1024 * 1024;
  // maxChunkSize = 1 * 1024;

  maxConcurrentUploads = 5;

  waiting = [];

  inprogress = [];

  completed = [];

  error = [];

  constructor() {
    this.S3Client = new S3Client({
      endpoint: "xxxx",
      region: "us-east-1",
      credentials: {
        accessKeyId: "xxxx",
        secretAccessKey: "xxxxx",
      },
      forcePathStyle: true,
    });
  }

  async add(files) {
    files.forEach((file) => {
      const record = this.createRecord(file);
      this.schedule(record, "waiting");
    });

    this.upload();
  }

  stop(record) {
    record.disabled = true;
    record.inprogress = [];
    record.completed = [];

    this.inprogress.splice(this.inprogress.indexOf(record), 1); // 从 inprogress 中移除
    if (this.waiting.length) {
      this.upload();
    }

    this.schedule(record, "waiting"); // 将record放入waiting队列
  }

  async start(record) {
    record.disabled = false;
    await this.listMultipartUploads(record); // 获取record completed parts

    if (!this.inprogress.length) {
      this.upload();
    }
  }

  delete(record) {
    // 无差别删除
    this.waiting.splice(this.waiting.indexOf(record), 1);
    this.inprogress.splice(this.inprogress.indexOf(record), 1);
    this.completed.splice(this.completed.indexOf(record), 1);
    this.error.splice(this.error.indexOf(record), 1);
  }

  log(record, status) {
    console.log(record.key, status);
  }

  schedule(record, status) {
    switch (status) {
      case "waiting":
        this.waiting.push(record);
        break;
      case "inprogress":
        this.inprogress.push(record);
        break;
      case "completed":
        this.inprogress.splice(this.inprogress.indexOf(record), 1);
        this.completed.push(record);
        break;
      case "error":
        this.inprogress.splice(this.inprogress.indexOf(record), 1);
        this.error.push(record);
        break;
      default:
        break;
    }

    this.log(record, status);
  }

  async listMultipartUploads(record) {
    const listRes = await this.S3Client.send(
      new ListPartsCommand({
        Bucket: record.bucket,
        Key: record.key,
        UploadId: record.uploadId,
      })
    );

    record.completed = listRes.Parts.map((part) => ({
      partNumber: part.PartNumber,
      ETag: part.ETag,
    }));
  }

  async createFileUploadId(record) {
    const createRes = await this.S3Client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: record.key,
      })
    );

    return createRes.UploadId;
  }

  createRecord(file) {
    const now = new Date().getTime();
    const key = `${now}-${file.size}/${file.name}`;

    const chunks = Math.ceil(file.size / this.maxChunkSize);
    const record = {
      file,
      uploadId: "",
      hash: "",
      key,
      chunks,
      disabled: false,
      inprogress: [], // 记录正在上传的part
      completed: [],
    };

    return record;

    /* const worker = new Worker(new URL("./hash-worker.js", import.meta.url));
    worker.postMessage({ file, size: 1 * 1024 * 1024 });

    worker.onmessage = (event) => {
      const { status, hash } = event.data;

      if (status === "success") {
        record.hash = hash;
        console.log(record);
      } else {
        console.error("Hashing failed:", event.data);
      }

      worker.terminate();
    }; */

    return record;
  }

  createChunk(record, partNumber) {
    const { uploadId, file } = record;

    const start = (partNumber - 1) * this.maxChunkSize;
    const end = Math.min(partNumber * this.maxChunkSize, file.size);
    const chunk = file.slice(start, end);

    const chunkInfo = {
      uploadId,
      chunk,
      partNumber,
    };

    return chunkInfo;
  }

  async upload() {
    const record = this.waiting.shift();
    this.schedule(record, "inprogress");

    // 新上传的文件没有uploadId, 缓存离线记载的record，已经包含了uploadId
    if (!record.uploadId) {
      const uploadId = await this.createFileUploadId(record);
      record.uploadId = uploadId;
    }

    const { chunks, completed, inprogress } = record;
    const completedParts = completed.map((part) => part.PartNumber);
    const inprogressChunks = this.inprogress.reduce((total, current) => {
      return current.inprogress.length + total;
    }, 0);
    const availableChunks = this.maxConcurrentUploads - inprogressChunks;

    console.log(
      `上传文件：${record.key}，对应的uploadId为${record.uploadId}，文件被分成${chunks}个切片，当前可用的并发切片数是${availableChunks}`
    );

    const allParts = Array.from({ length: chunks }, (_, i) => i + 1);
    const availableChunksArray = allParts
      .filter(
        (number) =>
          !inprogress.includes(number) && !completedParts.includes(number)
      )
      .slice(0, Math.min(availableChunks, chunks));

    for (let i = 0; i < availableChunksArray.length; i += 1) {
      const partNumber = availableChunksArray[i];
      const chunkInfo = this.createChunk(record, partNumber);
      this.handleUpload(chunkInfo, record);
    }
  }

  async uploadNextChunk(record) {
    if (record.disabled) return; // 暂停上传

    if (this.error.includes(record) || !this.inprogress.includes(record))
      return; // 出错或者取消上传

    const { chunks, inprogress, completed } = record;
    const completedParts = completed.map((part) => part.PartNumber);

    const allParts = Array.from({ length: chunks }, (_, i) => i + 1);

    const nextPartNumber = allParts.find(
      (number) =>
        !inprogress.includes(number) && !completedParts.includes(number)
    );

    if (nextPartNumber) {
      const chunkInfo = this.createChunk(record, nextPartNumber);
      await this.handleUpload(chunkInfo, record);
    }
  }

  async handleUpload(chunkInfo, record) {
    if (record.disabled) return; // 暂停上传

    const { partNumber, chunk } = chunkInfo;
    record.inprogress.push(partNumber);

    console.log(`开始上传${record.key}: ${partNumber}/${record.chunks}`);

    try {
      const buffer = await blobToArrayBuffer(chunk);
      const uploadPartRes = await this.S3Client.send(
        new UploadPartCommand({
          Bucket: this.bucket,
          Key: record.key,
          UploadId: record.uploadId,
          PartNumber: partNumber,
          Body: buffer,
          ContentLength: buffer.byteLength,
        })
      );

      record.inprogress.splice(record.inprogress.indexOf(partNumber), 1);
      record.completed.push({
        ETag: uploadPartRes.ETag,
        PartNumber: partNumber,
      });

      if (record.completed.length === record.chunks) {
        this.handleMerge(record);
      } else {
        this.uploadNextChunk(record);
      }
    } catch (error) {
      this.schedule(record, "error");
    }
  }

  async handleMerge(record) {
    if (record.disabled) return; // 暂停上传

    try {
      await this.S3Client.send(
        new CompleteMultipartUploadCommand({
          Bucket: this.bucket,
          Key: record.key,
          UploadId: record.uploadId,
          MultipartUpload: {
            Parts: record.completed.sort((a, b) => a.PartNumber - b.PartNumber),
          },
        })
      );

      record.completed = [];
      this.schedule(record, "completed");

      if (this.waiting.length) {
        this.upload();
      }
    } catch (error) {
      console.log(error);
      this.schedule(record, "error");
    }
  }
}
