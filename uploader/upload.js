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

var uuid = function () {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0;
    var v = c === "x" ? r : (r & 0x3) | 0x8; // 0x3 -> 0b0011 16(0b1111)以内的数与其或运算，可以将数组限定在[0-3]之间，0x8 -> 1000 [0-3]以内的整数与其位运算，可以将数组限定在[8-11]之间，即8/9/a/b
    return v.toString(16);
  });
};

export default class UploadManager {
  S3Client = null;

  bucket = "xxx";

  maxChunkSize = 10 * 1024 * 1024;

  maxConcurrentUploads = 5;

  files = [];

  inprogress = []; // 记录正在上传的文件

  constructor() {
    this.S3Client = new S3Client({
      endpoint: "xxx",
      region: "xxx",
      credentials: {
        accessKeyId: "xxx",
        secretAccessKey: "xxx",
      },
      forcePathStyle: true,
    });
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

  async createFileUploadId(file) {
    const createRes = await this.S3Client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: file.key,
      })
    );

    return createRes.UploadId;
  }

  createRecord(file) {
    const now = new Date().getTime();
    const uid = uuid().replace(/-/g, "");
    const key = `${uid}_${now}_${file.size}/${file.name}`;

    const chunks = Math.ceil(file.size / this.maxChunkSize);
    const record = {
      key,
      uploadId: "",
      hash: "",
      status: "waiting", // waiting || inprogress || completed || merged || error || stopped || deleted  completed代表完成所有的分片上传  merged 代表合并完成
      chunks,
      inprogress: [], // 记录正在上传的partNumber
      completed: [], // 记录已经上传完成的分片数据 { partNumber, ETag }
      raw: file,
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

  add(files) {
    files.forEach((file) => {
      const record = this.createRecord(file);
      record.keyIndex = this.files.length;

      this.files.push(record);
    });

    if (!this.inprogress.length) this.start();
  }

  async start(file) {
    if (file) file.status = "waiting"; // 将 file 添加到等待上传队列，比如：文件从 stopped 状态变为可以上传

    const inprogressChunks = this.inprogress.reduce((total, current) => {
      return current.inprogress.length + total;
    }, 0);
    if (inprogressChunks >= this.maxConcurrentUploads) return;

    // 如果没有正在上传的文件，则开始上传新的文件
    if (!this.inprogress.length) {
      this.uploadNewFile();
    } else {
      // 获取最新的正在上传的文件
      const latestInprogressFile = this.inprogress[this.inprogress.length - 1];
      const { inprogress, completed, chunks } = latestInprogressFile;

      // 如果还有未完成的分片，则继续上传 -> 当completed.length === chunks 时需要首先执行合并
      if (inprogress.length + completed.length <= chunks) {
        this.uploadChunk(latestInprogressFile);
      } else {
        this.uploadNewFile();
      }
    }
  }

  stop(uploadId) {
    const file = this.files.find((file) => file.uploadId === uploadId);
    if (!file) return;

    file.status = "stopped";
    this.inprogress.splice(this.inprogress.indexOf(file), 1);
  }

  delete(uploadId) {
    const file = this.files.find((file) => file.uploadId === uploadId);
    if (!file) return;

    file.status = "deleted"; // 标记为已删除，理论上如果已经上传了应该删除存储桶的文件，未上传所有分片的也应该删除存储桶的分片数据
    this.inprogress.splice(this.inprogress.indexOf(file), 1);
  }

  async uploadNewFile() {
    const file = this.files.find((file) => file.status === "waiting");
    if (!file) return;

    this.inprogress.push(file);
    file.status = "inprogress";

    // 新文件没有uploadId；
    // 暂停并重新开启的文件或历史记录中未上传完成的文件已经包含了uploadId
    if (!file.uploadId) {
      const uploadId = await this.createFileUploadId(file);
      file.uploadId = uploadId;
    }

    console.log(
      `上传文件：${file.key}，对应的uploadId为${file.uploadId}，文件被分成${file.chunks}个切片，历史上传chunk数为${file.completed.length}`
    );

    this.uploadChunk(file);
  }

  async uploadChunk(file) {
    if (file.status !== "inprogress") return; // error or stopped

    const { chunks, completed, inprogress } = file;

    // 如果某个文件所有分片上传完成了，但是在merge之前被暂停了，此时当重新启用上传时，应该直接合并
    if (completed.length === chunks) {
      this.mergeChunks(file);
      return;
    }

    const completedParts = completed.map((part) => part.PartNumber);
    const inprogressChunks = this.inprogress.reduce((total, current) => {
      return current.inprogress.length + total;
    }, 0);
    const availableChunks = this.maxConcurrentUploads - inprogressChunks;

    console.log(`当前可用并发数为：${availableChunks}`);

    const allParts = Array.from({ length: chunks }, (_, i) => i + 1);
    const availableChunksArray = allParts
      .filter(
        (number) =>
          !inprogress.includes(number) && !completedParts.includes(number)
      )
      .slice(0, availableChunks);

    for (let i = 0; i < availableChunksArray.length; i += 1) {
      const partNumber = availableChunksArray[i];
      const chunkInfo = this.createChunk(file, partNumber);

      this.handleUpload(chunkInfo, file);
    }

    if (availableChunksArray.length < availableChunks) {
      this.uploadNewFile();
    }
  }

  createChunk(file, partNumber) {
    const { uploadId, raw } = file;

    const start = (partNumber - 1) * this.maxChunkSize;
    const end = Math.min(partNumber * this.maxChunkSize, raw.size);
    const chunk = raw.slice(start, end);

    const chunkInfo = {
      uploadId,
      chunk,
      partNumber,
    };

    return chunkInfo;
  }

  async handleUpload(chunkInfo, file) {
    if (file.status !== "inprogress") return;

    const { partNumber, chunk } = chunkInfo;
    file.inprogress.push(partNumber);

    console.log(`开始上传${file.key}: ${partNumber}/${file.chunks}`);
    try {
      const buffer = await blobToArrayBuffer(chunk);
      const uploadPartRes = await this.S3Client.send(
        new UploadPartCommand({
          Bucket: this.bucket,
          Key: file.key,
          UploadId: file.uploadId,
          PartNumber: partNumber,
          Body: buffer,
          ContentLength: buffer.byteLength,
        })
      );

      file.inprogress.splice(file.inprogress.indexOf(partNumber), 1);
      file.completed.push({
        ETag: uploadPartRes.ETag,
        PartNumber: partNumber,
      });

      if (file.completed.length === file.chunks) {
        file.status = "completed";
        this.handleMerge(file);
      } else {
        this.uploadChunk(file);
      }
    } catch (error) {
      file.status = "error";
      console.log("handleUpload error:", error);
    }
  }

  async handleMerge(file) {
    if (file.status !== "completed") return;

    console.log(`开始合并文件：${file.key}，对应的uploadId为${file.uploadId}`);
    try {
      await this.S3Client.send(
        new CompleteMultipartUploadCommand({
          Bucket: this.bucket,
          Key: file.key,
          UploadId: file.uploadId,
          MultipartUpload: {
            Parts: file.completed.sort((a, b) => a.PartNumber - b.PartNumber),
          },
        })
      );

      console.log(
        `合并文件成功：${file.key}，对应的uploadId为${file.uploadId}`
      );
      file.completed = [];
      this.inprogress.splice(this.inprogress.indexOf(file), 1); // 移除正在进行中的文件

      this.uploadNewFile();
    } catch (error) {
      file.status = "error";
      console.log("handleMerge error:", error);
    }
  }
}
